# 🍔 Chefsprint

Turn natural-language recipe requests into a styled, print-ready **PDF cookbook** (plus an
interactive HTML preview). Chefsprint searches the web, scrapes real recipes, parses and scales their
ingredients, applies requested modifications, and compiles everything into a cookbook with a cover,
table of contents (with page references), categories, and a recipe index.

```
"brownies (regular + extra fudge)"
"chicken tikka masala (no peanuts, I have a peanut allergy)"
"low-calorie high-protein vanilla ice cream"
        │
        ▼   understand → search → scrape → parse → scale → modify → categorize → build
   cookbook.pdf  +  interactive HTML
```

## Architecture

```
Next.js (Firebase App Hosting)  ──POST /jobs (SSE)──►  FastAPI engine (Cloud Run)
  request box · live progress · preview                understand→search→scrape→parse
  Firebase Auth (optional)                             →scale→modify→categorize→render
        │                                                     │
        └── Firestore (cookbooks, jobs) ◄── Admin SDK ────────┤
            Cloud Storage (PDF, HTML)  ◄────────────────────── ┘
```

| Layer | Tech |
|---|---|
| Frontend / SaaS shell | **Next.js 16** (App Router, TS, Tailwind v4) → Firebase App Hosting |
| Recipe engine | **Python FastAPI** (SSE live progress) → Cloud Run |
| AI | **Google Gemini** (`gemini-2.5-flash-lite` / `-flash`), REST + structured JSON |
| Search → scrape | **Tavily** (or keyless DuckDuckGo, or pasted URL) → `recipe-scrapers` |
| Parse / scale | `ingredient-parser-nlp`, `pint` (deterministic) |
| Render | Jinja2 + **Playwright/Paged.js** (headless Chromium → HTML + PDF) |
| Data / auth / files | Firestore · Firebase Auth · Cloud Storage (all optional locally) |

Everything **degrades gracefully**: no Gemini key → heuristic request parsing; no Tavily → DuckDuckGo
or pasted URLs; no Firebase → open local mode writing to disk. Add keys to light up features.

## Repo layout

```
web/       Next.js app (landing, /new request+progress+preview, Firebase auth)
engine/    Python engine (pipeline, Doodle Cream templates, CLI, FastAPI service)
firebase.json · firestore.rules · storage.rules
```

## Quick start (local, no keys needed)

**1. Engine** (produces PDFs; serves the API):

```bash
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m playwright install chromium

# One-shot CLI → out/cookbook.pdf + out/cookbook.html
python -m app.cli "brownies (24 servings)" "chicken alfredo that serves 8"

# Or run the API (the web app talks to this)
uvicorn app.main:app --port 8000
```

**2. Web:**

```bash
cd web
pnpm install
cp .env.local.example .env.local     # defaults to the local engine
pnpm dev                             # http://localhost:3000
```

Open http://localhost:3000/new, enter requests (or paste recipe URLs), and watch the live progress
build your cookbook. Tests: `cd engine && pytest`.

## Configuration

Copy `engine/.env.example` → `engine/.env` and `web/.env.local.example` → `web/.env.local`.

- **`GEMINI_API_KEY`** — enables AI request understanding + recipe modification (allergens, diets,
  variants, heat). Get one at [ai.google.dev](https://ai.google.dev/).
- **`TAVILY_API_KEY`** — reliable recipe search. Free tier at [tavily.com](https://tavily.com/).
  Without it, search falls back to keyless DuckDuckGo (rate-limited) — pasting a recipe URL always works.
- **Firebase** (optional for local, required for the SaaS): see below.

## Deploying the SaaS (Firebase + Cloud Run)

1. **Create a Firebase project**; enable Authentication (Google), Firestore, and Storage.
2. **Deploy rules:** `firebase deploy --only firestore:rules,storage`.
3. **Engine → Cloud Run:**
   ```bash
   cd engine
   gcloud run deploy chefsprint-engine --source . \
     --set-env-vars GEMINI_API_KEY=...,TAVILY_API_KEY=...,FIREBASE_STORAGE_BUCKET=your-project.appspot.com,CHEFSPRINT_CORS=https://your-web-domain \
     --set-secrets GOOGLE_APPLICATION_CREDENTIALS=serviceAccount:latest
   ```
   (`Dockerfile` bundles Chromium + NLTK data.)
4. **Frontend → Firebase App Hosting:** set `NEXT_PUBLIC_API_BASE` to the Cloud Run URL and the
   `NEXT_PUBLIC_FIREBASE_*` values in `web/apphosting.yaml`, then connect the repo in the Firebase
   console (App Hosting builds Next.js automatically).

When Firebase is configured, the API verifies Firebase ID tokens, stores PDFs in Cloud Storage
(returning signed URLs), and records cookbooks/jobs in Firestore.

## Features

- Natural-language requests → **cover · contents (with page numbers) · categorized recipes · index**
- Deterministic ingredient **parsing + scaling** (exact fractions, unit-aware)
- AI **modifications**: allergen removal/substitution, dietary goals, variants, flavor tweaks + chef's notes
- Auto **categorization** (Breakfast/Lunch/Dinner/Dessert/Vegetarian/Drinks/Snacks)
- Signature **"Doodle Cream"** theme — one design-token set shared by the web app and the cookbook,
  so the site and the PDF look like the same brand. The theme system is built for more styles
  (Rustic/Modern/Vintage…) to slot in.
- **Live progress** streamed over SSE (Searching → Scaling → Building → Done).

## Notes

- **Scraping** relies on public sites; some (e.g. Food Network) block bots and occasionally return
  403 — the pipeline tries multiple search candidates and skips failures so one bad source never
  sinks the cookbook. A Tavily key improves reliability.
- Recipe *ingredients/steps* aren't copyrightable, but surrounding prose/photos can be — Chefsprint
  attributes every recipe's **source URL** in the cookbook.
