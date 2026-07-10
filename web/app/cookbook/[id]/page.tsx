"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { StarButton } from "../../components/CookbookCard";
import {
  addComment,
  getCookbook,
  getProfile,
  listComments,
  type CommentDoc,
  type CookbookDoc,
  type ProfileDoc,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

export default function CookbookPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signIn } = useAuth();
  const [book, setBook] = useState<CookbookDoc | null | undefined>(undefined);
  const [owner, setOwner] = useState<ProfileDoc | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCookbook(id).then((b) => {
      setBook(b);
      if (b?.uid) getProfile(b.uid).then(setOwner);
    });
    listComments(id).then(setComments);
  }, [id]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      await signIn();
      return;
    }
    if (!draft.trim()) return;
    setPosting(true);
    await addComment(id, draft);
    setDraft("");
    setComments(await listComments(id));
    setPosting(false);
  }

  if (book === undefined) {
    return <div className="mx-auto max-w-4xl px-5 py-16 text-ink-soft">Loading…</div>;
  }
  if (book === null) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center text-ink-soft">
        Cookbook not found (it may be private or deleted).
      </div>
    );
  }

  const isMine = user?.uid === book.uid;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
            {book.title}
          </h1>
          {owner && (
            <p className="mt-2 text-sm text-ink-soft">
              by{" "}
              <Link href={`/u/${book.uid}`} className="font-semibold text-accent">
                {owner.displayName ?? "a chef"}
              </Link>
            </p>
          )}
          {book.description && (
            <p className="mt-2 max-w-xl text-ink-soft">{book.description}</p>
          )}
        </div>
        <StarButton book={book} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {book.pdfUrl && (
          <a
            href={apiUrl(book.pdfUrl)}
            download
            className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white shadow-[2px_2px_0_rgba(59,52,46,0.18)] hover:bg-accent-strong transition-colors"
          >
            ⬇ Download PDF
          </a>
        )}
        {book.htmlUrl && (
          <a
            href={apiUrl(book.htmlUrl)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-5 py-2.5 font-semibold text-ink hover:border-accent"
          >
            ↗ Open preview
          </a>
        )}
        <Link
          href={`/new?remix=${book.id}`}
          className="rounded-full border border-line px-5 py-2.5 font-semibold text-ink hover:border-accent"
        >
          🔄 {isMine ? "Request changes" : "Remix this cookbook"}
        </Link>
      </div>

      {/* Inline preview */}
      {book.htmlUrl && (
        <iframe
          title="cookbook preview"
          src={apiUrl(book.htmlUrl)}
          className="mt-8 h-[560px] w-full rounded-2xl border border-line bg-white"
        />
      )}

      {/* Comments */}
      <section className="mt-10">
        <h2 className="font-script text-2xl text-sage">Comments</h2>
        <form onSubmit={submitComment} className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={user ? "Say something nice…" : "Sign in to comment"}
            className="flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={posting}
            className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-strong transition-colors disabled:opacity-60"
          >
            Post
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-3">
          {comments.length === 0 && (
            <p className="text-sm text-ink-soft">No comments yet — be first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="paper-card p-4">
              <Link href={`/u/${c.uid}`} className="text-sm font-semibold text-accent">
                {c.name}
              </Link>
              <p className="mt-1 text-sm text-ink">{c.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
