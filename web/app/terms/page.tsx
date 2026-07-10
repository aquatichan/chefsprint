import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Chefsprint" };

const UPDATED = "July 8, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 leading-relaxed text-ink">
        <section>
          <h2 className="font-display text-2xl font-semibold">The service</h2>
          <p className="mt-2 text-ink-soft">
            Chefsprint compiles recipes from publicly available web pages into
            personalized cookbook PDFs, optionally adapted by AI (serving sizes,
            allergen substitutions, dietary variants, generated dish imagery).
            The service is provided &ldquo;as is&rdquo;, without warranties of
            any kind.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">
            ⚠️ Food safety &amp; allergies
          </h2>
          <p className="mt-2 text-ink-soft">
            Recipes and AI-generated adaptations are for informational purposes
            only. <b className="text-ink">Always verify ingredients yourself,
            especially for allergies and dietary restrictions.</b> AI
            substitutions can be wrong or incomplete. Chefsprint is not liable
            for any harm arising from prepared food, allergen exposure, or
            nutritional decisions made using generated cookbooks.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Your account</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-soft">
            <li>You&rsquo;re responsible for activity under your account.</li>
            <li>
              Free accounts include a limited allowance of AI generations;
              non-AI generation remains available afterwards.
            </li>
            <li>
              We may suspend accounts that abuse the service (scraping abuse,
              spam, harassment in comments, or attempts to circumvent limits).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Your content</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-soft">
            <li>
              You keep ownership of your cookbook requests and generated
              cookbooks. Public cookbooks, your profile, stars, and comments
              are visible to other users.
            </li>
            <li>
              Keep comments respectful. We may remove content that is illegal,
              hateful, or spam.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">
            Recipe attribution
          </h2>
          <p className="mt-2 text-ink-soft">
            Generated cookbooks adapt recipes from public sources and cite each
            source in the recipe index. Cookbooks are intended for personal
            use; you are responsible for how you further distribute them.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Changes</h2>
          <p className="mt-2 text-ink-soft">
            We may update these terms as the service evolves; continued use
            after changes constitutes acceptance. Material changes will be
            noted on this page with a new &ldquo;last updated&rdquo; date.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Contact</h2>
          <p className="mt-2 text-ink-soft">
            Questions? Email{" "}
            <a
              href="mailto:aaronhanqin@gmail.com"
              className="text-accent underline"
            >
              aaronhanqin@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
