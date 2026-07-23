"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import logo from "@/public/chefsprint-logo.png";

export default function Header() {
  const { user, enabled, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Close the mobile menu on Escape (nav-driven closing is handled per-link).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass =
    "rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-sage/10 hover:text-sage transition-colors";

  return (
    <header className="border-b-2 border-dashed border-line bg-cream/85 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="group flex shrink-0 items-center gap-2 text-ink">
          <Image
            src={logo}
            alt="Chefsprint"
            width={45}
            height={45}
            priority
            className="h-[45px] w-[45px] hover-jiggle drop-shadow-[1px_1px_0_rgba(59,52,46,0.18)]"
          />
          <span className="font-display text-xl font-semibold whitespace-nowrap group-hover:text-accent transition-colors">
            Chefsprint
          </span>
        </Link>

        {/* Desktop nav (unchanged) - collapses into the menu below sm. */}
        <nav className="hidden sm:flex items-center gap-1 sm:gap-3 text-sm">
          {enabled && (
            <>
              <Link href="/search" className={linkClass}>
                Explore
              </Link>
              {user && (
                <>
                  <Link href="/dashboard" className={linkClass}>
                    Dashboard
                  </Link>
                  <Link
                    href="/credits"
                    className="rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-butter/15 hover:text-[#a97a12] transition-colors"
                  >
                    Credits
                  </Link>
                </>
              )}
            </>
          )}
          <Link href="/new" className="btn-doodle px-4 py-2 text-sm">
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
                    // Remote avatar: native lazy-load; not worth the image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt="me"
                      width={36}
                      height={36}
                      loading="lazy"
                      decoding="async"
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
                  className="rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-accent/10 hover:text-accent transition-colors"
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

        {/* Mobile: keep the primary CTA visible, collapse everything else. */}
        <div className="flex shrink-0 items-center gap-2 sm:hidden">
          <Link href="/new" className="btn-doodle px-3 py-1.5 text-sm" onClick={close}>
            + New
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line text-ink hover:bg-sage/10 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <nav
          id="mobile-nav"
          className="sm:hidden border-t-2 border-dashed border-line bg-cream/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-3 text-base">
            {enabled && (
              <Link href="/search" className={linkClass} onClick={close}>
                Explore
              </Link>
            )}
            {enabled && user && (
              <>
                <Link href="/dashboard" className={linkClass} onClick={close}>
                  Dashboard
                </Link>
                <Link
                  href="/credits"
                  onClick={close}
                  className="rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-butter/15 hover:text-[#a97a12] transition-colors"
                >
                  Credits
                </Link>
              </>
            )}
            {enabled &&
              (user ? (
                <>
                  <Link
                    href={`/u/${user.uid}`}
                    onClick={close}
                    className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-ink-soft hover:bg-sage/10 hover:text-sage transition-colors"
                  >
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.photoURL}
                        alt="me"
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                        className="h-7 w-7 rounded-full border-2 border-line object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-line bg-sage/20">
                        👩‍🍳
                      </span>
                    )}
                    My profile
                  </Link>
                  <button
                    onClick={() => {
                      close();
                      signOut();
                    }}
                    className="rounded-full px-2.5 py-1.5 text-left text-ink-soft hover:bg-accent/10 hover:text-accent transition-colors"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    close();
                    signIn();
                  }}
                  className="rounded-full px-2.5 py-1.5 text-left text-ink-soft hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  Sign in
                </button>
              ))}
          </div>
        </nav>
      )}
    </header>
  );
}
