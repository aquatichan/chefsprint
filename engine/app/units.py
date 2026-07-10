"""Human-friendly quantity + unit formatting for the cookbook.

Cooking amounts read best as fractions ("1½ cups", "¾ tsp"), so we snap floats to
common kitchen fractions and render them with unicode glyphs.
"""

from __future__ import annotations

from fractions import Fraction

# Common cooking fractions -> unicode vulgar fraction glyphs.
_VULGAR: dict[Fraction, str] = {
    Fraction(1, 2): "½",
    Fraction(1, 3): "⅓",
    Fraction(2, 3): "⅔",
    Fraction(1, 4): "¼",
    Fraction(3, 4): "¾",
    Fraction(1, 8): "⅛",
    Fraction(3, 8): "⅜",
    Fraction(5, 8): "⅝",
    Fraction(7, 8): "⅞",
    Fraction(1, 6): "⅙",
    Fraction(5, 6): "⅚",
}

# Units that pluralise by appending "s"; abbreviations stay as-is.
_PLURALISABLE = {
    "cup",
    "tablespoon",
    "teaspoon",
    "ounce",
    "pound",
    "clove",
    "pinch",
    "can",
    "slice",
    "stick",
    "sprig",
    "stalk",
    "head",
    "piece",
    "package",
    "bunch",
    "leaf",
    "quart",
    "pint",
    "gallon",
    "liter",
    "litre",
}
_IRREGULAR = {"leaf": "leaves"}


def format_quantity(q: float | None) -> str:
    """Render a quantity as a friendly string, e.g. 2.5 -> "2½", 0.75 -> "¾"."""
    if q is None:
        return ""
    if q == 0:
        return "0"

    # Snap to the nearest sensible kitchen fraction (denominator <= 8).
    frac = Fraction(q).limit_denominator(16)
    whole, rem = divmod(frac.numerator, frac.denominator)
    remainder = Fraction(rem, frac.denominator)

    if remainder == 0:
        return str(whole)

    glyph = _VULGAR.get(remainder)
    if glyph:
        return f"{whole}{glyph}" if whole else glyph

    # Fall back to a tidy decimal (strip trailing zeros).
    text = f"{float(q):.2f}".rstrip("0").rstrip(".")
    return text


def format_range(lo: float | None, hi: float | None) -> str:
    """Render an amount that may be a range ("2–3")."""
    if lo is None:
        return ""
    if hi is None or hi == lo:
        return format_quantity(lo)
    return f"{format_quantity(lo)}–{format_quantity(hi)}"


def pluralize_unit(unit: str | None, qty: float | None) -> str:
    """Pluralise a spelled-out unit when the quantity warrants it."""
    if not unit:
        return ""
    # Singular for exactly one AND for fractional amounts under one ("½ cup").
    if qty is None or qty <= 1:
        return unit
    base = unit.lower()
    if base in _IRREGULAR:
        return _IRREGULAR[base]
    if base in _PLURALISABLE and not unit.endswith("s"):
        return unit + "s"
    return unit
