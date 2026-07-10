"""Deterministically scale a recipe to a target number of servings.

No AI here on purpose — scaling is exact arithmetic. We multiply every quantity by
``target / original``; pretty fraction rendering happens later at display time.
"""

from __future__ import annotations

from ..models import Recipe


def _scaled(value: float | None, factor: float) -> float | None:
    return None if value is None else value * factor


def scale_recipe(recipe: Recipe, target_servings: int | None) -> Recipe:
    """Return a copy of ``recipe`` scaled to ``target_servings``.

    If the source servings are unknown (or no target was requested), quantities are
    left untouched and we just record the serving count.
    """
    # Only scale off a *known* source serving count. Guessing a base (e.g. the
    # model default) would silently produce wrong amounts, so we don't.
    original = recipe.original_servings
    result = recipe.model_copy(deep=True)

    if target_servings and original and original > 0 and target_servings != original:
        factor = target_servings / original
        for ing in result.ingredients:
            ing.quantity = _scaled(ing.quantity, factor)
            ing.quantity_max = _scaled(ing.quantity_max, factor)
        result.servings = target_servings
    else:
        result.servings = target_servings or original or recipe.servings

    return result
