"""Optional Firebase Admin integration (auth, Firestore, Storage).

Everything here is a no-op when Firebase isn't configured, so the engine and API
run locally without credentials — but every degradation is logged once so a
misconfigured deployment can't silently drop cookbooks. Configure via env:

    GOOGLE_APPLICATION_CREDENTIALS   path to a service-account JSON
    FIREBASE_STORAGE_BUCKET          e.g. my-project.appspot.com

On Cloud Run (no key file), setting FIREBASE_STORAGE_BUCKET or
GOOGLE_CLOUD_PROJECT is enough: we fall back to Application Default Credentials.
"""

from __future__ import annotations

import logging
import os
import sys
from functools import lru_cache

from . import config as _config  # noqa: F401  — loads .env before we read os.environ

log = logging.getLogger("chefsprint.firebase")


@lru_cache(maxsize=1)
def _get_app():
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        log.warning(
            "firebase-admin is not installed in this interpreter (%s) — "
            "running in open local mode: no auth, no Firestore docs, no Cloud "
            "Storage. Install with: pip install -e '.[firebase]'",
            sys.executable,
        )
        return None

    options = {}
    bucket = os.getenv("FIREBASE_STORAGE_BUCKET")
    if bucket:
        options["storageBucket"] = bucket

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FIREBASE_CREDENTIALS")
    if cred_path:
        if not os.path.exists(cred_path):
            log.warning("Firebase credentials file not found: %s — Firebase disabled", cred_path)
            return None
        try:
            app = firebase_admin.initialize_app(credentials.Certificate(cred_path), options)
            log.info("Firebase enabled (service account, project=%s)", app.project_id)
            return app
        except Exception:
            log.exception("Firebase init failed with service account %s", cred_path)
            return None

    # No key file. If the env signals a Firebase project (e.g. on Cloud Run),
    # fall back to Application Default Credentials.
    if bucket or os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID"):
        project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
        if project:
            options["projectId"] = project
        try:
            app = firebase_admin.initialize_app(options=options)
            log.info("Firebase enabled (application default credentials, project=%s)", app.project_id)
            return app
        except Exception:
            log.exception("Firebase init via application default credentials failed")
            return None

    log.info("Firebase not configured — running in open local mode")
    return None


def is_enabled() -> bool:
    return _get_app() is not None


def verify_token(id_token: str) -> dict | None:
    """Return decoded claims for a Firebase ID token, or None if invalid/disabled."""
    if not is_enabled():
        return None
    try:
        from firebase_admin import auth

        return auth.verify_id_token(id_token)
    except Exception as exc:
        log.warning("token verification failed: %s", exc)
        return None


