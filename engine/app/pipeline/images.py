"""Per-recipe dish art for the cookbook.

Preferred path: Gemini's image model generates a square studio-style photo of the
dish. Fallback: inline the recipe's scraped source photo. Either way the result is a
``data:`` URI so the cookbook HTML/PDF stays fully self-contained. Returns ``None``
when neither path works — the template simply omits the image.
"""

from __future__ import annotations

import base64

import httpx
import requests

from ..config import get_settings
from ..models import Recipe

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Keep embedded images sane: cap fallback downloads at ~3 MB.
_MAX_FALLBACK_BYTES = 3 * 1024 * 1024

_PROMPT = (
    "A single square (1:1) overhead food photograph of {title}, freshly plated on "
    "ceramic dishware over a warm cream linen background, soft natural window light, "
    "shallow depth of field, appetizing, cookbook-quality styling. No text, no "
    "watermarks, no hands, no borders."
)


def _gemini_image(recipe: Recipe) -> str | None:
    settings = get_settings()
    resp = httpx.post(
        _ENDPOINT.format(model=settings.gemini_model_image),
        params={"key": settings.gemini_api_key},
        json={
            "contents": [{"parts": [{"text": _PROMPT.format(title=recipe.title)}]}],
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    for candidate in resp.json().get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{mime};base64,{inline['data']}"
    return None


def _scraped_image(recipe: Recipe) -> str | None:
    if not recipe.image_url:
        return None
    settings = get_settings()
    resp = requests.get(
        recipe.image_url,
        headers={"User-Agent": settings.user_agent},
        timeout=settings.request_timeout,
    )
    resp.raise_for_status()
    if len(resp.content) > _MAX_FALLBACK_BYTES:
        return None
    mime = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
    if not mime.startswith("image/"):
        return None
    return f"data:{mime};base64,{base64.b64encode(resp.content).decode()}"


def fetch_recipe_art(recipe: Recipe, use_ai: bool = True) -> str | None:
    """Best-available square dish image as a data URI (AI first, scraped second)."""
    settings = get_settings()
    if use_ai and settings.has_gemini:
        try:
            art = _gemini_image(recipe)
            if art:
                return art
        except Exception:
            pass
    try:
        return _scraped_image(recipe)
    except Exception:
        return None
