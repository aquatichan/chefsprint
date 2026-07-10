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
import os
import threading
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from . import firebase as fb
from .models import Cookbook
from .render import render_html, render_pdf
from .run import build_cookbook

OUT_DIR = Path(os.getenv("CHEFSPRINT_OUT") or "out/jobs")

app = FastAPI(title="Chefsprint Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        os.getenv("CHEFSPRINT_CORS") or "http://localhost:3000"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobRequest(BaseModel):
    requests: list[str]
    title: str | None = None
    subtitle: str | None = None
    theme: str = "doodle-cream"
    use_ai: bool = True  # off = deterministic pipeline, no credit consumed
    cookbook_id: str | None = None  # set when remixing an existing cookbook
    mode: str = "new"  # "new" | "replace" (replace requires ownership)
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
    head = ", ".join(titles[:3]) + ("…" if len(titles) > 3 else "")
    return f"{len(titles)} recipe{'s' if len(titles) != 1 else ''} · {' & '.join(cats)} — {head}"


def _persist(job_id: str, uid: str | None, book: Cookbook, html: str, pdf: bytes,
             job: JobRequest) -> dict:
    """Store outputs (Cloud Storage or local disk) and record the cookbook doc.

    The returned dict includes ``saved``: whether the Firestore doc was written
    (i.e. whether this cookbook will show up on dashboards/profiles).
    """
    pdf_url = fb.upload_bytes(f"cookbooks/{uid or 'anon'}/{job_id}.pdf", pdf, "application/pdf")
    if pdf_url:
        html_url = fb.upload_bytes(
            f"cookbooks/{uid or 'anon'}/{job_id}.html", html.encode("utf-8"), "text/html"
        )
        urls = {"pdf_url": pdf_url, "html_url": html_url}
    else:
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
                       "features for this cookbook, or upgrade your plan.",
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
        except Exception as exc:
            fail(str(exc))
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


@app.get("/jobs/{job_id}/{name}")
def get_output(job_id: str, name: str):
    if name not in ("cookbook.pdf", "cookbook.html"):
        raise HTTPException(status_code=404, detail="not found")
    path = OUT_DIR / job_id / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="not found")
    media = "application/pdf" if name.endswith(".pdf") else "text/html"
    return FileResponse(path, media_type=media)
