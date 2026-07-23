"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  isStarred,
  setCookbookIcon,
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
  const [burst, setBurst] = useState(false);

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
    if (nowStarred) {
      setBurst(false);
      requestAnimationFrame(() => setBurst(true));
    }
  }

  return (
    <button
      onClick={onClick}
      title={user ? "Star (bookmarks it for you)" : "Sign in to star"}
      className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-semibold transition-all active:scale-90 ${
        starred
          ? "border-butter bg-butter/15 text-[#a97a12]"
          : "border-line text-ink-soft hover:border-butter hover:text-[#a97a12]"
      }`}
    >
      <span className={burst ? "star-pop inline-block" : "inline-block"}>
        {starred ? "★" : "☆"}
      </span>
      {count !== null && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

export default function CookbookCard({
  book,
  view,
  showStar = false,
  remixable = false,
  owned = false,
}: {
  book: CookbookDoc;
  view: ViewMode;
  showStar?: boolean;
  remixable?: boolean;
  /** When true, the owner can retag this cookbook's display icon. */
  owned?: boolean;
}) {
  const router = useRouter();
  const href = `/cookbook/${book.id}`;
  const [icon, setIcon] = useState(book.icon || "📖");

  async function editIcon(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = window.prompt(
      "Set this cookbook's icon (any single character or emoji):",
      icon,
    );
    if (next == null) return;
    const glyph = [...next.trim()][0] ?? "";
    if (!glyph) return;
    setIcon(glyph);
    await setCookbookIcon(book.id, glyph);
  }

  function goRemix(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/new?remix=${book.id}`);
  }

  if (view === "icon") {
    return (
      <Link
        href={href}
        className="doodle-card pressable relative flex h-28 w-28 flex-col items-center justify-center gap-1 p-2 text-center"
        title={book.title}
      >
        {owned && (
          <button
            onClick={editIcon}
            title="Change icon"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-xs opacity-70 hover:opacity-100 hover:border-accent"
          >
            ✎
          </button>
        )}
        <span className="text-4xl leading-none">{icon}</span>
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
      className={`doodle-card pressable relative block p-5 ${isList ? "" : "h-full"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <button
            onClick={owned ? editIcon : undefined}
            title={owned ? "Change icon" : undefined}
            className={`shrink-0 text-2xl leading-none ${owned ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
          >
            {icon}
          </button>
          <h3 className="font-display text-lg font-semibold text-ink text-balance">
            {book.title}
          </h3>
        </div>
        {showStar && <StarButton book={book} />}
      </div>
      {book.description && (
        <p className={`mt-1 text-sm text-ink-soft ${isList ? "" : "line-clamp-2"}`}>
          {book.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        {book.recipeCount != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2 py-0.5 font-semibold text-sage">
            🍽 {book.recipeCount} recipes
          </span>
        )}
        {book.usedAi === false ? (
          <span className="rounded-full bg-line/60 px-2 py-0.5">no AI</span>
        ) : (
          book.usedAi && (
            <span className="rounded-full bg-butter/15 px-2 py-0.5 text-[#a97a12]">
              ✨ AI
            </span>
          )
        )}
        <span className="flex-1" />
        {book.pdfUrl && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(apiUrl(book.pdfUrl!), "_blank");
            }}
            className="rounded-full border-2 border-line px-2.5 py-1 font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            PDF
          </button>
        )}
        {remixable && (
          <button onClick={goRemix} className="sticker bg-accent text-xs">
            Remix →
          </button>
        )}
      </div>
    </Link>
  );
}
