import Link from "next/link";
import HeroLogo from "./components/HeroLogo";

const EXAMPLES = [
  { emoji: "🍕", text: "meat lovers pizza that serves four people" },
  { emoji: "🍦", text: "low calorie, high protein vanilla ice cream" },
  { emoji: "🍛", text: "chicken tikka masala (no peanuts — I'm allergic)" },
  { emoji: "🍜", text: "tonkatsu ramen, extra spicy" },
];

const STEPS = [
  {
    n: "1",
    emoji: "✍️",
    t: "Ask",
    d: "Type recipes in plain English — servings, diets, allergies, and all.",
    rotate: "-1.5deg",
  },
  {
    n: "2",
    emoji: "🍳",
    t: "Cook",
    d: "We search the web, scrape real recipes, then scale and adapt them for you.",
    rotate: "1deg",
  },
  {
    n: "3",
    emoji: "📖",
    t: "Collect",
    d: "Get a styled, print-ready cookbook PDF with contents & index.",
    rotate: "-1deg",
  },
];

// Floating kitchen doodles scattered behind the hero.
const FLOATERS = [
  { e: "🥕", cls: "left-[6%] top-[18%]", delay: "0s" },
  { e: "🧄", cls: "right-[8%] top-[12%]", delay: "0.8s" },
  { e: "🥄", cls: "left-[12%] bottom-[8%]", delay: "1.4s" },
  { e: "🌿", cls: "right-[10%] bottom-[14%]", delay: "0.4s" },
  { e: "🧅", cls: "left-[42%] top-[4%]", delay: "1.1s" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* Hero */}
      <section className="relative pt-16 pb-16 text-center">
        {/* Ambient floating kitchen bits */}
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            aria-hidden
            className={`bob pointer-events-none absolute hidden text-3xl opacity-70 sm:block ${f.cls}`}
            style={{ animationDelay: f.delay }}
          >
            {f.e}
          </span>
        ))}

        <HeroLogo />

        <h1 className="mt-4 font-display text-5xl sm:text-7xl font-bold tracking-tight text-ink text-balance">
          Chefsprint
        </h1>
        <p className="mx-auto mt-3 font-script text-2xl text-sage -rotate-1">
          your kitchen wish-list, bound into a book
        </p>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft text-pretty">
          Turn a wish list of dishes into a beautiful, print-ready cookbook.
          Just describe what you want to cook — we handle the searching,
          scraping, scaling, and styling.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/new" className="btn-doodle px-7 py-3.5 text-lg">
            Cook my cookbook 🍳
          </Link>
          <Link
            href="/search"
            className="rounded-full border-2 border-line px-6 py-3.5 text-lg font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Browse cookbooks
          </Link>
        </div>
      </section>

      {/* Example requests — pinned to the "board" like index cards */}
      <section className="pb-16">
        <div className="doodle-card relative mx-auto max-w-2xl p-7">
          <span className="tape -top-3 left-8 -rotate-6" aria-hidden />
          <span className="tape tape-sage -top-3 right-8 rotate-6" aria-hidden />
          <h2 className="font-script text-3xl text-sage">Try asking for…</h2>
          <div className="doodle-rule my-3" />
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {EXAMPLES.map((ex, i) => (
              <li
                key={ex.text}
                className="stagger flex items-start gap-2.5 rounded-xl border border-line bg-cream/60 px-3.5 py-2.5 text-sm text-ink transition-colors hover:border-accent/50"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span className="text-lg leading-none">{ex.emoji}</span>
                <span>&ldquo;{ex.text}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works — a real 3-step sequence */}
      <section className="pb-24">
        <h2 className="mb-8 text-center font-display text-3xl font-bold text-ink">
          How the kitchen works
        </h2>
        <div className="grid gap-7 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="doodle-card stagger p-6 text-center"
              style={{
                transform: `rotate(${s.rotate})`,
                animationDelay: `${i * 0.12}s`,
              }}
            >
              <span
                className="sticker absolute -top-3 -left-2 bg-berry text-sm"
                aria-hidden
              >
                step {s.n}
              </span>
              <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-butter/15 text-4xl">
                {s.emoji}
              </div>
              <h3 className="mt-3 font-display text-2xl font-semibold text-ink">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm text-ink-soft text-pretty">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
