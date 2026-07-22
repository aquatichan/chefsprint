"use client";

import { useEffect, useState } from "react";
import { grantCredits, JobError } from "@/lib/api";
import { getProfile } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

/**
 * Manual credit-grant tool for Cash App payments (no webhook exists to
 * automate this — see lib/billing.ts). Access is gated server-side by
 * isAdmin on the caller's user doc; this page just renders nothing useful
 * for anyone else.
 */
export default function AdminPage() {
  const { user, loading, enabled, signIn, getToken } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.uid).then((p) => setIsAdmin(Boolean(p?.isAdmin)));
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("not signed in");
      const res = await grantCredits(email.trim(), amount, token);
      setResult(`Granted ${amount} credits to ${res.email} — new balance: ${res.aiCredits}`);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof JobError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-ink-soft">
        Admin tools need Firebase configured.
      </div>
    );
  }
  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-lg text-ink-soft">Sign in to continue.</p>
        <button
          onClick={() => signIn()}
          className="mt-4 rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-strong transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    );
  }
  if (isAdmin === false) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-ink-soft">
        You don&rsquo;t have access to this page.
      </div>
    );
  }
  if (isAdmin === null) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-ink-soft">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
        Grant AI credits
      </h1>
      <p className="mt-2 text-ink-soft">
        For manually crediting Cash App payments. Match the payment note
        against the email below before granting.
      </p>

      <form onSubmit={onSubmit} className="paper-card mt-8 p-6">
        <label className="block text-sm font-semibold text-ink">
          Account email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          disabled={busy}
          placeholder="chef@example.com"
          className="mt-1.5 w-full rounded-xl border border-line bg-cream/60 p-3 text-ink outline-none focus:border-accent disabled:opacity-60"
        />

        <label className="mt-4 block text-sm font-semibold text-ink">
          Credits to add
        </label>
        <input
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
          type="number"
          min={1}
          required
          disabled={busy}
          className="mt-1.5 w-full rounded-xl border border-line bg-cream/60 p-3 text-ink outline-none focus:border-accent disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3 text-lg font-semibold text-white shadow-[3px_3px_0_rgba(59,52,46,0.18)] hover:bg-accent-strong transition-colors disabled:opacity-60"
        >
          {busy ? "Granting…" : "Grant credits"}
        </button>

        {result && (
          <div className="mt-4 rounded-xl border border-line bg-sage/10 p-3 text-sm text-ink">
            ✓ {result}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-accent-strong/40 bg-accent/10 p-3 text-sm text-accent-strong">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
