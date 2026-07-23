"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CookbookCard from "../components/CookbookCard";
import {
  getDiscovery,
  searchUsers,
  type ChefStat,
  type Discovery,
  type ProfileDoc,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

function Avatar({ p, size = "md" }: { p: ProfileDoc; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-2xl" : "h-11 w-11 text-lg";
  return p.photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.photoURL}
      alt=""
      className={`${dim} rounded-full border-2 border-line object-cover`}
    />
  ) : (
    <span
      className={`${dim} flex items-center justify-center rounded-full border-2 border-line bg-sage/20`}
    >
      🧑‍🍳
    </span>
  );
}

function ChefCard({ p, stat }: { p: ProfileDoc; stat?: ChefStat }) {
  return (
    <Link
      href={`/u/${p.uid}`}
      className="doodle-card pressable flex items-center gap-3 p-4"
    >
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">
          {p.displayName ?? "Chef"}
        </div>
        {p.handle && (
          <div className="truncate text-xs text-ink-soft">@{p.handle}</div>
        )}
      </div>
      {stat && (
        <div className="shrink-0 text-right text-xs text-ink-soft tabular-nums">
          <div className="font-semibold text-[#a97a12]">★ {stat.stars}</div>
          <div>
            {stat.books} book{stat.books === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </Link>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-script text-3xl text-sage -rotate-1">
        {emoji} {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function SearchPage() {
  const { enabled } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileDoc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [disc, setDisc] = useState<Discovery | null>(null);

  // Live discovery leaderboards (shown when not actively searching).
  useEffect(() => {
    if (!enabled) return;
    getDiscovery().then(setDisc);
  }, [enabled]);

  // Debounced live user search.
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      setResults(await searchUsers(q));
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center text-ink-soft">
        Search needs Firebase configured.
      </div>
    );
  }

  const searching = q.trim().length > 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="text-4xl bob">🔍</span>
        <h1 className="font-display text-4xl font-bold text-ink doodle-underline draw-underline inline-block">
          Find chefs
        </h1>
      </div>
      <p className="mt-3 font-script text-xl text-sage -rotate-1">
        discover cooks & the cookbooks the kitchen is loving
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search chefs by name or handle…"
        className="mt-6 w-full rounded-full border-2 border-line bg-paper px-5 py-3 text-ink outline-none transition-colors focus:border-accent"
      />

      {/* Search results take over when the box has text */}
      {searching ? (
        <div className="mt-6 flex flex-col gap-3">
          {busy && <p className="text-sm text-ink-soft">Searching…</p>}
          {results?.length === 0 && !busy && (
            <p className="text-sm text-ink-soft">
              No chefs found for &ldquo;{q}&rdquo;.
            </p>
          )}
          {results?.map((p) => (
            <ChefCard key={p.uid} p={p} />
          ))}
        </div>
      ) : disc === null ? (
        <p className="mt-10 text-ink-soft">Loading the kitchen…</p>
      ) : (
        <>
          {disc.popularCookbooks.length > 0 && (
            <Section emoji="🔥" title="Popular cookbooks">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {disc.popularCookbooks.map((b) => (
                  <CookbookCard key={b.id} book={b} view="grid" showStar />
                ))}
              </div>
            </Section>
          )}

          {disc.popularChefs.length > 0 && (
            <Section emoji="👑" title="Popular chefs">
              <div className="grid gap-3 sm:grid-cols-2">
                {disc.popularChefs.map((c) => (
                  <ChefCard key={c.uid} p={c} stat={c} />
                ))}
              </div>
            </Section>
          )}

          {disc.recentCookbooks.length > 0 && (
            <Section emoji="🍽" title="Fresh out the oven">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {disc.recentCookbooks.map((b) => (
                  <CookbookCard key={b.id} book={b} view="grid" showStar />
                ))}
              </div>
            </Section>
          )}

          {disc.recentChefs.length > 0 && (
            <Section emoji="🌱" title="New chefs in town">
              <div className="grid gap-3 sm:grid-cols-2">
                {disc.recentChefs.map((p) => (
                  <ChefCard key={p.uid} p={p} />
                ))}
              </div>
            </Section>
          )}

          {disc.popularCookbooks.length === 0 &&
            disc.recentCookbooks.length === 0 &&
            disc.recentChefs.length === 0 && (
              <div className="doodle-card mt-10 p-10 text-center">
                <span className="bob mx-auto block text-5xl">🍳</span>
                <p className="mt-3 font-script text-2xl text-sage">
                  The kitchen&rsquo;s just warming up
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Be the first to publish a cookbook and top these boards.
                </p>
                <Link href="/new" className="btn-doodle mt-4 px-5 py-2.5">
                  Cook one now →
                </Link>
              </div>
            )}
        </>
      )}
    </div>
  );
}
