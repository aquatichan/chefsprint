"""Per-serving nutrition estimation for a finished recipe.

This is an AI-only feature: without a Gemini key (or with ``use_ai=False``) we
return ``None`` and the cookbook simply omits the nutrition card. Estimates are
best-effort and clearly labelled as such in the rendered output.
"""

from __future__ import annotations

from ..config import get_settings
from ..models import Recipe


def estimate_nutrition(recipe: Recipe, use_ai: bool = True) -> dict | None:
    """Return a per-serving nutrition dict, or ``None`` when unavailable.

    Runs only with AI enabled and a configured Gemini key; any failure degrades
    to ``None`` so a bad estimate never blocks the cookbook.
    """
    if not use_ai or not recipe.ingredients:
        return None
    settings = get_settings()
    if not settings.has_gemini:
        return None
    try:
        from .ai import estimate_nutrition_with_gemini

        return estimate_nutrition_with_gemini(recipe)
    except Exception:
        return None
