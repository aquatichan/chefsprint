"use client";

import { useEffect, useState } from "react";
import {
  FREE_AI_GENERATIONS,
  PLANS,
  PRO_FEATURES,
  startCheckout,
  type Plan,
} from "@/lib/billing";

/**
 * Hard paywall shown when a user is out of free AI generations.
 * Checkout is scaffolding: buttons call startCheckout(), which no-ops (with a
 * notice) until Stripe payment links are configured in lib/billing.ts.
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
  const [selected, setSelected] = useState<Plan["id"]>("pro-yearly");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function upgrade() {
    const plan = PLANS.find((p) => p.id === selected)!;
    if (!startCheckout(plan)) {
      setNotice(
        "Checkout isn't connected yet — Stripe is being configured. Hang tight!",
      );
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Chefsprint Pro"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <div className="paper-card animate-pop relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-7">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full border border-line px-2.5 py-1 text-sm text-ink-soft hover:border-accent hover:text-accent"
        >
          ✕
        </button>

        <p className="font-script text-2xl text-sage">Your free tastings are up!</p>
        <h2 className="doodle-underline mt-1 inline-block font-display text-3xl font-bold text-ink">
          Go Pro, keep cooking
        </h2>
        <p className="mt-3 text-sm text-ink-soft">
          You&rsquo;ve used all {FREE_AI_GENERATIONS} free AI generations.
          Upgrade for unlimited AI cookbooks, or keep making cookbooks without
          AI features — those are always free.
        </p>

        <ul className="mt-4 space-y-1.5 text-sm text-ink">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="text-accent">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* Plan picker */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`relative rounded-2xl border-2 p-4 text-left transition-colors ${
                selected === plan.id
                  ? "border-accent bg-accent/5"
                  : "border-line hover:border-accent/50"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-sage px-2.5 py-0.5 font-script text-sm text-white">
                  {plan.badge}
                </span>
              )}
              <div className="font-semibold text-ink">{plan.name}</div>
              <div className="mt-1">
                <span className="font-display text-2xl font-bold text-ink">
                  {plan.price}
                </span>{" "}
                <span className="text-sm text-ink-soft">{plan.cadence}</span>
              </div>
            </button>
          ))}
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-line bg-cream/70 p-3 text-xs text-ink-soft">
            {notice}
          </div>
        )}

        <button
          onClick={upgrade}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3 text-lg font-semibold text-white shadow-[3px_3px_0_rgba(59,52,46,0.18)] transition-colors hover:bg-accent-strong"
        >
          Upgrade with Stripe →
        </button>

        {onContinueWithoutAi && (
          <button
            onClick={onContinueWithoutAi}
            className="mt-2 w-full rounded-full border border-line px-6 py-2.5 font-semibold text-ink-soft transition-colors hover:border-accent hover:text-ink"
          >
            Continue without AI (free)
          </button>
        )}

        <p className="mt-3 text-center text-[11px] text-ink-soft">
          Cancel anytime. Payments handled securely by Stripe.
        </p>
      </div>
    </div>
  );
}
