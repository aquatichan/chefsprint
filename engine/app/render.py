"""Render a :class:`Cookbook` to self-contained HTML and to PDF.

HTML is produced with Jinja2 (autoescaped — recipe text comes from the web). The PDF
is produced by loading that same HTML in headless Chromium, letting **Paged.js**
paginate it (real page numbers, TOC page references, running headers), then calling
Chromium's ``page.pdf`` with the CSS page size. HTML preview and PDF therefore render
through the identical engine and look the same.
"""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .models import CATEGORIES, Cookbook, Recipe

_APP_DIR = Path(__file__).parent
_TEMPLATES = _APP_DIR / "templates"
_THEMES = _TEMPLATES / "themes"
_VENDOR = _APP_DIR / "static" / "vendor"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

_CATEGORY_ORDER = {name: i for i, name in enumerate(CATEGORIES)}


def _grouped(recipes: list[Recipe]) -> dict[str, list[Recipe]]:
    """Group recipes by category in the canonical category order, titles A–Z."""
    grouped: dict[str, list[Recipe]] = {}
    for recipe in sorted(
        recipes, key=lambda r: (_CATEGORY_ORDER.get(r.category, 99), r.title.lower())
    ):
        grouped.setdefault(recipe.category, []).append(recipe)
    return grouped


def _theme_css(theme: str) -> str:
    path = _THEMES / f"{theme}.css"
    if not path.exists():
        path = _THEMES / "doodle-cream.css"
    return path.read_text(encoding="utf-8")


def render_html(cookbook: Cookbook, *, paged: bool = True) -> str:
    """Render the cookbook to a single self-contained HTML document."""
    pagedjs = ""
    if paged:
        vendor = _VENDOR / "paged.polyfill.js"
        if vendor.exists():
            pagedjs = vendor.read_text(encoding="utf-8")

    grouped = _grouped(cookbook.recipes)
    # Index in document (= page) order: earliest recipe first.
    page_order = [r for recipes in grouped.values() for r in recipes]

    template = _env.get_template("cookbook.html")
    return template.render(
        cookbook=cookbook,
        grouped=grouped,
        index_entries=page_order,
        theme_css=_theme_css(cookbook.theme),
        pagedjs_js=pagedjs,
        date_str=cookbook.created_at.strftime("%B %Y"),
    )


def render_pdf(html: str, *, timeout_ms: int = 45000) -> bytes:
    """Render HTML (with Paged.js) to PDF bytes via headless Chromium.

    Synchronous Playwright — call inside a worker thread when used from async code
    (e.g. Starlette's ``run_in_threadpool``).
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        page = browser.new_page()
        page.set_content(html, wait_until="load", timeout=timeout_ms)

        # Let web fonts finish so glyphs are embedded in the PDF.
        try:
            page.wait_for_function(
                "document.fonts ? document.fonts.status === 'loaded' : true",
                timeout=10000,
            )
        except Exception:
            pass

        # Wait for Paged.js pagination to complete; fall back to native print.
        try:
            page.wait_for_function("window.__pagedReady === true", timeout=timeout_ms)
        except Exception:
            pass

        pdf = page.pdf(
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        )
        browser.close()
        return pdf


def save_cookbook(cookbook: Cookbook, out_dir: str | Path, stem: str = "cookbook") -> dict:
    """Render + write ``<stem>.html`` and ``<stem>.pdf`` into ``out_dir``."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    html = render_html(cookbook, paged=True)
    html_path = out / f"{stem}.html"
    html_path.write_text(html, encoding="utf-8")

    pdf_bytes = render_pdf(html)
    pdf_path = out / f"{stem}.pdf"
    pdf_path.write_bytes(pdf_bytes)

    return {"html": str(html_path), "pdf": str(pdf_path), "pages": None, "bytes": len(pdf_bytes)}
