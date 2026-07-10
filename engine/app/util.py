"""Small shared helpers."""

from __future__ import annotations

import re
import unicodedata


def slugify(text: str, maxlen: int = 60) -> str:
    """Turn a title into a URL/id-safe slug."""
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:maxlen].strip("-") or "recipe"
