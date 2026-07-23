"use client";

import { useEffect } from "react";
import { FREE_AI_GENERATIONS, PRO_FEATURES } from "@/lib/billing";
import { useAuth } from "@/lib/useAuth";
import CreditPackPicker from "./CreditPackPicker";

/**
 * Hard paywall shown when a user is out of free AI generations.
 * Cash App has no payment webhook, so this is a manual flow: the user pays
 * via a Cash App link (leaving their account email in the note), then an
 * admin grants the credits from /admin once the payment shows up.
 */
export default function PaywallModal({
  open,
  onClose,
  onContinueWithoutAi,
}: {
  open: boolean;
  onClose: () => void;
  /** Offered as the free escape hatch on the generation form. */
  onContinueWithoutAi?: () => void;
}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buy more AI generations"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <div className="doodle-card animate-pop relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-7">
        <span className="tape -top-3 left-1/2 -ml-9 -rotate-2" aria-hidden />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full border-2 border-line px-2.5 py-1 text-sm text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          ✕
        </button>

        <p className="font-script text-2xl text-sage -rotate-1">
          Your free tastings are up!
        </p>
        <h2 className="doodle-underline mt-1 inline-block font-display text-3xl font-bold text-ink">
          Grab more AI credits
        </h2>
        <p className="mt-3 text-sm text-ink-soft">
          You&rsquo;ve used all {FREE_AI_GENERATIONS} free AI generations. Buy
          a credit pack to keep using AI features, or keep making cookbooks
          without AI - those are always free.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="text-accent">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <CreditPackPicker email={user?.email} />
        </div>

        {onContinueWithoutAi && (
          <button
            onClick={onContinueWithoutAi}
            className="mt-2 w-full rounded-full border-2 border-line px-6 py-2.5 font-semibold text-ink-soft transition-colors hover:border-sage hover:text-sage"
          >
            Continue without AI (free)
          </button>
        )}

        <p className="mt-3 text-center text-[11px] text-ink-soft">
          Credits never expire and stack with any free generations left.
        </p>
      </div>
    </div>
  );
}
