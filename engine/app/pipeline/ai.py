"""Gemini-powered request understanding and recipe modification.

Uses the Gemini REST API directly via httpx (no SDK, no gRPC — friendly to new
Python versions) with structured JSON output. Both entry points raise on failure so
their callers can fall back to the deterministic path.
"""

from __future__ import annotations

import json

import httpx

from ..config import get_settings
from ..models import Intent, Recipe
from .parse import parse_ingredients

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_DIET_TAGS = [
    "low_calorie", "high_protein", "keto", "vegan", "vegetarian",
    "gluten_free", "dairy_free", "low_carb", "kid_friendly",
]
_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Vegetarian", "Drinks", "Snacks"]


def _gemini_json(model: str, prompt: str, schema: dict | None = None) -> dict:
    """Call Gemini and return parsed JSON from the first candidate."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("no gemini api key")

    generation_config: dict = {"responseMimeType": "application/json", "temperature": 0.2}
    if schema is not None:
        generation_config["responseSchema"] = schema

    resp = httpx.post(
        _ENDPOINT.format(model=model),
        params={"key": settings.gemini_api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        },
        timeout=settings.request_timeout,
    )
    resp.raise_for_status()
    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(text)


# --------------------------------------------------------------------- understand

_UNDERSTAND_SCHEMA = {
    "type": "object",
    "properties": {
        "dish": {"type": "string"},
        "servings": {"type": "integer", "nullable": True},
        "exclude": {"type": "array", "items": {"type": "string"}},
        "diet": {"type": "array", "items": {"type": "string"}},
        "variants": {"type": "array", "items": {"type": "string"}},
        "modifiers": {"type": "array", "items": {"type": "string"}},
        "category_hint": {"type": "string", "nullable": True},
    },
    "required": ["dish"],
}


def understand_with_gemini(text: str) -> Intent:
    prompt = f"""Convert this home cook's recipe request into structured JSON.

Rules:
- dish: the core searchable dish name only. Strip serving counts, diet words, and parentheticals (e.g. "chicken tikka masala").
- servings: integer if specified (convert words like "four" to 4), else null.
- exclude: ingredients/allergens to avoid, lowercase (e.g. ["peanuts"]).
- diet: any of {_DIET_TAGS}.
- variants: distinct versions requested (e.g. ["regular", "extra fudge"]).
- modifiers: flavor/style tweaks (e.g. ["spicy"]).
- category_hint: one of {_CATEGORIES}, or null.

Request: {text!r}"""
    data = _gemini_json(get_settings().gemini_model_parse, prompt, _UNDERSTAND_SCHEMA)
    return Intent(
        raw_request=text,
        dish=data.get("dish") or text,
        servings=data.get("servings"),
        exclude=data.get("exclude") or [],
        diet=data.get("diet") or [],
        variants=data.get("variants") or [],
        modifiers=data.get("modifiers") or [],
        category_hint=data.get("category_hint"),
    )


# ------------------------------------------------------------------------ modify

_MODIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "ingredients": {"type": "array", "items": {"type": "string"}},
        "instructions": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "array", "items": {"type": "string"}},
        "title_suffix": {"type": "string"},
    },
    "required": ["ingredients", "instructions"],
}


def modify_with_gemini(recipe: Recipe, intent: Intent) -> Recipe:
    ingredient_lines = "\n".join(f"- {ing.display()}" for ing in recipe.ingredients)
    step_lines = "\n".join(f"{i}. {s}" for i, s in enumerate(recipe.instructions, 1))

    prompt = f"""You are a careful recipe editor. Modify the recipe below to honor the
requested changes while keeping it a real, cookable dish. Do NOT rescale — keep
quantities for {recipe.servings} servings.

Requested changes:
- must NOT contain: {intent.exclude or "—"}
- diet goals: {intent.diet or "—"}
- variants: {intent.variants or "—"}
- flavor modifiers: {intent.modifiers or "—"}

For excluded ingredients, remove them and substitute something safe/appropriate.
For diet goals, swap ingredients sensibly. Add 1–3 short chef's notes explaining what
you changed and why. Keep every ingredient line self-contained with its amount.

RECIPE: {recipe.title}
Ingredients:
{ingredient_lines}
Instructions:
{step_lines}"""

    data = _gemini_json(get_settings().gemini_model_modify, prompt, _MODIFY_SCHEMA)

    new_ingredients = data.get("ingredients") or []
    new_instructions = data.get("instructions") or []
    if new_ingredients:
        recipe.ingredients = parse_ingredients(new_ingredients)
    if new_instructions:
        recipe.instructions = new_instructions
    recipe.notes.extend(n for n in (data.get("notes") or []) if n)

    suffix = (data.get("title_suffix") or "").strip()
    if suffix and suffix.lower() not in recipe.title.lower():
        recipe.title = f"{recipe.title} {suffix}"
    return recipe
