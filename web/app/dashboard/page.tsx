"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CookbookCard, { type ViewMode } from "../components/CookbookCard";
import PaywallModal from "../components/PaywallModal";
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
  const [paywallOpen, setPaywallOpen] = useState(false);

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
          <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
            My kitchen
          </h1>
          {credits !== null && (
            <p className="mt-2 text-sm text-ink-soft">
              {credits < 0 ? (
                "Pro plan — unlimited AI generations ✨"
              ) : (
                <>
                  {credits} free AI generation{credits === 1 ? "" : "s"} left
                  {credits === 0 && (
                    <>
                      {" — "}
                      <button
                        onClick={() => setPaywallOpen(true)}
                        className="font-semibold text-accent underline decoration-wavy underline-offset-2 hover:text-accent-strong"
                      >
                        upgrade to Pro
                      </button>
                    </>
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => changeView(v.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
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
          <p className="text-ink-soft">Loading your cookbooks…</p>
        ) : books.length === 0 ? (
          <div className="paper-card p-8 text-center">
            <p className="text-ink-soft">No cookbooks yet.</p>
            <Link
              href="/new"
              className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-strong transition-colors"
            >
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
              <CookbookCard key={b.id} book={b} view={view} remixable />
            ))}
          </div>
        )}
      </section>

      {/* Starred by me */}
      {bookmarks.length > 0 && (
        <section className="mt-12">
          <h2 className="font-script text-2xl text-sage">★ Starred cookbooks</h2>
          <div className="mt-3 flex flex-col gap-2">
            {bookmarks.map((b) => (
              <Link
                key={b.id}
                href={`/cookbook/${b.id}`}
                className="paper-card flex items-center justify-between p-4 hover:border-accent"
              >
                <div>
                  <span className="font-semibold text-ink">{b.title ?? b.id}</span>
                  {b.description && (
                    <p className="text-xs text-ink-soft">{b.description}</p>
                  )}
                </div>
                <span className="text-accent">★</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}
