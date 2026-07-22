"use client";

import { useEffect, useState } from "react";
import {
  CASHTAG,
  cashAppLink,
  CREDIT_PACKS,
  FREE_AI_GENERATIONS,
  PRO_FEATURES,
  type CreditPack,
} from "@/lib/billing";
import { useAuth } from "@/lib/useAuth";

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
  const [selected, setSelected] = useState<CreditPack["id"]>("medium");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pack = CREDIT_PACKS.find((p) => p.id === selected)!;

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

        {/* Pack picker */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                selected === p.id
                  ? "-translate-y-0.5 border-accent bg-accent/5 shadow-[3px_3px_0_rgba(59,52,46,0.14)]"
                  : "border-line hover:border-accent/50"
              }`}
            >
              {p.badge && (
                <span className="sticker absolute -top-3 right-2 bg-berry text-[11px]">
                  {p.badge}
                </span>
              )}
              <div className="font-semibold text-ink">{p.name}</div>
              <div className="mt-1">
                <span className="font-display text-2xl font-bold text-ink tabular-nums">
                  ${p.price}
                </span>
              </div>
              <div className="text-xs text-ink-soft tabular-nums">
                {p.credits} credits
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border-2 border-dashed border-line bg-cream/70 p-4 text-sm text-ink">
          <p className="font-semibold">📮 Before you pay:</p>
          <p className="mt-1 text-ink-soft">
            Payments are matched to your account by hand - send to{" "}
            <b className="text-ink">{CASHTAG}</b> and put{" "}
            <b className="text-ink">
              {user?.email ?? "the email you signed in with"}
            </b>{" "}
            in the Cash App note. Credits are usually added within a day.
          </p>
        </div>

        <a
          href={cashAppLink(pack)}
          target="_blank"
          rel="noreferrer"
          className="btn-doodle mt-4 w-full px-6 py-3 text-lg"
        >
          Pay ${pack.price} via Cash App →
        </a>

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
