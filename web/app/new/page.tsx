"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiUrl, streamJob, JobError, type JobEvent } from "@/lib/api";
import { FREE_AI_GENERATIONS } from "@/lib/billing";
import { getCookbook, getProfile } from "@/lib/db";
import { playChime, primeAudio } from "@/lib/sound";
import { useAuth } from "@/lib/useAuth";
import PaywallModal from "../components/PaywallModal";

type Status = "idle" | "running" | "done" | "error";

const STAGE_HEADER: Record<string, string> = {
  search: "🔎 Searching",
  scale: "⚖️ Scaling",
  nutrition: "🥗 Counting nutrition",
  art: "🎨 Illustrating",
  build: "📖 Building",
};

function ProgressLine({ ev }: { ev: JobEvent }) {
  if (ev.stage === "search") {
    return ev.ok ? (
      <div className="animate-pop flex items-start gap-2 text-ink">
        <span className="text-accent">✓</span>
        <span>
          {ev.title}
          {ev.host && <span className="text-ink-soft"> . {ev.host}</span>}
        </span>
      </div>
    ) : (
      <div className="flex items-start gap-2 text-ink-soft">
        <span className="text-accent-strong">✗</span>
        <span>
          {ev.request} - {ev.message}
        </span>
      </div>
    );
  }
  if (ev.stage === "scale") {
    return (
      <div className="animate-pop flex items-start gap-2 text-ink">
        <span className="text-accent">✓</span>
        <span>
          {ev.title} → <b>{ev.servings}</b> servings
        </span>
      </div>
    );
  }
  if (ev.stage === "nutrition") {
    return (
      <div className="animate-pop flex items-start gap-2 text-ink">
        <span className="text-accent">✓</span>
        <span>{ev.title}</span>
      </div>
    );
  }
  if (ev.stage === "art") {
    return (
      <div className="animate-pop flex items-start gap-2 text-ink">
        <span className="text-accent">{ev.ok ? "✓" : "-"}</span>
        <span>{ev.title}</span>
      </div>
    );
  }
  if (ev.stage === "build") {
    return (
      <div className="text-sm text-ink-soft">
        Assembling {ev.count} recipe{ev.count === 1 ? "" : "s"}...
      </div>
    );
  }
  if (ev.stage === "render") {
    return <div className="text-sm text-ink-soft">Rendering your cookbook...</div>;
  }
  return null;
}

