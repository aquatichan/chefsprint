import Link from "next/link";
import HeroLogo from "./components/HeroLogo";

const EXAMPLES = [
  "meat lovers pizza that serves four people",
  "low calorie, high protein vanilla ice cream",
  "chicken tikka masala (no peanuts, I have a peanut allergy)",
  "tonkatsu ramen (spicy)",
];

const STEPS = [
  { n: "1", t: "Ask", d: "Type recipes in plain English — servings, diets, allergies, and all." },
  { n: "2", t: "Cook", d: "We search the web, scrape real recipes, scale and adapt them." },
  { n: "3", t: "Collect", d: "Get a styled, print-ready cookbook PDF with contents & index." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* Hero */}
      <section className="pt-16 pb-14 text-center">
        <HeroLogo />
        <h1 className="mt-4 font-display text-5xl sm:text-6xl font-bold tracking-tight text-ink">
          Chefsprint
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">
          Turn a wish list of dishes into a beautiful, print-ready cookbook. Just
          describe what you want to cook — we handle the searching, scraping,
          scaling, and styling.
        </p>
        <div className="mt-8">
          <Link
            href="/new"
            className="inline-block rounded-full bg-accent px-7 py-3.5 text-lg font-semibold text-white shadow-[3px_3px_0_rgba(59,52,46,0.18)] hover:bg-accent-strong transition-colors"
          >
            Cook my cookbook →
          </Link>
        </div>
      </section>

      {/* Example requests */}
      <section className="pb-14">
        <div className="paper-card mx-auto max-w-2xl p-6">
          <h2 className="font-script text-2xl text-sage">Try asking for…</h2>
          <div className="doodle-rule my-2" />
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <li
                key={ex}
                className="flex items-start gap-2 rounded-xl bg-cream/70 px-3 py-2 text-sm text-ink"
              >
                <span className="text-accent">✓</span>
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="paper-card p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent font-script text-2xl font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                {s.t}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
