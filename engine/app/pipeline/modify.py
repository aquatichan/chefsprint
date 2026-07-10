"""Apply requested modifications (allergens, diet, variants, heat) to a recipe.

With a Gemini key this delegates to the AI editor (:mod:`app.pipeline.ai`). Without
one, it records the requested tweaks as chef notes so the intent is at least visible
and acknowledged in the cookbook.
"""

from __future__ import annotations

from ..config import get_settings
from ..models import Intent, Recipe

_DIET_LABEL = {
    "low_calorie": "low-calorie",
    "high_protein": "high-protein",
    "keto": "keto",
    "vegan": "vegan",
    "vegetarian": "vegetarian",
    "gluten_free": "gluten-free",
    "dairy_free": "dairy-free",
    "low_carb": "low-carb",
    "kid_friendly": "kid-friendly",
}


def _wants_change(intent: Intent) -> bool:
    return bool(intent.exclude or intent.diet or intent.modifiers or intent.variants)


def apply_modifications(recipe: Recipe, intent: Intent, use_ai: bool = True) -> Recipe:
    if not _wants_change(intent):
        return recipe

    settings = get_settings()
    if use_ai and settings.has_gemini:
        try:
            from .ai import modify_with_gemini

            return modify_with_gemini(recipe, intent)
        except Exception:
            pass

    # No-AI fallback: acknowledge the requested changes as chef notes.
    notes: list[str] = []
    if intent.exclude:
        notes.append(
            "Avoid " + ", ".join(intent.exclude)
            + " — double-check labels and substitute where needed."
        )
    if intent.diet:
        labels = ", ".join(_DIET_LABEL.get(d, d) for d in intent.diet)
        notes.append(f"Requested {labels}; adjust ingredients to suit.")
    if intent.modifiers:
        notes.append("Style: " + ", ".join(intent.modifiers) + ".")
    recipe.notes.extend(notes)
    return recipe