function NewCookbookInner() {
  const { enabled, user, signIn, getToken } = useAuth();
  const params = useSearchParams();
  const remixId = params.get("remix");

  const [text, setText] = useState(
    "brownies (regular + extra fudge)\nchicken tikka masala (no peanuts, I have a peanut allergy)\nfluffy pancakes that serves 4",
  );
  const [title, setTitle] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [remixOwned, setRemixOwned] = useState(false);
  const [saveMode, setSaveMode] = useState<"new" | "replace">("new");
  const [status, setStatus] = useState<Status>("idle");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [result, setResult] = useState<JobEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remaining free AI generations: null = unknown, -1 = pro (unlimited).
  const [credits, setCredits] = useState<number | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.uid).then((p) =>
      setCredits(p?.plan === "pro" ? -1 : (p?.aiCredits ?? FREE_AI_GENERATIONS)),
    );
  }, [user]);

  // Remix: preload the original cookbook's requests + title for editing. Older
  // cookbooks may predate the stored `requests`, so fall back to recipe titles.
  useEffect(() => {
    if (!remixId) return;
    getCookbook(remixId).then((book) => {
      if (!book) return;
      const lines = book.requests?.length ? book.requests : book.recipeTitles;
      if (lines?.length) setText(lines.join("\n"));
      if (book.title) setTitle(book.title);
      setRemixOwned(Boolean(user && book.uid === user.uid));
    });
  }, [remixId, user]);

  const requests = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const running = status === "running";
  const needsSignIn = enabled && !user;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsSignIn) {
      await signIn();
      return;
    }
    if (!requests.length) return;

    // Hard paywall: out of free AI generations (engine re-checks with a 402).
    if (useAi && credits === 0) {
      setPaywallOpen(true);
      return;
    }

    primeAudio(); // unlock audio inside the click gesture so the chime can play later
    setStatus("running");
    setEvents([]);
    setResult(null);
    setError(null);

    try {
      const token = await getToken();
      await streamJob(
        {
          requests,
          title: title || undefined,
          use_ai: useAi,
          ...(remixId
            ? { cookbook_id: remixId, mode: remixOwned ? saveMode : "new" }
            : {}),
        },
        (ev) => {
          if (typeof ev.ai_credits_left === "number") {
            setCredits(ev.ai_credits_left); // includes refunds on failed jobs
          }
          if (ev.type === "done") {
            setResult(ev);
            setStatus("done");
            playChime();
          } else if (ev.type === "error") {
            setError(ev.message ?? "Something went wrong");
            setStatus("error");
          } else if (ev.type === "progress") {
            setEvents((prev) => [...prev, ev]);
          }
        },
        token,
      );
    } catch (err) {
      if (err instanceof JobError && err.status === 402) {
        // The engine is the source of truth for the allowance.
        setCredits(0);
        setPaywallOpen(true);
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="text-4xl bob">{remixId ? "🔄" : "🧑‍🍳"}</span>
        <h1 className="font-display text-4xl font-bold text-ink doodle-underline draw-underline inline-block">
          {remixId ? "Remix cookbook" : "New cookbook"}
        </h1>
      </div>
      <p className="mt-3 font-script text-xl text-sage -rotate-1">
        One request per line — servings, diets, or allergies, all in plain English.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Request form */}
        <form onSubmit={onSubmit} className="doodle-card relative p-6 h-fit">
          <span className="tape -top-3 left-10 -rotate-3" aria-hidden />
          <label className="block font-script text-2xl text-sage">
            📝 Your recipe requests
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            disabled={running}
            className="mt-2 w-full resize-y rounded-xl border-2 border-line bg-cream/60 p-3 text-ink outline-none transition-colors focus:border-accent focus:bg-paper disabled:opacity-60"
          />
          <div className="mt-1 text-right font-script text-lg text-ink-soft">
            {requests.length} dish{requests.length === 1 ? "" : "es"} on the list
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={running}
            placeholder="Cookbook title (optional)"
            className="mt-2 w-full rounded-xl border-2 border-line bg-cream/60 p-3 text-ink outline-none transition-colors focus:border-accent focus:bg-paper disabled:opacity-60"
          />

          {/* AI toggle */}
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line bg-butter/5 p-3 text-sm text-ink transition-colors hover:border-butter/60">
            <input
              type="checkbox"
              checked={useAi}
              onChange={(e) => setUseAi(e.target.checked)}
              disabled={running}
              className="mt-0.5 h-5 w-5 accent-[#c56b4a]"
            />
            <span>
              <b>✨ AI features</b> &mdash; request understanding, allergen
              &amp; diet personalization, dish photos
            </span>
          </label>
          {user && credits !== null && (
            <p
              className={`mt-1.5 pl-7 text-xs ${
                credits === 0 ? "text-accent-strong" : "text-ink-soft"
              }`}
            >
              {credits < 0 ? (
                <>Pro plan - unlimited AI generations ✨</>
              ) : credits === 0 ? (
                <>
                  0 free AI generations left -{" "}
                  <button
                    type="button"
                    onClick={() => setPaywallOpen(true)}
                    className="font-semibold underline decoration-wavy underline-offset-2 hover:text-accent"
                  >
                    buy more credits
                  </button>
                </>
              ) : (
                <>
                  {credits} free AI generation
                  {credits === 1 ? "" : "s"} left
                </>
              )}
            </p>
          )}
          {!useAi && (
            <div className="mt-2 rounded-xl border border-line bg-cream/70 p-3 text-xs text-ink-soft">
              ⚠️ Without AI, your requests are interpreted literally: allergen
              removal, variants, dietary goals, and generated dish photos are
              skipped. Serving-size scaling still works.
            </div>
          )}

          {/* Remix save mode (owners only) */}
          {remixId && remixOwned && (
            <div className="mt-4 flex gap-4 text-sm text-ink">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={saveMode === "new"}
                  onChange={() => setSaveMode("new")}
                  disabled={running}
                  className="accent-[#c56b4a]"
                />
                Save as new
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={saveMode === "replace"}
                  onChange={() => setSaveMode("replace")}
                  disabled={running}
                  className="accent-[#c56b4a]"
                />
                Replace original
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={running || (!requests.length && !needsSignIn)}
            className="btn-doodle mt-5 w-full px-6 py-3.5 text-lg"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="jiggle">🍳</span> Cooking&hellip;
              </span>
            ) : needsSignIn ? (
              "Sign in to cook"
            ) : (
              `Cook my cookbook 🍳 (${requests.length} item${requests.length === 1 ? "" : "s"})`
            )}
          </button>
        </form>

        {/* Progress + result */}
        <div className="doodle-card relative p-6 min-h-[16rem]">
          <span className="tape tape-sage -top-3 right-10 rotate-3" aria-hidden />
          {status === "idle" && (
            <div className="flex h-full min-h-[13rem] flex-col items-center justify-center text-center">
              <span className="bob text-5xl">🍲</span>
              <p className="mt-4 max-w-xs text-ink-soft text-pretty">
                Your live progress will appear here - searching, scaling,
                illustrating, then building your PDF. We&rsquo;ll chime when
                it&rsquo;s ready. 🔔
              </p>
            </div>
          )}

          {(running || status === "done" || events.length > 0) && (
            <div className="space-y-1">
              {events.map((ev, i) => {
                const prev = events[i - 1];
                const showHeader =
                  ev.stage &&
                  ev.stage !== prev?.stage &&
                  STAGE_HEADER[ev.stage];
                return (
                  <Fragment key={i}>
                    {showHeader && (
                      <div className="mt-3 font-script text-lg text-sage">
                        {STAGE_HEADER[ev.stage!]}
                      </div>
                    )}
                    <ProgressLine ev={ev} />
                  </Fragment>
                );
              })}
              {running && (
                <div className="mt-3 flex items-center gap-2 text-ink-soft">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="steam absolute -top-1 text-xs">💨</span>
                    <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
                  </span>
                  <span className="font-script text-lg">working&hellip;</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-accent-strong/40 bg-accent/10 p-3 text-sm text-accent-strong">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-5 animate-pop">
              <div className="flex items-center gap-2 font-script text-2xl text-sage">
                <span className="inline-block hero-settle">🎉</span> Done - {result.title}
              </div>
              {typeof result.ai_credits_left === "number" &&
                result.ai_credits_left >= 0 && (
                  <div className="mt-1 text-xs text-ink-soft">
                    {result.ai_credits_left} free AI generation
                    {result.ai_credits_left === 1 ? "" : "s"} left
                  </div>
                )}
              {user && result.saved === false && (
                <div className="mt-3 rounded-xl border border-line bg-cream/70 p-3 text-xs text-ink-soft">
                  ⚠️ Your PDF is ready below, but the engine couldn&rsquo;t
                  record this cookbook to your account - it won&rsquo;t show on
                  your dashboard or profile, and can&rsquo;t be starred or
                  commented on. (The engine isn&rsquo;t connected to Firebase -
                  check its logs.)
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={apiUrl(result.pdf_url!)}
                  download
                  className="btn-doodle px-5 py-2.5"
                >
                  ⬇ Download PDF
                </a>
                <a
                  href={apiUrl(result.html_url!)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border-2 border-line px-5 py-2.5 font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  ↗ Open preview
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-width preview */}
      {result && (
        <div className="mt-10">
          <h2 className="font-script text-3xl text-sage -rotate-1">
            📖 Fresh out the oven
          </h2>
          <iframe
            title="cookbook preview"
            src={apiUrl(result.html_url!)}
            className="mt-3 h-[720px] w-full rounded-2xl border-2 border-line bg-white shadow-[5px_6px_0_rgba(59,52,46,0.12)]"
          />
        </div>
      )}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onContinueWithoutAi={() => {
          setUseAi(false);
          setPaywallOpen(false);
        }}
      />
    </div>
  );
}

export default function NewCookbook() {
  return (
    <Suspense>
      <NewCookbookInner />
    </Suspense>
  );
}
