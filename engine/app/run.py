"""Pipeline orchestrator: turn a list of free-text requests into a Cookbook.

Shared by the CLI and the FastAPI service. Progress is reported through a callback
so callers can print it (CLI) or stream it to Firestore (web). The two phases mirror
the brief's output: first "Searching", then "Scaling", then "Building".
"""

from __future__ import annotations

import re
from collections.abc import Callable

from .models import Cookbook, Recipe
from .pipeline.categorize import categorize
from .pipeline.images import fetch_recipe_art
from .pipeline.modify import apply_modifications
from .pipeline.scale import scale_recipe
from .pipeline.scrape import scrape_recipe
from .pipeline.search import search_recipe_urls
from .pipeline.understand import understand_request
from .util import slugify

Progress = Callable[[dict], None]

_URL_RE = re.compile(r"https?://\S+")


def _noop(_event: dict) -> None:
    pass


def _extract_url(text: str) -> str | None:
    """If the request contains a URL, use it directly (paste-a-recipe, keyless)."""
    match = _URL_RE.search(text)
    return match.group(0).rstrip(").,") if match else None


def _dedupe_ids(recipes: list[Recipe]) -> None:
    seen: set[str] = set()
    for recipe in recipes:
        base = recipe.id or slugify(recipe.title)
        rid, n = base, 2
        while rid in seen:
            rid, n = f"{base}-{n}", n + 1
        seen.add(rid)
        recipe.id = rid


def _auto_title(recipes: list[Recipe]) -> str:
    if not recipes:
        return "My Cookbook"
    if len(recipes) == 1:
        return recipes[0].title
    return "My Chefsprint Cookbook"


def build_cookbook(
    requests: list[str],
    *,
    title: str | None = None,
    subtitle: str | None = None,
    theme: str = "doodle-cream",
    use_ai: bool = True,
    progress: Progress | None = None,
) -> Cookbook:
    """Run every request through the pipeline and assemble a Cookbook.

    ``use_ai=False`` runs the fully deterministic path (no Gemini understanding,
    modification, or image generation) regardless of configured keys.
    """
    emit = progress or _noop

    # Phase 1 — understand, find, scrape.
    scraped: list[tuple] = []
    for request in requests:
        intent = understand_request(request, use_ai=use_ai)
        direct = _extract_url(request)
        candidates = [direct] if direct else search_recipe_urls(intent.dish or request)
        if not candidates:
            emit({"stage": "search", "ok": False, "request": request,
                  "message": "no recipe found"})
            continue

        # Try candidates in order until one scrapes (sites like Food Network 403).
        recipe = None
        last_error = "could not scrape any result"
        for url in candidates:
            try:
                recipe = scrape_recipe(url)
                recipe.request = request
                break
            except Exception as exc:
                last_error = str(exc)
                continue

        if recipe is None:
            emit({"stage": "search", "ok": False, "request": request, "message": last_error})
            continue

        scraped.append((intent, recipe))
        emit({"stage": "search", "ok": True, "request": request,
              "title": recipe.title, "host": recipe.source_host})

    # Phase 2 — scale, modify, categorize.
    recipes: list[Recipe] = []
    for intent, recipe in scraped:
        recipe = scale_recipe(recipe, intent.servings)
        recipe = apply_modifications(recipe, intent, use_ai=use_ai)
        recipe.category = categorize(recipe, intent.category_hint)
        recipes.append(recipe)
        emit({"stage": "scale", "ok": True, "title": recipe.title,
              "servings": recipe.servings})

    # Phase 3 — dish art (AI-generated square photo, scraped-photo fallback).
    for recipe in recipes:
        recipe.image_data = fetch_recipe_art(recipe, use_ai=use_ai)
        emit({"stage": "art", "ok": bool(recipe.image_data), "title": recipe.title})

    _dedupe_ids(recipes)
    emit({"stage": "build", "count": len(recipes)})
    return Cookbook(
        title=title or _auto_title(recipes),
        subtitle=subtitle,
        theme=theme,
        recipes=recipes,
    )
