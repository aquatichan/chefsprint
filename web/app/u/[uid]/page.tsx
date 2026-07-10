"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CookbookCard from "../../components/CookbookCard";
import {
  getProfile,
  listCookbooks,
  type CookbookDoc,
  type ProfileDoc,
} from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [books, setBooks] = useState<CookbookDoc[] | null>(null);

  const isMe = user?.uid === uid;

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then(setProfile);
    // Owners see all their cookbooks; visitors only public ones.
    listCookbooks(uid, !isMe).then(setBooks);
  }, [uid, isMe]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center gap-5">
        {profile?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoURL}
            alt=""
            className="h-20 w-20 rounded-full border-2 border-line object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sage/20 text-4xl">
            👩‍🍳
          </span>
        )}
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {profile?.displayName ?? "Chef"}
          </h1>
          {profile?.handle && (
            <p className="text-sm text-ink-soft">@{profile.handle}</p>
          )}
          {profile?.bio && <p className="mt-1 text-ink-soft">{profile.bio}</p>}
        </div>
      </div>

      <h2 className="mt-10 font-script text-2xl text-sage">
        {isMe ? "My cookbooks" : "Cookbooks"}
      </h2>
      {books === null ? (
        <p className="mt-3 text-ink-soft">Loading…</p>
      ) : books.length === 0 ? (
        <p className="mt-3 text-ink-soft">No public cookbooks yet.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <CookbookCard key={b.id} book={b} view="grid" showStar={!isMe} />
          ))}
        </div>
      )}
    </div>
  );
}
