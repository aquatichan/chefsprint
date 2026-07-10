"""Scrape a recipe URL into a structured :class:`Recipe` using ``recipe-scrapers``.

``recipe-scrapers`` handles 640+ sites explicitly and, with ``wild_mode=True``, falls
back to schema.org / Open Graph metadata for everything else. We fetch the HTML
ourselves so we can set a polite User-Agent and control timeouts.
"""

from __future__ import annotations

import re

import requests
from recipe_scrapers import scrape_html

from ..config import get_settings
from ..models import Recipe
from ..util import slugify
from .parse import parse_ingredients

_INT = re.compile(r"\d+")


def fetch_html(url: str) -> str:
    settings = get_settings()
    resp = requests.get(
        url,
        headers={"User-Agent": settings.user_agent, "Accept-Language": "en-US,en;q=0.9"},
        timeout=settings.request_timeout,
    )
    resp.raise_for_status()
    return resp.text


def _safe(fn, default=None):
    """Call a scraper accessor, swallowing the many ways it can fail per-field."""
    if not callable(fn):
        return default
    try:
        value = fn()
        return value if value not in (None, "") else default
    except Exception:
        return default


def _servings_from_yields(yields) -> int | None:
    if not yields:
        return None
    match = _INT.search(str(yields))
    return int(match.group()) if match else None


def scrape_recipe(url: str, html: str | None = None) -> Recipe:
    """Fetch + parse a recipe page into a fully structured Recipe."""
    if html is None:
        html = fetch_html(url)

    # supported_only=False enables the schema.org / Open Graph fallback for any site.
    scraper = scrape_html(html, org_url=url, supported_only=False)

    title = _safe(scraper.title) or "Untitled Recipe"
    ingredients_raw = _safe(scraper.ingredients, []) or []

    instructions = _safe(getattr(scraper, "instructions_list", None)) or []
    if not instructions:
        text = _safe(scraper.instructions, "") or ""
        instructions = [ln.strip() for ln in text.splitlines() if ln.strip()]

    yields = _safe(scraper.yields)
    servings = _servings_from_yields(yields)

    return Recipe(
        id=slugify(title),
        title=title,
        source_url=url,
        source_host=_safe(scraper.host),
        servings=servings or 4,
        original_servings=servings,
        yields=str(yields) if yields else None,
        total_time=_safe(scraper.total_time),
        image_url=_safe(scraper.image),
        ingredients=parse_ingredients(ingredients_raw),
        instructions=instructions,
        nutrition=_safe(scraper.nutrients),
    )
