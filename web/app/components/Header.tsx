"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function Header() {
  const { user, enabled, signIn, signOut } = useAuth();

  return (
    <header className="border-b-2 border-dashed border-line bg-cream/85 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2 text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chefsprint-logo.png"
            alt="Chefsprint"
            className="h-9 w-9 hover-jiggle drop-shadow-[1px_1px_0_rgba(59,52,46,0.18)]"
          />
          <span className="font-display text-xl font-semibold group-hover:text-accent transition-colors">
            Chefsprint
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 text-sm">
          {enabled && (
            <>
              <Link
                href="/search"
                className="rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-sage/10 hover:text-sage transition-colors"
              >
                Explore
              </Link>
              {user && (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-sage/10 hover:text-sage transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/credits"
                    className="hidden sm:inline rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-butter/15 hover:text-[#a97a12] transition-colors"
                  >
                    Credits
                  </Link>
                </>
              )}
            </>
          )}
          <Link
            href="/new"
            className="btn-doodle px-4 py-2 text-sm"
          >
            + New cookbook
          </Link>
          {enabled &&
            (user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={`/u/${user.uid}`}
                  title="My profile"
                  className="transition-transform hover:-rotate-6"
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt="me"
                      className="h-9 w-9 rounded-full border-2 border-line object-cover shadow-[1px_1px_0_rgba(59,52,46,0.15)]"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line bg-sage/20 shadow-[1px_1px_0_rgba(59,52,46,0.15)]">
                      👩‍🍳
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="hidden sm:block rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-accent/10 hover:text-accent transition-colors"
                  title={user.email ?? undefined}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-accent/10 hover:text-accent transition-colors"
              >
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
  );
}
