"""FastAPI service for the Chefsprint engine (deploys to Cloud Run).

`POST /jobs` runs the pipeline and streams live progress back as Server-Sent Events
(matching the brief's Searching/Scaling/Building output), then a final `done` event
with URLs to the PDF + HTML. Auth uses Firebase ID tokens when Firebase is configured;
otherwise it runs in open local-dev mode. Output goes to Cloud Storage when available,
else to local disk served by this API.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import firebase as fb
from .models import Cookbook
from .render import render_html, render_pdf
from .run import build_cookbook

OUT_DIR = Path(os.getenv("CHEFSPRINT_OUT") or "out/jobs")

log = logging.getLogger("chefsprint.api")

app = FastAPI(title="Chefsprint Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        os.getenv("CHEFSPRINT_CORS") or "http://localhost:3000"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class GrantCreditsRequest(BaseModel):
    email: str
    amount: int


# Input-size caps: each request line is a dish name or URL, so a cookbook of
# tens of recipes with generous per-line length still bounds a single job's
# fan-out (and its scrape/parse/render compute) to something sane.
MAX_REQUESTS = 30
MAX_REQUEST_LEN = 2000
MAX_META_LEN = 200


class JobRequest(BaseModel):
    requests: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=MAX_REQUEST_LEN)]],
        Field(min_length=1, max_length=MAX_REQUESTS),
    ]
    title: Annotated[str, Field(max_length=MAX_META_LEN)] | None = None
    subtitle: Annotated[str, Field(max_length=MAX_META_LEN)] | None = None
    theme: Annotated[str, Field(max_length=64)] = "doodle-cream"
    use_ai: bool = True  # off = deterministic pipeline, no credit consumed
    cookbook_id: Annotated[str, Field(max_length=64)] | None = None  # set when remixing
    mode: Literal["new", "replace"] = "new"  # replace requires ownership
    public: bool = True


async def get_uid(authorization: str | None = Header(default=None)) -> str | None:
    """Resolve the caller's uid. Enforced only when Firebase is configured."""
    if not fb.is_enabled():
        return None  # local/dev mode: open
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    claims = fb.verify_token(authorization.split(" ", 1)[1])
    if not claims:
        raise HTTPException(status_code=401, detail="invalid token")
    return claims.get("uid")


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _describe(book: Cookbook) -> str:
    """Short overview shown on dashboard/profile cards."""
    titles = [r.title for r in book.recipes]
    cats = sorted({r.category for r in book.recipes})
    head = ", ".join(titles[:3]) + ("..." if len(titles) > 3 else "")
    return f"{len(titles)} recipe{'s' if len(titles) != 1 else ''} . {' & '.join(cats)} - {head}"


def _object_path(uid: str | None, cookbook_id: str, ext: str) -> str:
    """Cloud Storage object path for a cookbook's rendered output.

    Deterministic so the file proxy can rebuild it from the Firestore doc's
    uid without storing a separate path field.
    """
    return f"cookbooks/{uid or 'anon'}/{cookbook_id}.{ext}"


