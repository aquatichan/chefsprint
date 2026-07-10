"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function Header() {
  const { user, enabled, signIn, signOut } = useAuth();

  return (
    <header className="border-b border-line/70 bg-cream/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <span className="text-2xl">🍔</span>
          <span className="font-display text-xl font-semibold">Chefsprint</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {enabled && (
            <>
              <Link href="/search" className="text-ink-soft hover:text-ink">
                Explore
              </Link>
              {user && (
                <Link href="/dashboard" className="text-ink-soft hover:text-ink">
                  Dashboard
                </Link>
              )}
            </>
          )}
          <Link
            href="/new"
            className="rounded-full bg-accent px-4 py-2 font-semibold text-white shadow-[2px_2px_0_rgba(59,52,46,0.15)] hover:bg-accent-strong transition-colors"
          >
            New cookbook
          </Link>
          {enabled &&
            (user ? (
              <div className="flex items-center gap-2">
                <Link href={`/u/${user.uid}`} title="My profile">
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt="me"
                      className="h-8 w-8 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage/20">
                      👩‍🍳
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-ink-soft hover:text-ink"
                  title={user.email ?? undefined}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="text-ink-soft hover:text-ink"
              >
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
  );
}
