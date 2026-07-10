"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  isStarred,
  starCount,
  toggleStar,
  type CookbookDoc,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

export type ViewMode = "list" | "grid" | "icon";

export function StarButton({ book }: { book: CookbookDoc }) {
  const { user } = useAuth();
  const [starred, setStarred] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    starCount(book.id).then(setCount);
    if (user) isStarred(book.id).then(setStarred);
  }, [book.id, user]);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const nowStarred = await toggleStar(book);
    setStarred(nowStarred);
    setCount((c) => (c ?? 0) + (nowStarred ? 1 : -1));
  }

  return (
    <button
      onClick={onClick}
      title={user ? "Star (bookmarks it for you)" : "Sign in to star"}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        starred
          ? "border-accent bg-accent/10 text-accent"
          : "border-line text-ink-soft hover:border-accent"
      }`}
    >
      <span>{starred ? "★" : "☆"}</span>
      {count !== null && <span>{count}</span>}
    </button>
  );
}

export default function CookbookCard({
  book,
  view,
  showStar = false,
  remixable = false,
}: {
  book: CookbookDoc;
  view: ViewMode;
  showStar?: boolean;
  remixable?: boolean;
}) {
  const href = `/cookbook/${book.id}`;

  if (view === "icon") {
    return (
      <Link
        href={href}
        className="paper-card flex h-28 w-28 flex-col items-center justify-center gap-1 p-2 text-center hover:border-accent"
        title={book.title}
      >
        <span className="text-3xl">📖</span>
        <span className="line-clamp-2 text-xs font-semibold text-ink">
          {book.title}
        </span>
      </Link>
    );
  }

  const isList = view === "list";
  return (
    <Link
      href={href}
      className={`paper-card block p-5 transition-colors hover:border-accent ${
        isList ? "" : "h-full"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">
          {book.title}
        </h3>
        {showStar && <StarButton book={book} />}
      </div>
      {book.description && (
        <p className={`mt-1 text-sm text-ink-soft ${isList ? "" : "line-clamp-2"}`}>
          {book.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        {book.recipeCount != null && <span>{book.recipeCount} recipes</span>}
        {book.usedAi === false && <span>· no AI</span>}
        <span className="flex-1" />
        {book.pdfUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(apiUrl(book.pdfUrl!), "_blank");
            }}
            className="rounded-full border border-line px-2.5 py-1 hover:border-accent"
          >
            PDF
          </button>
        )}
        {remixable && (
          <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-white">
            Remix →
          </span>
        )}
      </div>
    </Link>
  );
}