def _persist(job_id: str, uid: str | None, book: Cookbook, html: str, pdf: bytes,
             job: JobRequest) -> dict:
    """Store outputs (Cloud Storage or local disk) and record the cookbook doc.

    The returned dict includes ``saved``: whether the Firestore doc was written
    (i.e. whether this cookbook will show up on dashboards/profiles).
    """
    # Cloud Storage objects are private; clients read them back through the
    # authenticated proxy (GET /cookbooks/{id}/{kind}), never a public URL.
    if fb.upload_bytes(_object_path(uid, job_id, "pdf"), pdf, "application/pdf"):
        html_ok = fb.upload_bytes(
            _object_path(uid, job_id, "html"), html.encode("utf-8"), "text/html"
        )
        urls = {
            "pdf_url": f"/cookbooks/{job_id}/pdf",
            "html_url": f"/cookbooks/{job_id}/html" if html_ok else None,
        }
    else:
        # Local-disk fallback (dev / no Firebase): served open by /jobs/{id}/...
        job_dir = OUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "cookbook.pdf").write_bytes(pdf)
        (job_dir / "cookbook.html").write_text(html, encoding="utf-8")
        urls = {"pdf_url": f"/jobs/{job_id}/cookbook.pdf",
                "html_url": f"/jobs/{job_id}/cookbook.html"}

    # Record the cookbook regardless of where files live, so dashboards/profiles
    # and remixing work in both storage modes.
    saved = fb.save_cookbook_doc(uid, job_id, {
        "title": book.title,
        "theme": book.theme,
        "description": _describe(book),
        "recipeCount": len(book.recipes),
        "recipeTitles": [r.title for r in book.recipes],
        "requests": job.requests,
        "usedAi": job.use_ai,
        "public": job.public,
        "pdfUrl": urls["pdf_url"],
        "htmlUrl": urls["html_url"],
    })
    return {**urls, "saved": saved}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "firebase": fb.is_enabled()}


@app.post("/jobs")
async def create_job(job: JobRequest, uid: str | None = Depends(get_uid)):
    if not job.requests:
        raise HTTPException(status_code=400, detail="no requests provided")

    # Throttle before doing any work (or spending an AI credit). Keyed by uid,
    # so it's active whenever Firebase auth is (see check_rate_limit).
    if uid:
        allowed, retry_after = fb.check_rate_limit(uid)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="You're creating cookbooks too quickly. Take a short break "
                       "and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    # Replacing an existing cookbook keeps its id (and Firestore doc), but only
    # for its owner; everyone else implicitly saves a new copy.
    job_id = uuid4().hex[:12]
    if job.cookbook_id and job.mode == "replace":
        existing = fb.get_cookbook_doc(job.cookbook_id)
        if existing is None and not fb.is_enabled():
            job_id = job.cookbook_id  # local dev: allow overwrite
        elif existing and existing.get("uid") == uid:
            job_id = job.cookbook_id
        else:
            raise HTTPException(status_code=403, detail="you can only replace your own cookbook")

    # Free-tier gate: AI generations consume one of the account's free credits.
    remaining = -1
    credit_spent = False
    if job.use_ai and uid:
        allowed, remaining = fb.consume_ai_credit(uid)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail="You've used your free AI generations. Turn off AI "
                       "features for this cookbook, or buy more credits.",
            )
        credit_spent = remaining >= 0  # pro users (-1) never spend credits

    loop = asyncio.get_running_loop()
    events: asyncio.Queue = asyncio.Queue()

    def push(ev: dict) -> None:
        loop.call_soon_threadsafe(events.put_nowait, ev)

    def worker() -> None:
        def fail(message: str) -> None:
            # A failed job shouldn't eat one of the user's free AI generations.
            if credit_spent:
                fb.refund_ai_credit(uid)
            push({"type": "error", "message": message,
                  **({"ai_credits_left": remaining + 1} if credit_spent else {})})

        try:
            def emit(ev: dict) -> None:
                push({"type": "progress", **ev})
                fb.write_progress(job_id, {"lastStep": ev})

            book = build_cookbook(
                job.requests, title=job.title, subtitle=job.subtitle,
                theme=job.theme, use_ai=job.use_ai, progress=emit,
            )
            if not book.recipes:
                fail("no recipes could be built")
            else:
                push({"type": "progress", "stage": "render"})
                html = render_html(book)
                pdf = render_pdf(html)
                urls = _persist(job_id, uid, book, html, pdf, job)
                push({"type": "done", "job_id": job_id, "title": book.title,
                      "recipe_count": len(book.recipes),
                      "ai_credits_left": remaining, **urls})
        except Exception:
            # Never surface a raw exception to the user; log it for us instead.
            log.exception("job %s failed", job_id)
            fail("Something went wrong while building your cookbook. "
                 "Please try again.")
        finally:
            push({"type": "__end__"})

    threading.Thread(target=worker, daemon=True).start()

    async def stream():
        yield _sse({"type": "start", "job_id": job_id})
        while True:
            ev = await events.get()
            if ev.get("type") == "__end__":
                break
            yield _sse(ev)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/admin/grant-credits")
