"""Deterministic pipeline tests (no network, no AI)."""

from __future__ import annotations

from app.models import ParsedIngredient, Recipe
from app.pipeline.categorize import categorize
from app.pipeline.parse import parse_fallback, parse_ingredient_line
from app.pipeline.scale import scale_recipe
from app.pipeline.understand import understand_heuristic
from app.units import format_quantity, pluralize_unit


# --- quantity / unit formatting ------------------------------------------------

def test_format_quantity_fractions():
    assert format_quantity(0.5) == "½"
    assert format_quantity(2.5) == "2½"
    assert format_quantity(0.75) == "¾"
    assert format_quantity(3) == "3"
    assert format_quantity(1 / 3) == "⅓"
    assert format_quantity(None) == ""


def test_pluralize_singular_under_one():
    assert pluralize_unit("cup", 0.5) == "cup"
    assert pluralize_unit("cup", 1) == "cup"
    assert pluralize_unit("cup", 2) == "cups"
    assert pluralize_unit("tablespoon", 3) == "tablespoons"
    assert pluralize_unit("g", 200) == "g"  # abbreviations don't pluralize


# --- parsing -------------------------------------------------------------------

def test_parse_fallback_basic():
    ing = parse_fallback("3 cloves garlic, minced")
    assert ing.quantity == 3
    assert ing.unit == "clove"
    assert "garlic" in ing.name.lower()


def test_parse_fallback_unicode_fraction():
    ing = parse_fallback("½ cup butter")
    assert ing.quantity == 0.5
    assert ing.unit == "cup"


def test_parse_line_ml_or_fallback():
    ing = parse_ingredient_line("2 1/2 cups all-purpose flour, sifted")
    assert ing.quantity == 2.5
    assert ing.unit in ("cup", "cups")
    assert "flour" in ing.name.lower()


# --- scaling -------------------------------------------------------------------

def _recipe(servings, qty):
    return Recipe(
        title="Test",
        servings=servings,
        original_servings=servings,
        ingredients=[ParsedIngredient(raw="x", quantity=qty, unit="cup", name="flour")],
    )


def test_scale_up():
    scaled = scale_recipe(_recipe(4, 2.0), 8)
    assert scaled.servings == 8
    assert scaled.ingredients[0].quantity == 4.0


def test_scale_down():
    scaled = scale_recipe(_recipe(8, 4.0), 2)
    assert scaled.servings == 2
    assert scaled.ingredients[0].quantity == 1.0


def test_scale_unknown_original_leaves_quantities():
    r = Recipe(title="T", servings=4, original_servings=None,
               ingredients=[ParsedIngredient(raw="x", quantity=2.0, unit="cup", name="flour")])
    scaled = scale_recipe(r, 12)
    assert scaled.ingredients[0].quantity == 2.0  # untouched
    assert scaled.servings == 12


# --- understanding -------------------------------------------------------------

def test_understand_digit_servings_and_exclude():
    it = understand_heuristic("chicken tikka masala (no peanuts, I have a peanut allergy)")
    assert it.dish.lower().startswith("chicken tikka masala")
    assert "peanuts" in it.exclude


def test_understand_word_servings():
    it = understand_heuristic("meat lovers pizza that serves four people")
    assert it.servings == 4
    assert "serves" not in it.dish.lower()


def test_understand_diet_stripped_from_dish():
    it = understand_heuristic("low calorie high protein vanilla ice cream")
    assert set(it.diet) == {"low_calorie", "high_protein"}
    assert "vanilla ice cream" in it.dish.lower()
    assert "protein" not in it.dish.lower()


# --- categorize ----------------------------------------------------------------

def test_categorize_dessert():
    r = Recipe(title="Best Brownies",
               ingredients=[ParsedIngredient(raw="x", name="cocoa powder")])
    assert categorize(r) == "Dessert"


def test_categorize_hint_wins():
    r = Recipe(title="Mystery", ingredients=[])
    assert categorize(r, hint="breakfast") == "Breakfast"


def test_categorize_pancakes_not_dessert():
    # "cake" must not match inside "pancake"
    r = Recipe(title="Good Old-Fashioned Pancakes",
               ingredients=[ParsedIngredient(raw="x", name="flour")])
    assert categorize(r) == "Breakfast"


def test_categorize_meat_word_boundary():
    # "ham" must not match inside "graham"
    r = Recipe(title="Graham Cracker Crust",
               ingredients=[ParsedIngredient(raw="x", name="graham crackers")])
    assert categorize(r) != "Dinner"  # no real meat -> Vegetarian/other, not a meat main
