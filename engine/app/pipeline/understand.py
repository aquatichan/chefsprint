"""Turn a free-text request into a structured :class:`Intent`.

This module ships a dependency-free heuristic parser (regex) that always works. When
a Gemini key is configured the richer AI parser (see :mod:`app.pipeline.ai`) is used
instead; :func:`understand_request` picks the best available.
"""

from __future__ import annotations

import re

from ..config import get_settings
from ..models import Intent

_WORDNUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "dozen": 12,
}
_WORDS = "|".join(_WORDNUM)

# (pattern, is_word_number) — used for both extraction and dish cleanup.
_SERVINGS_PATTERNS = [
    (re.compile(r"\(?\s*(\d+)\s*servings?\s*\)?", re.I), False),
    (re.compile(r"serves?\s*(\d+)", re.I), False),
    (re.compile(r"for\s*(\d+)\s*(?:people|persons?)", re.I), False),
    (re.compile(r"makes?\s*(\d+)", re.I), False),
    (re.compile(rf"serves?\s+({_WORDS})\b", re.I), True),
    (re.compile(rf"for\s+({_WORDS})\s+(?:people|persons?)", re.I), True),
]

_DIET = {
    "low_calorie": r"low[-\s]?cal(?:orie)?",
    "high_protein": r"high[-\s]?protein",
    "keto": r"\bketo\b",
    "vegan": r"\bvegan\b",
    "vegetarian": r"\bvegetarian\b",
    "gluten_free": r"gluten[-\s]?free",
    "dairy_free": r"dairy[-\s]?free",
    "low_carb": r"low[-\s]?carb",
    "kid_friendly": r"kid[-\s]?friendly",
}

_MODIFIERS = [
    "extra spicy", "spicy", "mild", "smoky", "cheesy", "creamy", "fudgy",
    "extra fudge", "extra crispy", "crispy", "tangy", "garlicky", "loaded",
]


def _servings(text: str) -> int | None:
    for pat, is_word in _SERVINGS_PATTERNS:
        m = pat.search(text)
        if m:
            token = m.group(1)
            return _WORDNUM[token.lower()] if is_word else int(token)
    return None


def _excludes(text: str) -> list[str]:
    found: list[str] = []
    for m in re.finditer(r"(?:no|without|free of|hold the)\s+([a-zA-Z][a-zA-Z \-]+)", text, re.I):
        term = re.split(r"\b(?:and|please|i|because|for|to|but)\b", m.group(1), maxsplit=1)[0]
        term = term.strip(" ,.-").lower()
        if term:
            found.append(term)
    for m in re.finditer(r"([a-zA-Z]+)\s+allerg", text, re.I):
        found.append(m.group(1).lower())
    return list(dict.fromkeys(found))


def _clean_dish(text: str, diet: list[str], mods: list[str]) -> str:
    dish = re.sub(r"\(.*?\)", " ", text)  # drop parentheticals
    for pat, _ in _SERVINGS_PATTERNS:
        dish = pat.sub(" ", dish)
    for key in diet:  # strip matched diet phrases so search stays on the dish
        dish = re.sub(_DIET[key], " ", dish, flags=re.I)
    for mod in mods:
        dish = re.sub(re.escape(mod), " ", dish, flags=re.I)
    dish = re.sub(r"\b(that|which|please)\b", " ", dish, flags=re.I)
    dish = re.sub(r"\s+", " ", dish).strip(" ,.-")
    return dish or text.strip()


def understand_heuristic(text: str) -> Intent:
    diet = [key for key, pat in _DIET.items() if re.search(pat, text, re.I)]
    lowered = text.lower()
    mods = [m for m in _MODIFIERS if m in lowered]
    # collapse "extra spicy"+"spicy" style overlaps to the most specific match
    mods = [m for m in mods if not any(m != other and m in other for other in mods)]
    return Intent(
        raw_request=text,
        dish=_clean_dish(text, diet, mods),
        servings=_servings(text),
        exclude=_excludes(text),
        diet=diet,
        modifiers=mods,
    )


def understand_request(text: str, use_ai: bool = True) -> Intent:
    """Best-available request understanding: Gemini if configured and allowed,
    else the deterministic heuristic."""
    settings = get_settings()
    if use_ai and settings.has_gemini:
        try:
            from .ai import understand_with_gemini

            return understand_with_gemini(text)
        except Exception:
            pass
    return understand_heuristic(text)
