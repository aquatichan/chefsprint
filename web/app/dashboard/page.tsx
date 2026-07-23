"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CookbookCard, { type ViewMode } from "../components/CookbookCard";
import { FREE_AI_GENERATIONS } from "@/lib/billing";
import {
  ensureProfile,
  getProfile,
  listBookmarks,
  listCookbooks,
  type BookmarkDoc,
  type CookbookDoc,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "list", label: "☰ List" },
  { id: "grid", label: "▦ Grid" },
  { id: "icon", label: "▣ Icons" },
];

export default function Dashboard() {
  const { user, loading, enabled, signIn } = useAuth();
  const [view, setView] = useState<ViewMode>("grid");
  const [books, setBooks] = useState<CookbookDoc[] | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [credits, setCredits] = useState<number | null>(null);

  // Restore the user's preferred layout.
  useEffect(() => {
    const saved = localStorage.getItem("chefsprint.view") as ViewMode | null;
    if (saved) setView(saved);
  }, []);
  function changeView(v: ViewMode) {
    setView(v);
    localStorage.setItem("chefsprint.view", v);
  }

  useEffect(() => {
    if (!user) return;
    ensureProfile(user);
    listCookbooks(user.uid, false).then(setBooks);
    listBookmarks(user.uid).then(setBookmarks);
    getProfile(user.uid).then((p) =>
      setCredits(p?.plan === "pro" ? -1 : (p?.aiCredits ?? FREE_AI_GENERATIONS)),
    );
  }, [user]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center text-ink-soft">
        Profiles need Firebase configured. Set the NEXT_PUBLIC_FIREBASE_* env
        vars to enable dashboards.
      </div>
    );
  }
  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-lg text-ink-soft">Sign in to see your cookbooks.</p>
        <button
          onClick={() => signIn()}
          className="mt-4 rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-strong transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl bob">🧑‍🍳</span>
            <h1 className="font-display text-4xl font-bold text-ink doodle-underline draw-underline inline-block">
              My kitchen
            </h1>
          </div>
          {credits !== null && (
            <p className="mt-3 pl-1 text-sm text-ink-soft">
              {credits < 0 ? (
                "Pro plan - unlimited AI generations ✨"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-butter/15 px-2.5 py-0.5 font-semibold text-[#a97a12] tabular-nums">
                    ✨ {credits} AI credit{credits === 1 ? "" : "s"} left
                  </span>
                  <Link
                    href="/credits"
                    className="font-semibold text-accent underline decoration-wavy underline-offset-2 hover:text-accent-strong"
                  >
                    {credits === 0 ? "buy more" : "top up"}
                  </Link>
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => changeView(v.id)}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                view === v.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-ink-soft hover:border-accent"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* My cookbooks */}
      <section className="mt-8">
        {books === null ? (
          <p className="text-ink-soft">Loading your cookbooks...</p>
        ) : books.length === 0 ? (
          <div className="doodle-card relative p-10 text-center">
            <span className="tape -top-3 left-1/2 -ml-9 -rotate-2" aria-hidden />
            <span className="bob mx-auto block text-5xl">🍽</span>
            <p className="mt-4 font-script text-2xl text-sage">
              Your shelf is empty!
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              No cookbooks yet - let&rsquo;s fix that.
            </p>
            <Link href="/new" className="btn-doodle mt-4 px-5 py-2.5">
              Cook your first one →
            </Link>
          </div>
        ) : (
          <div
            className={
              view === "list"
                ? "flex flex-col gap-3"
                : view === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-wrap gap-3"
            }
          >
            {books.map((b) => (
              <CookbookCard key={b.id} book={b} view={view} remixable owned />
            ))}
          </div>
        )}
      </section>

      {/* Starred by me */}
      {bookmarks.length > 0 && (
        <section className="mt-12">
          <h2 className="font-script text-3xl text-sage -rotate-1">
            <span className="text-butter">★</span> Starred cookbooks
          </h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {bookmarks.map((b) => (
              <Link
                key={b.id}
                href={`/cookbook/${b.id}`}
                className="doodle-card flex items-center justify-between p-4"
              >
                <div>
                  <span className="font-semibold text-ink">{b.title ?? b.id}</span>
                  {b.description && (
                    <p className="text-xs text-ink-soft">{b.description}</p>
                  )}
                </div>
                <span className="text-xl text-butter">★</span>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
