"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CookbookCard from "../../components/CookbookCard";
import ProfileSettingsModal from "../../components/ProfileSettingsModal";
import {
  getProfile,
  listCookbooks,
  type CookbookDoc,
  type ProfileDoc,
  type ProfileLinks,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

const LINK_META: {
  key: keyof ProfileLinks;
  emoji: string;
  label: string;
  base: string;
}[] = [
  { key: "website", emoji: "🌐", label: "Website", base: "" },
  { key: "instagram", emoji: "📸", label: "Instagram", base: "https://instagram.com/" },
  { key: "x", emoji: "𝕏", label: "Twitter", base: "https://x.com/" },
  { key: "youtube", emoji: "▶️", label: "YouTube", base: "https://youtube.com/" },
  { key: "tiktok", emoji: "🎵", label: "TikTok", base: "https://tiktok.com/@" },
  { key: "github", emoji: "🐙", label: "GitHub", base: "https://github.com/" },
];

function resolveUrl(base: string, raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (!base) return `https://${v.replace(/^\/+/, "")}`;
  return base + v.replace(/^@/, "");
}

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [books, setBooks] = useState<CookbookDoc[] | null>(null);
  const [editing, setEditing] = useState(false);

  const isMe = user?.uid === uid;

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then(setProfile);
    listCookbooks(uid, !isMe).then(setBooks);
  }, [uid, isMe]);

  const totalStars = useMemo(
    () => (books ?? []).reduce((n, b) => n + (b.starCount ?? 0), 0),
    [books],
  );
  const joined = profile?.createdAt?.seconds
    ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  const chips = LINK_META.map((m) => {
    const val = profile?.links?.[m.key];
    return val ? { ...m, href: resolveUrl(m.base, val) } : null;
  }).filter(Boolean) as (typeof LINK_META[number] & { href: string })[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {/* Profile header card */}
      <div className="doodle-card relative p-6 sm:p-8">
        <span className="tape -top-3 left-10 -rotate-3" aria-hidden />
        <span className="tape tape-sage -top-3 right-10 rotate-3" aria-hidden />
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoURL}
              alt=""
              width={96}
              height={96}
              decoding="async"
              className="h-24 w-24 rounded-full border-2 border-line object-cover shadow-[3px_3px_0_rgba(59,52,46,0.18)]"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-line bg-sage/20 text-5xl shadow-[3px_3px_0_rgba(59,52,46,0.18)]">
              🧑‍🍳
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold text-ink">
              {profile?.displayName ?? "Chef"}
            </h1>
            {profile?.handle && (
              <p className="font-script text-xl text-sage">@{profile.handle}</p>
            )}
            {profile?.bio ? (
              <p className="mt-2 text-ink-soft text-pretty">{profile.bio}</p>
            ) : (
              isMe && (
                <p className="mt-2 text-sm text-ink-soft">
                  No bio yet — tell the kitchen who you are.
                </p>
              )
            )}

            {/* Social chips */}
            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {chips.map((c) => (
                  <a
                    key={c.key}
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="pressable inline-flex items-center gap-1 rounded-full border-2 border-line bg-cream/60 px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    <span>{c.emoji}</span>
                    {c.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Stats + edit */}
          <div className="flex shrink-0 flex-col items-center gap-3 sm:items-end">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="font-display text-2xl font-bold text-ink tabular-nums">
                  {books?.length ?? "–"}
                </div>
                <div className="text-xs text-ink-soft">cookbooks</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl font-bold text-[#a97a12] tabular-nums">
                  {totalStars}
                </div>
                <div className="text-xs text-ink-soft">stars</div>
              </div>
            </div>
            {joined && (
              <div className="text-xs text-ink-soft">Joined {joined}</div>
            )}
            {isMe && profile && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full border-2 border-line px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                ✎ Edit profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cookbooks */}
      <h2 className="mt-10 font-script text-3xl text-sage -rotate-1">
        {isMe ? "🍳 My cookbooks" : "🍳 Cookbooks"}
      </h2>
      {books === null ? (
        <p className="mt-3 text-ink-soft">Loading…</p>
      ) : books.length === 0 ? (
        <p className="mt-3 text-ink-soft">No public cookbooks yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <CookbookCard
              key={b.id}
              book={b}
              view="grid"
              showStar={!isMe}
              remixable
              owned={isMe}
            />
          ))}
        </div>
      )}

      {profile && (
        <ProfileSettingsModal
          open={editing}
          onClose={() => setEditing(false)}
          profile={profile}
          onSaved={(patch) =>
            setProfile((p) => (p ? { ...p, ...patch } : p))
          }
        />
      )}
    </div>
  );
}
