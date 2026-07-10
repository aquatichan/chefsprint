"""Assign a cookbook category to a recipe (keyword heuristic).

Gemini can override this later; the heuristic keeps categories working with no key.
"""

from __future__ import annotations

import re

from ..models import CATEGORIES, Recipe

_KEYWORDS = {
    "Dessert": [
        "brownie", "cake", "cookie", "ice cream", "pie", "pudding", "cupcake",
        "tart", "frosting", "cheesecake", "mousse", "truffle", "fudge", "donut",
        "doughnut", "cobbler", "macaron", "custard", "gelato", "sorbet",
    ],
    "Breakfast": [
        "pancake", "waffle", "omelet", "omelette", "scrambled", "frittata",
        "oatmeal", "granola", "cereal", "french toast", "muffin", "bagel",
        "hash brown", "breakfast",
    ],
    "Drinks": [
        "smoothie", "juice", "cocktail", "latte", "milkshake", "shake",
        "lemonade", "margarita", "mojito", "punch", "iced tea", "cold brew",
        "frappe", "eggnog",
    ],
    "Snacks": [
        "chips", "dip", "popcorn", "hummus", "cracker", "trail mix", "nachos",
        "pretzel", "granola bar", "energy bar", "snack",
    ],
    "Lunch": [
        "sandwich", "salad", "soup", "wrap", "panini", "quesadilla", "burger",
    ],
}

_MEAT = [
    "chicken", "beef", "pork", "bacon", "sausage", "turkey", "lamb", "fish",
    "salmon", "tuna", "shrimp", "prawn", "anchovy", "ham", "steak", "meat",
    "gelatin", "duck", "veal", "crab", "lobster", "clam",
]


def _blob(recipe: Recipe) -> str:
    return " ".join([recipe.title, *(i.name for i in recipe.ingredients)]).lower()


def _has(blob: str, keyword: str) -> bool:
    """Match a keyword at a word start (so "cake" doesn't fire inside "pancake"),
    while still allowing plural/suffix forms ("pancake" matches "pancakes")."""
    return re.search(r"\b" + re.escape(keyword), blob) is not None


def categorize(recipe: Recipe, hint: str | None = None) -> str:
    """Return one of :data:`CATEGORIES` for the recipe."""
    if hint and hint.strip().title() in CATEGORIES:
        return hint.strip().title()

    blob = _blob(recipe)
    # Breakfast before Dessert so pancakes/waffles win over the "cake" family.
    for cat in ("Breakfast", "Dessert", "Drinks", "Snacks", "Lunch"):
        if any(_has(blob, kw) for kw in _KEYWORDS[cat]):
            return cat

    # A savory main with no meat/seafood reads as Vegetarian; otherwise Dinner.
    if not any(_has(blob, m) for m in _MEAT):
        return "Vegetarian"
    return "Dinner"
