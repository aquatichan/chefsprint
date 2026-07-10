"""Command-line entry point.

    python -m app.cli "brownies (24 servings)" "chicken alfredo that serves 8"

Prints live progress in the style of the project brief, then writes
``out/cookbook.pdf`` and ``out/cookbook.html``.
"""

from __future__ import annotations

import argparse
import sys

from .render import save_cookbook
from .run import build_cookbook

_STAGE_HEADER = {
    "search": "\n🔎 Searching…",
    "scale": "\n⚖️  Scaling…",
    "art": "\n🎨 Illustrating…",
    "build": "\n📖 Building cookbook…",
}


def _make_printer():
    state = {"stage": None}

    def emit(event: dict) -> None:
        stage = event.get("stage")
        if stage != state["stage"]:
            state["stage"] = stage
            header = _STAGE_HEADER.get(stage)
            if header:
                print(header)
        if stage == "search":
            if event.get("ok"):
                print(f"  ✓ {event['title']}  ({event.get('host') or '—'})")
            else:
                print(f"  ✗ {event['request']}: {event.get('message')}")
        elif stage == "scale":
            print(f"  ✓ {event['title']} → {event['servings']} servings")
        elif stage == "art":
            mark = "✓" if event.get("ok") else "–"
            print(f"  {mark} {event['title']}")

    return emit


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="chefsprint",
        description="Compile natural-language recipe requests into a cookbook PDF.",
    )
    parser.add_argument("requests", nargs="+",
                        help="recipe requests, e.g. 'brownies (24 servings)'")
    parser.add_argument("-o", "--out", default="out", help="output directory")
    parser.add_argument("-t", "--title", default=None, help="cookbook title")
    parser.add_argument("--subtitle", default=None)
    parser.add_argument("--theme", default="doodle-cream")
    parser.add_argument("--no-ai", action="store_true",
                        help="skip Gemini (deterministic parsing, no image generation)")
    args = parser.parse_args(argv)

    book = build_cookbook(
        args.requests,
        title=args.title,
        subtitle=args.subtitle,
        theme=args.theme,
        use_ai=not args.no_ai,
        progress=_make_printer(),
    )
    if not book.recipes:
        print("\nNo recipes could be built. Try rephrasing a request.", file=sys.stderr)
        return 1

    result = save_cookbook(book, args.out)
    print("\n✅ Done!")
    print(f"   → {result['pdf']}  ({result['bytes'] // 1024} KB)")
    print(f"   → {result['html']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
