import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — Chefsprint" };

const UPDATED = "July 8, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-4xl font-bold text-ink doodle-underline inline-block">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 leading-relaxed text-ink">
        <section>
          <h2 className="font-display text-2xl font-semibold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-soft">
            <li>
              <b className="text-ink">Account info</b> — when you sign in with
              Google we receive your name, email address, and profile photo.
            </li>
            <li>
              <b className="text-ink">Your content</b> — the recipe requests you
              submit, the cookbooks we generate for you, and any stars or
              comments you leave on other chefs&rsquo; cookbooks.
            </li>
            <li>
              <b className="text-ink">Usage data</b> — basic technical logs
              (e.g. request timestamps and errors) needed to run and debug the
              service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">How we use it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-soft">
            <li>To generate, store, and display your cookbooks.</li>
            <li>
              To power social features: your public profile, cookbook pages,
              stars, and comments are visible to other users.
            </li>
            <li>
              To enforce free-tier limits (we track how many AI generations
              your account has used).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Third parties</h2>
          <p className="mt-2 text-ink-soft">
            Your recipe requests are processed by <b className="text-ink">Google
            Gemini</b> (to interpret requests, adapt recipes, and generate dish
            images) and web search providers (to find source recipes). Account
            data and content are stored in <b className="text-ink">Google
            Firebase</b> (Authentication and Firestore). We don&rsquo;t sell
            your data, and we don&rsquo;t use third-party advertising or
            tracking cookies. Preferences such as your dashboard layout are
            stored locally in your browser.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">
            Recipe sources
          </h2>
          <p className="mt-2 text-ink-soft">
            Cookbooks are compiled from publicly available recipe pages. Every
            generated cookbook attributes its sources in the recipe index.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Your choices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-soft">
            <li>You can delete your comments at any time.</li>
            <li>You can un-star any cookbook to remove the bookmark.</li>
            <li>
              To delete your account and associated data, contact us at the
              address below.
            </li>
          </ul>
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
