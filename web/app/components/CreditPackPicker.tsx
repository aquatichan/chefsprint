"use client";

import { useState } from "react";
import {
  CASHTAG,
  cashAppLink,
  CREDIT_PACKS,
  type CreditPack,
} from "@/lib/billing";

/**
 * The credit-pack chooser: three tiers, the "put your email in the note"
 * instruction, and a Cash App pay button. Shared by the paywall modal and the
 * standalone /credits page so pricing and copy never drift.
 */
export default function CreditPackPicker({ email }: { email?: string | null }) {
  const [selected, setSelected] = useState<CreditPack["id"]>("medium");
  const pack = CREDIT_PACKS.find((p) => p.id === selected)!;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
              selected === p.id
                ? "-translate-y-0.5 border-accent bg-accent/5 shadow-[3px_3px_0_rgba(59,52,46,0.14)]"
                : "border-line hover:-translate-y-0.5 hover:border-accent/50"
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
            {email ?? "the email you signed in with"}
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
    </div>
  );
}
