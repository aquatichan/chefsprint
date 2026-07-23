"""Runtime configuration and one-time NLTK bootstrap.

The ingredient parser (``ingredient-parser-nlp``) relies on a couple of NLTK data
packages. On fresh machines (and notably on macOS, where the system Python often
cannot verify SSL certificates) the automatic download fails, so we download them
explicitly using certifi's CA bundle. In production these are baked into the image.
"""

from __future__ import annotations

import os
import ssl
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

try:  # optional: load a local .env when present
    from dotenv import load_dotenv

    # Explicit path (engine/.env) so discovery doesn't depend on the cwd the
    # server happened to be launched from; falls back to the standard search.
    _env = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(_env if _env.exists() else None)
except Exception:  # pragma: no cover - dotenv is optional
    pass


# NLTK resources required by ingredient-parser-nlp: (find-path, download-name)
_NLTK_RESOURCES = [
    ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
    ("tokenizers/punkt_tab", "punkt_tab"),
]


@lru_cache(maxsize=1)
def ensure_nltk_data() -> None:
    """Make sure NLTK data needed for ingredient parsing is available.

    Idempotent and cached, so it is safe to call before every parse.
    """
    import nltk

    missing = []
    for find_path, name in _NLTK_RESOURCES:
        try:
            nltk.data.find(find_path)
        except LookupError:
            missing.append(name)

    if not missing:
        return

    # Work around macOS "CERTIFICATE_VERIFY_FAILED" by pointing SSL at certifi.
    try:
        import certifi

        ssl._create_default_https_context = lambda *a, **k: ssl.create_default_context(
            cafile=certifi.where()
        )
    except Exception:  # pragma: no cover
        pass

    for name in missing:
        nltk.download(name, quiet=True)


@dataclass(frozen=True)
class Settings:
    """Environment-driven settings. Missing AI/search keys degrade gracefully."""

    gemini_api_key: str | None = None
    tavily_api_key: str | None = None
    # Cheap structured-output model for parsing requests; a stronger one for edits;
    # an image model for the per-recipe dish art.
    gemini_model_parse: str = "gemini-2.5-flash-lite"
    gemini_model_modify: str = "gemini-flash-latest"
    gemini_model_image: str = "gemini-2.5-flash-image"
    # A realistic browser UA — many recipe sites (and DuckDuckGo) reject bot UAs
    # with 403/202, which would otherwise sink the scrape.
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    )
    request_timeout: float = 20.0

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_tavily(self) -> bool:
        return bool(self.tavily_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
        tavily_api_key=os.getenv("TAVILY_API_KEY"),
        gemini_model_parse=os.getenv("GEMINI_MODEL_PARSE", "gemini-2.5-flash-lite"),
        gemini_model_modify=os.getenv("GEMINI_MODEL_MODIFY", "gemini-flash-latest"),
        gemini_model_image=os.getenv("GEMINI_MODEL_IMAGE", "gemini-2.5-flash-image"),
    )
