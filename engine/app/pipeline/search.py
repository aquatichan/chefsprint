"""Find a recipe URL for a dish.

Prefers Tavily (configured via ``TAVILY_API_KEY``) and falls back to a keyless
DuckDuckGo HTML search, so the pipeline works out of the box before any keys are set.
Obvious non-recipe domains are filtered out.
"""

from __future__ import annotations

from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup

from ..config import get_settings

_BLOCKED = {
    "pinterest.com", "youtube.com", "youtu.be", "reddit.com", "amazon.com",
    "facebook.com", "instagram.com", "tiktok.com", "wikipedia.org", "x.com",
    "twitter.com", "yelp.com",
}


def _acceptable(url: str) -> bool:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return bool(host) and not any(b in host for b in _BLOCKED)


def _dedupe(urls: list[str]) -> list[str]:
    return list(dict.fromkeys(u for u in urls if u and _acceptable(u)))


def _tavily(query: str, settings, limit: int) -> list[str]:
    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.tavily_api_key,
                "query": f"{query} recipe",
                "max_results": max(limit, 6),
                "search_depth": "basic",
            },
            timeout=settings.request_timeout,
        )
        resp.raise_for_status()
        return _dedupe([r.get("url", "") for r in resp.json().get("results", [])])
    except Exception:
        return []


def _decode_ddg(href: str) -> str | None:
    if "uddg=" in href:  # redirect form (older endpoints)
        params = parse_qs(urlparse(href).query)
        if "uddg" in params:
            return unquote(params["uddg"][0])
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http") and "duckduckgo.com" not in href:
        return href
    return None


def _duckduckgo(query: str, settings, limit: int) -> list[str]:
    """Keyless fallback via the DuckDuckGo Lite endpoint (returns direct links)."""
    try:
        resp = requests.post(
            "https://lite.duckduckgo.com/lite/",
            data={"q": f"{query} recipe"},
            headers={"User-Agent": settings.user_agent},
            timeout=settings.request_timeout,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        urls = [_decode_ddg(a.get("href", "")) for a in soup.select("a")]
        return _dedupe([u for u in urls if u])[:limit]
    except Exception:
        return []


def search_recipe_urls(query: str, limit: int = 6) -> list[str]:
    """Return up to ``limit`` candidate recipe URLs (best first)."""
    settings = get_settings()
    urls: list[str] = []
    if settings.has_tavily:
        urls = _tavily(query, settings, limit)
    if not urls:
        urls = _duckduckgo(query, settings, limit)
    return urls[:limit]


def search_recipe_url(query: str) -> str | None:
    """Return the single best candidate recipe URL for ``query`` (or None)."""
    urls = search_recipe_urls(query, limit=1)
    return urls[0] if urls else None
