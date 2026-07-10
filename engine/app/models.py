"""Core domain models for the recipe engine.

Quantities are stored as plain floats + a normalized (singular) unit string so the
models are trivially JSON/Firestore serializable. Pretty rendering (fractions,
pluralization) happens at display time via :mod:`app.units`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .units import format_range, pluralize_unit

# The fixed set of cookbook categories from the brief.
CATEGORIES = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Dessert",
    "Vegetarian",
    "Drinks",
    "Snacks",
]


class ParsedIngredient(BaseModel):
    """A single ingredient line, broken into structured parts."""

    raw: str
    quantity: Optional[float] = None
    quantity_max: Optional[float] = None  # set when the amount is a range
    unit: Optional[str] = None  # normalized, singular (e.g. "cup", "gram")
    name: str = ""
    preparation: Optional[str] = None  # e.g. "sifted", "finely chopped"
    comment: Optional[str] = None  # e.g. "to taste", "plus more for dusting"
    optional: bool = False
    confidence: Optional[float] = None

    @property
    def amount_display(self) -> str:
        """The quantity + unit part, e.g. "2½ cups" (empty if no amount)."""
        qty = format_range(self.quantity, self.quantity_max)
        unit = pluralize_unit(self.unit, self.quantity)
        return " ".join(p for p in (qty, unit) if p)

    @property
    def text_display(self) -> str:
        """The name + preparation + comment part, e.g. "all-purpose flour, sifted"."""
        line = self.name
        if self.preparation:
            line = f"{line}, {self.preparation}"
        if self.comment:
            line = f"{line}, {self.comment}"
        if self.optional and "optional" not in (self.comment or "").lower():
            line = f"{line} (optional)"
        return line

    def display(self) -> str:
        """Render as a full human-friendly line, e.g. "2½ cups all-purpose flour, sifted"."""
        amount = self.amount_display
        return f"{amount} {self.text_display}".strip() if amount else self.text_display


class Recipe(BaseModel):
    """A scraped, parsed, scaled (and possibly modified) recipe."""

    id: str = ""  # slug, unique within a cookbook
    title: str
    request: Optional[str] = None  # the original user request that produced it
    source_url: Optional[str] = None
    source_host: Optional[str] = None
    servings: int = 4  # current (target) servings
    original_servings: Optional[int] = None
    yields: Optional[str] = None
    total_time: Optional[int] = None  # minutes
    category: str = "Dinner"
    image_url: Optional[str] = None  # scraped source photo
    image_data: Optional[str] = None  # data: URI embedded in the cookbook (AI or scraped)
    ingredients: list[ParsedIngredient] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)  # chef/modification notes
    nutrition: Optional[dict] = None


class Intent(BaseModel):
    """Structured interpretation of a free-text recipe request."""

    raw_request: str
    dish: str
    servings: Optional[int] = None
    exclude: list[str] = Field(default_factory=list)  # allergens / avoid
    diet: list[str] = Field(default_factory=list)  # e.g. low_calorie, high_protein
    variants: list[str] = Field(default_factory=list)  # e.g. regular, extra_fudge
    modifiers: list[str] = Field(default_factory=list)  # e.g. spicy
    category_hint: Optional[str] = None


class Cookbook(BaseModel):
    """A compiled collection of recipes ready to render."""

    title: str = "My Cookbook"
    subtitle: Optional[str] = None
    theme: str = "doodle-cream"
    recipes: list[Recipe] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
