"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { searchUsers, type ProfileDoc } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

export default function SearchPage() {
  const { enabled } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileDoc[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced live search.
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
        Find chefs
      </h1>
      <p className="mt-2 text-ink-soft">
        Search for other cooks and browse their cookbooks.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or handle…"
        autoFocus
        className="mt-6 w-full rounded-full border border-line bg-paper px-5 py-3 text-ink outline-none focus:border-accent"
      />

      <div className="mt-6 flex flex-col gap-3">
        {busy && <p className="text-sm text-ink-soft">Searching…</p>}
        {results?.length === 0 && !busy && (
          <p className="text-sm text-ink-soft">No chefs found for “{q}”.</p>
        )}
        {results?.map((p) => (
          <Link
            key={p.uid}
            href={`/u/${p.uid}`}
            className="paper-card flex items-center gap-4 p-4 hover:border-accent"
          >
            {p.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.photoURL}
                alt=""
                className="h-11 w-11 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage/20 text-lg">
                👩‍🍳
              </span>
            )}
            <div>
              <div className="font-semibold text-ink">{p.displayName}</div>
              {p.handle && (
                <div className="text-xs text-ink-soft">@{p.handle}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