def upload_bytes(path: str, data: bytes, content_type: str) -> str | None:
    """Upload to Cloud Storage and return a public URL (or None if disabled).

    Cookbooks are meant to be shared/downloaded, so objects are made public
    rather than signed: signed URLs need a private key to sign with, which
    Cloud Run's Application Default Credentials (a token, not a key) can't
    do without an extra IAM Credentials API round-trip. Public + no expiry
    also means links in Firestore docs never go stale.
    """
    if not is_enabled():
        return None
    try:
        from firebase_admin import storage

        blob = storage.bucket().blob(path)
        blob.upload_from_string(data, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception:
        log.exception("Cloud Storage upload failed for %s — falling back to local disk", path)
        return None


def save_cookbook_doc(uid: str | None, cookbook_id: str, meta: dict) -> bool:
    """Record the cookbook in Firestore. Returns True when the doc was written."""
    if not is_enabled():
        return False
    try:
        from firebase_admin import firestore

        firestore.client().collection("cookbooks").document(cookbook_id).set(
            {**meta, "uid": uid, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True
        )
        return True
    except Exception:
        log.exception("Firestore write failed for cookbook %s — it will not appear "
                      "on the owner's dashboard", cookbook_id)
        return False


def get_cookbook_doc(cookbook_id: str) -> dict | None:
    if not is_enabled():
        return None
    try:
        from firebase_admin import firestore

        snap = firestore.client().collection("cookbooks").document(cookbook_id).get()
        return snap.to_dict() if snap.exists else None
    except Exception:
        log.exception("Firestore read failed for cookbook %s", cookbook_id)
        return None


FREE_AI_GENERATIONS = 2


def consume_ai_credit(uid: str) -> tuple[bool, int]:
    """Atomically consume one free AI generation for ``uid``.

    Returns ``(allowed, remaining_after)``. Users on a paid plan are never
    decremented. When Firebase is disabled (local dev) AI is always allowed.
    """
    if not is_enabled():
        return True, -1
    try:
        from firebase_admin import firestore

        client = firestore.client()
        ref = client.collection("users").document(uid)

        @firestore.transactional
        def txn(transaction):
            snap = ref.get(transaction=transaction)
            data = snap.to_dict() or {}
            if data.get("plan") == "pro":  # paid: unlimited
                return True, -1
            credits = data.get("aiCredits")
            if credits is None:  # first generation: seed the allowance
                credits = FREE_AI_GENERATIONS
            if credits <= 0:
                return False, 0
            transaction.set(ref, {"aiCredits": credits - 1}, merge=True)
            return True, credits - 1

        return txn(client.transaction())
    except Exception:
        # Fail open: a Firestore hiccup shouldn't hard-block generation.
        log.exception("AI credit check failed for %s — allowing generation", uid)
        return True, -1


def refund_ai_credit(uid: str) -> None:
    """Give back one free AI generation (used when a paid-for job fails)."""
    if not is_enabled():
        return
    try:
        from firebase_admin import firestore

        client = firestore.client()
        ref = client.collection("users").document(uid)

        @firestore.transactional
        def txn(transaction):
            snap = ref.get(transaction=transaction)
            data = snap.to_dict() or {}
            if data.get("plan") == "pro":
                return
            credits = min((data.get("aiCredits") or 0) + 1, FREE_AI_GENERATIONS)
            transaction.set(ref, {"aiCredits": credits}, merge=True)

        txn(client.transaction())
    except Exception:
        log.exception("AI credit refund failed for %s", uid)


def is_admin(uid: str) -> bool:
    """Check the caller's isAdmin flag (Admin-SDK-only field, see firestore.rules)."""
    if not is_enabled():
        return False
    try:
        from firebase_admin import firestore

        snap = firestore.client().collection("users").document(uid).get()
        return bool((snap.to_dict() or {}).get("isAdmin"))
    except Exception:
        log.exception("admin check failed for %s", uid)
        return False


def find_user_by_email(email: str) -> dict | None:
    """Resolve a signed-in-with-Google email to a uid + profile doc.

    Looks up Firebase Auth directly (not a Firestore field) since the
    profile doc doesn't store email — Auth already has it as the source
    of truth.
    """
    if not is_enabled():
        return None
    try:
        from firebase_admin import auth, firestore

        record = auth.get_user_by_email(email.strip().lower())
        snap = firestore.client().collection("users").document(record.uid).get()
        return {"uid": record.uid, "email": record.email, **(snap.to_dict() or {})}
    except auth.UserNotFoundError:
        return None
    except Exception:
        log.exception("user lookup by email failed")
        return None


def grant_credits(uid: str, amount: int) -> int:
    """Add ``amount`` AI generations to ``uid``'s balance (manual credit-pack grant).

    Unlike refund_ai_credit, this is uncapped — a purchased pack should raise
    the balance past the free-tier allowance. Returns the new balance.
    """
    from firebase_admin import firestore

    client = firestore.client()
    ref = client.collection("users").document(uid)

    @firestore.transactional
    def txn(transaction):
        snap = ref.get(transaction=transaction)
        data = snap.to_dict() or {}
        credits = (data.get("aiCredits") or 0) + amount
        transaction.set(ref, {"aiCredits": credits}, merge=True)
        return credits

    return txn(client.transaction())


def write_progress(job_id: str, data: dict) -> None:
    """Mirror job progress into Firestore so clients can also use onSnapshot."""
    if not is_enabled():
        return
    try:
        from firebase_admin import firestore

        firestore.client().collection("jobs").document(job_id).set(data, merge=True)
    except Exception:
        log.warning("progress mirror write failed for job %s", job_id)
