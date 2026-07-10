"""Parse raw ingredient lines into structured :class:`ParsedIngredient` objects.

Primary path uses ``ingredient-parser-nlp`` (an ML sequence labeller). If it is
unavailable or errors on a line, we fall back to a lightweight regex parser so the
pipeline never hard-fails on a single messy ingredient.
"""

from __future__ import annotations

import re
from fractions import Fraction

from ..config import ensure_nltk_data
from ..models import ParsedIngredient

# ---------------------------------------------------------------------------
# Regex fallback
# ---------------------------------------------------------------------------

_UNICODE_FRACTIONS = {
    "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅙": 1 / 6, "⅚": 5 / 6,
}

_KNOWN_UNITS = {
    "cup": "cup", "cups": "cup", "c": "cup",
    "tablespoon": "tablespoon", "tablespoons": "tablespoon", "tbsp": "tablespoon", "tbsps": "tablespoon", "tbs": "tablespoon",
    "teaspoon": "teaspoon", "teaspoons": "teaspoon", "tsp": "teaspoon", "tsps": "teaspoon",
    "ounce": "ounce", "ounces": "ounce", "oz": "ounce",
    "pound": "pound", "pounds": "pound", "lb": "pound", "lbs": "pound",
    "gram": "gram", "grams": "gram", "g": "gram",
    "kilogram": "kilogram", "kg": "kilogram",
    "milliliter": "milliliter", "ml": "milliliter",
    "liter": "liter", "litre": "liter", "l": "liter",
    "clove": "clove", "cloves": "clove",
    "can": "can", "cans": "can",
    "pinch": "pinch", "slice": "slice", "slices": "slice",
    "stick": "stick", "sticks": "stick",
    "quart": "quart", "pint": "pint", "gallon": "gallon",
}

_LEADING_QTY = re.compile(
    r"^\s*(?P<qty>\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞⅙⅚])"
    r"(?:\s*[-–]\s*(?P<qty2>\d+(?:\.\d+)?|\d+/\d+))?"
)


def _num(token: str) -> float:
    token = token.strip()
    if token in _UNICODE_FRACTIONS:
        return _UNICODE_FRACTIONS[token]
    if " " in token:  # mixed number like "1 1/2"
        whole, frac = token.split(None, 1)
        return float(whole) + float(Fraction(frac))
    if "/" in token:
        return float(Fraction(token))
    return float(token)


def parse_fallback(line: str) -> ParsedIngredient:
    """A dependency-free best-effort parser used when the ML parser is unavailable."""
    text = line.strip()
    quantity = quantity_max = None
    unit = None
    rest = text

    m = _LEADING_QTY.match(text)
    if m:
        quantity = _num(m.group("qty"))
        if m.group("qty2"):
            quantity_max = _num(m.group("qty2"))
        rest = text[m.end():].strip()
        # optional unit token
        parts = rest.split(None, 1)
        if parts:
            candidate = parts[0].lower().strip(".")
            if candidate in _KNOWN_UNITS:
                unit = _KNOWN_UNITS[candidate]
                rest = parts[1] if len(parts) > 1 else ""

    name, _, comment = rest.partition(",")
    return ParsedIngredient(
        raw=line,
        quantity=quantity,
        quantity_max=quantity_max,
        unit=unit,
        name=name.strip() or text,
        comment=(comment.strip() or None),
    )


# ---------------------------------------------------------------------------
# ML parser (ingredient-parser-nlp)
# ---------------------------------------------------------------------------


def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_ingredient_line(line: str) -> ParsedIngredient:
    """Parse one ingredient line; ML first, regex fallback on any failure."""
    if not line or not line.strip():
        return ParsedIngredient(raw=line, name=line.strip())

    try:
        ensure_nltk_data()
        from ingredient_parser import parse_ingredient as _parse

        parsed = _parse(line)

        name = " ".join(n.text for n in parsed.name).strip() if parsed.name else ""

        quantity = quantity_max = unit = None
        confidence = None
        if parsed.amount:
            amt = parsed.amount[0]
            quantity = _to_float(amt.quantity)
            quantity_max = _to_float(getattr(amt, "quantity_max", None))
            if quantity_max == quantity:
                quantity_max = None
            unit = str(amt.unit) if getattr(amt, "unit", None) else None
            confidence = getattr(amt, "confidence", None)

        preparation = parsed.preparation.text if parsed.preparation else None
        comment = parsed.comment.text if parsed.comment else None

        if not name:  # ML gave us nothing useful; fall back
            return parse_fallback(line)

        return ParsedIngredient(
            raw=line,
            quantity=quantity,
            quantity_max=quantity_max,
            unit=unit,
            name=name,
            preparation=preparation,
            comment=comment,
            confidence=confidence,
        )
    except Exception:
        return parse_fallback(line)


def parse_ingredients(lines: list[str]) -> list[ParsedIngredient]:
    return [parse_ingredient_line(line) for line in lines if line and line.strip()]