async def grant_credits(body: GrantCreditsRequest, uid: str | None = Depends(get_uid)):
    """Manually credit a user's AI generation balance (Cash App credit-pack purchases).

    Admin-only: the caller's own uid must have isAdmin set on their user doc
    (settable only via the Firebase console / Admin SDK, never from the client
    - see firestore.rules).
    """
    if not fb.is_enabled():
        raise HTTPException(status_code=404, detail="admin actions require Firebase")
    if not uid or not fb.is_admin(uid):
        raise HTTPException(status_code=403, detail="admin access required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")

    target = fb.find_user_by_email(body.email)
    if not target:
        raise HTTPException(status_code=404, detail="no user found with that email")

    new_balance = fb.grant_credits(target["uid"], body.amount)
    return {"uid": target["uid"], "email": target["email"], "aiCredits": new_balance}


def _uid_from(authorization: str | None, token: str | None) -> str | None:
    """Verify a Firebase ID token from a Bearer header or a ``token`` query param."""
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.split(" ", 1)[1]
    elif token:
        raw = token
    if not raw:
        return None
    claims = fb.verify_token(raw)
    return claims.get("uid") if claims else None


def _safe_filename(name: str) -> str:
    keep = "".join(c if (c.isalnum() or c in " -_") else "_" for c in name).strip()
    return (keep or "cookbook")[:80]


@app.get("/cookbooks/{cookbook_id}/{kind}")
def get_cookbook_file(
    cookbook_id: str,
    kind: str,
    authorization: str | None = Header(default=None),
    token: str | None = None,
):
    """Stream a cookbook's PDF/HTML after enforcing its privacy.

    Storage objects are never public; every read comes through here so the
    cookbook's ``public`` flag and ownership are checked before any bytes go
    out. Public cookbooks are readable by anyone (matching the Firestore read
    rule); a private cookbook requires its owner, proven by a Firebase ID token
    sent either as a Bearer header (fetch) or a short-lived ``?token=`` query
    param — the latter for plain <iframe>/<a> navigations, which can't set
    headers. (Only an owner's own token for their own private book is ever put
    in a URL, and ID tokens are short-lived.)
    """
    ext = kind if kind in ("pdf", "html") else None
    if ext is None:
        raise HTTPException(status_code=404, detail="not found")

    doc = fb.get_cookbook_doc(cookbook_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="not found")

    if not doc.get("public"):
        caller = _uid_from(authorization, token)
        if not caller or caller != doc.get("uid"):
            raise HTTPException(status_code=403, detail="this cookbook is private")

    data = fb.download_bytes(_object_path(doc.get("uid"), cookbook_id, ext))
    if data is None:
        raise HTTPException(status_code=404, detail="not found")

    # Public books are immutable-by-id and briefly cacheable; private ones must
    # never be stored by shared caches.
    cache = "public, max-age=60" if doc.get("public") else "private, no-store"
    if ext == "pdf":
        filename = _safe_filename(doc.get("title") or "cookbook")
        return Response(
            content=data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}.pdf"',
                "Cache-Control": cache,
            },
        )
    return Response(
        content=data,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": cache},
    )


@app.get("/jobs/{job_id}/{name}")
def get_output(job_id: str, name: str):
    if name not in ("cookbook.pdf", "cookbook.html"):
        raise HTTPException(status_code=404, detail="not found")
    path = OUT_DIR / job_id / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="not found")
    media = "application/pdf" if name.endswith(".pdf") else "text/html"
    return FileResponse(path, media_type=media)
