# Chefsprint engine

Python pipeline + FastAPI service that turns recipe requests into a Doodle Cream cookbook PDF.

## Pipeline (`app/`)

```
requests ─► understand ─► search ─► scrape ─► parse ─► scale ─► modify ─► categorize ─► build
            (Gemini/       (Tavily/  (recipe-  (ingredient (pint)  (Gemini/   (keywords)   (Jinja2+
             heuristic)     DDG/URL)  scrapers) -parser)            notes)                  Paged.js)
```

| Module | Role |
|---|---|
| `pipeline/understand.py` | request → `Intent` (dish, servings, exclude, diet, variants, modifiers). Gemini or regex heuristic. |
| `pipeline/search.py` | dish → candidate recipe URLs (Tavily → DuckDuckGo Lite fallback). |
| `pipeline/scrape.py` | URL → `Recipe` via `recipe-scrapers` (640+ sites + schema.org fallback). |
| `pipeline/parse.py` | ingredient line → quantity/unit/name/prep (`ingredient-parser-nlp`, regex fallback). |
| `pipeline/scale.py` | deterministic serving scaling (only off a known source count). |
| `pipeline/modify.py` | allergen/diet/variant edits + chef's notes (Gemini; else acknowledges as notes). |
| `pipeline/categorize.py` | assign a cookbook category (word-boundary keyword match). |
| `render.py` | Jinja2 → self-contained HTML; Playwright + Paged.js → PDF. |
| `run.py` | orchestrator with a progress callback (shared by CLI + API). |

Design rule: **scaling is deterministic; AI is used only for language understanding and modification.**

## CLI

```bash
python -m app.cli "brownies (24 servings)" "https://example.com/a-recipe (spicy)"
# → out/cookbook.pdf + out/cookbook.html
```

Requests may be natural language or a pasted recipe URL. Options: `-o/--out`, `-t/--title`, `--theme`.

## API

```bash
uvicorn app.main:app --port 8000
```

- `GET /health`
- `POST /jobs` — body `{ "requests": [...], "title"?, "theme"? }`. Streams **Server-Sent Events**:
  `start` → `progress` (search/scale/build/render) → `done` (with `pdf_url`, `html_url`) | `error`.
  Requires a Firebase `Authorization: Bearer <idToken>` **only when Firebase is configured**.
- `GET /jobs/{id}/cookbook.pdf|html` — serves local output (when not using Cloud Storage).

## Theme

`app/templates/cookbook.html` + `app/templates/themes/doodle-cream.css`. Design tokens (cream palette,
Fraunces/Caveat/Nunito, doodle SVGs) mirror the web app's Tailwind theme. Add a sibling
`themes/<name>.css` and pass `--theme <name>` for new looks.

## Tests

```bash
pytest            # deterministic parse/scale/units/understand/categorize (no network, no AI)
```
