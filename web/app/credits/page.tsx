"use client";

import { useEffect, useState } from "react";
import CreditPackPicker from "../components/CreditPackPicker";
import { FREE_AI_GENERATIONS, PRO_FEATURES } from "@/lib/billing";
import { getProfile } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

export default function CreditsPage() {
  const { user, loading, enabled, signIn } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.uid).then((p) => setCredits(p?.aiCredits ?? FREE_AI_GENERATIONS));
  }, [user]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-ink-soft">
        Credits need Firebase configured.
      </div>
    );
  }
  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-lg text-ink-soft">Sign in to top up your AI credits.</p>
        <button
          onClick={() => signIn()}
          className="btn-doodle mt-4 px-6 py-3"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="text-4xl bob">🎟️</span>
        <h1 className="font-display text-4xl font-bold text-ink doodle-underline draw-underline inline-block">
          Get more AI credits
        </h1>
      </div>
      <p className="mt-3 font-script text-xl text-sage -rotate-1">
        one credit = one AI-assisted cookbook
      </p>

      {/* Current balance */}
      <div className="doodle-card relative mt-6 flex items-center justify-between p-5">
        <span className="tape -top-3 left-8 -rotate-3" aria-hidden />
        <div>
          <div className="text-sm text-ink-soft">Your balance</div>
          <div className="font-display text-3xl font-bold text-ink tabular-nums">
            {credits === null ? "…" : credits}
            <span className="ml-2 text-base font-normal text-ink-soft">
              credit{credits === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <span className="text-5xl">{credits === 0 ? "🪹" : "🧺"}</span>
      </div>

      {/* What credits unlock */}
      <ul className="mt-6 grid gap-1.5 text-sm text-ink sm:grid-cols-2">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-accent">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <CreditPackPicker email={user?.email} />
      </div>

      <p className="mt-4 text-center text-xs text-ink-soft">
        Credits never expire and stack with any free generations left. Cooking
        without AI is always free.
      </p>
    </div>
  );
}
