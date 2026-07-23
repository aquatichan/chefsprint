"use client";

// Firestore client helpers for Chefsprint's social layer: profiles, cookbook
// listings, stars/bookmarks, and comments. The engine (Admin SDK) writes cookbook
// docs; the browser reads them and owns profile/star/comment writes.

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  serverTimestamp,
  increment,
  type Firestore,
} from "firebase/firestore";
import { firebaseEnabled, auth, type User } from "./firebase";
import { getApps } from "firebase/app";

function db(): Firestore | null {
  if (!firebaseEnabled) return null;
  const app = getApps()[0];
  return app ? getFirestore(app) : null;
}

// ---------------------------------------------------------------- types

export interface CookbookDoc {
  id: string;
  uid: string;
  title: string;
  description?: string;
  theme?: string;
  recipeCount?: number;
  recipeTitles?: string[];
  requests?: string[];
  usedAi?: boolean;
  public?: boolean;
  pdfUrl?: string;
  htmlUrl?: string;
  /** Owner-chosen display glyph (any single char); falls back to 📖. */
  icon?: string;
  /** Denormalized star tally, kept live by toggleStar for leaderboards. */
  starCount?: number;
  updatedAt?: { seconds: number } | null;
}

export interface ProfileLinks {
  website?: string;
  instagram?: string;
  x?: string;
  youtube?: string;
  tiktok?: string;
  github?: string;
}

export interface ProfileDoc {
  uid: string;
  displayName?: string;
  handle?: string;
  photoURL?: string;
  bio?: string;
  links?: ProfileLinks;
  aiCredits?: number;
  plan?: string;
  createdAt?: { seconds: number } | null;
  /** Grants access to /admin. Settable only via the Firebase console (Admin-SDK-only field). */
  isAdmin?: boolean;
}

// ---------------------------------------------------------------- profiles

/** Create/refresh the caller's public profile (safe fields only). */
export async function ensureProfile(user: User): Promise<void> {
  const d = db();
  if (!d) return;
  const ref = doc(d, "users", user.uid);
  const existing = await getDoc(ref);
  const handle = (user.email?.split("@")[0] ?? user.uid.slice(0, 8))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  await setDoc(
    ref,
    {
      displayName: user.displayName ?? handle,
      nameLower: (user.displayName ?? handle).toLowerCase(),
      handle,
      photoURL: user.photoURL ?? null,
      // Stamp createdAt once, and backfill it for legacy docs that predate the
      // field, so "Recent chefs" and the profile "Joined" date work for them.
      ...(existing.data()?.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function getProfile(uid: string): Promise<ProfileDoc | null> {
  const d = db();
  if (!d) return null;
  const snap = await getDoc(doc(d, "users", uid));
  return snap.exists() ? ({ uid, ...snap.data() } as ProfileDoc) : null;
}

/** Update the caller's own editable profile fields (bio + social links). */
export async function updateProfile(
  uid: string,
  patch: { bio?: string; links?: ProfileLinks },
): Promise<void> {
  const d = db();
  if (!d) return;
  // Drop empty link values so we don't store blanks.
  const links = patch.links
    ? Object.fromEntries(
        Object.entries(patch.links).filter(([, v]) => v && v.trim()),
      )
    : undefined;
  await setDoc(
    doc(d, "users", uid),
    {
      ...(patch.bio !== undefined ? { bio: patch.bio.trim().slice(0, 280) } : {}),
      ...(links !== undefined ? { links } : {}),
    },
    { merge: true },
  );
}

/** Prefix search over handle and display name; merged + deduped. */
export async function searchUsers(qtext: string): Promise<ProfileDoc[]> {
  const d = db();
  const needle = qtext.trim().toLowerCase();
  if (!d || !needle) return [];
  const users = collection(d, "users");
  const [byHandle, byName] = await Promise.all([
    getDocs(query(users, where("handle", ">=", needle), where("handle", "<=", needle + "\uf8ff"), limit(10))),
    getDocs(query(users, where("nameLower", ">=", needle), where("nameLower", "<=", needle + "\uf8ff"), limit(10))),
  ]);
  const seen = new Map<string, ProfileDoc>();
  [...byHandle.docs, ...byName.docs].forEach((s) =>
    seen.set(s.id, { uid: s.id, ...s.data() } as ProfileDoc),
  );
  return [...seen.values()];
}

// ---------------------------------------------------------------- cookbooks

export async function getCookbook(id: string): Promise<CookbookDoc | null> {
  const d = db();
  if (!d) return null;
  const snap = await getDoc(doc(d, "cookbooks", id));
  return snap.exists() ? ({ id, ...snap.data() } as CookbookDoc) : null;
}

/** Cookbooks owned by `uid`. `publicOnly` is used for other people's profiles.
 * Sorted client-side (newest first) to avoid Firestore composite-index setup. */
export async function listCookbooks(
  uid: string,
  publicOnly: boolean,
): Promise<CookbookDoc[]> {
  const d = db();
  if (!d) return [];
  const parts = [where("uid", "==", uid)];
  if (publicOnly) parts.push(where("public", "==", true));
  const snap = await getDocs(query(collection(d, "cookbooks"), ...parts, limit(50)));
  return snap.docs
    .map((s) => ({ id: s.id, ...s.data() }) as CookbookDoc)
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
}

// ---------------------------------------------------------------- stars

export async function isStarred(cookbookId: string): Promise<boolean> {
  const d = db();
  const me = auth()?.currentUser;
  if (!d || !me) return false;
  return (await getDoc(doc(d, "cookbooks", cookbookId, "stars", me.uid))).exists();
}

export async function starCount(cookbookId: string): Promise<number> {
  const d = db();
  if (!d) return 0;
  const agg = await getCountFromServer(collection(d, "cookbooks", cookbookId, "stars"));
  return agg.data().count;
}

/** Toggle a star; stars double as bookmarks under the user's own doc, and keep
 * the cookbook's denormalized `starCount` live for the discovery leaderboards. */
export async function toggleStar(book: CookbookDoc): Promise<boolean> {
  const d = db();
  const me = auth()?.currentUser;
  if (!d || !me) return false;
  const starRef = doc(d, "cookbooks", book.id, "stars", me.uid);
  const bookmarkRef = doc(d, "users", me.uid, "bookmarks", book.id);
  const cookbookRef = doc(d, "cookbooks", book.id);
  if ((await getDoc(starRef)).exists()) {
    await Promise.all([
      deleteDoc(starRef),
      deleteDoc(bookmarkRef),
      updateDoc(cookbookRef, { starCount: increment(-1) }).catch(() => {}),
    ]);
    return false;
  }
  const stamp = { createdAt: serverTimestamp() };
  await Promise.all([
    setDoc(starRef, stamp),
    setDoc(bookmarkRef, {
      ...stamp,
      title: book.title,
      ownerUid: book.uid,
      description: book.description ?? "",
    }),
    updateDoc(cookbookRef, { starCount: increment(1) }).catch(() => {}),
  ]);
  return true;
}

/** Owner-only: set a custom display glyph for a cookbook (any single char). */
export async function setCookbookIcon(
  cookbookId: string,
  icon: string,
): Promise<void> {
  const d = db();
  if (!d) return;
  await updateDoc(doc(d, "cookbooks", cookbookId), {
    icon: [...icon.trim()][0] ?? "",
  });
}

export interface BookmarkDoc {
  id: string;
  title?: string;
  ownerUid?: string;
  description?: string;
}

export async function listBookmarks(uid: string): Promise<BookmarkDoc[]> {
  const d = db();
  if (!d) return [];
  const snap = await getDocs(
    query(collection(d, "users", uid, "bookmarks"), orderBy("createdAt", "desc"), limit(50)),
  );
  return snap.docs.map((s) => ({ id: s.id, ...s.data() }) as BookmarkDoc);
}

// ---------------------------------------------------------------- comments

export interface CommentDoc {
  id: string;
  uid: string;
  name: string;
  text: string;
}

export async function listComments(cookbookId: string): Promise<CommentDoc[]> {
  const d = db();
  if (!d) return [];
  const snap = await getDocs(
    query(
      collection(d, "cookbooks", cookbookId, "comments"),
      orderBy("createdAt", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map((s) => ({ id: s.id, ...s.data() }) as CommentDoc);
}

export async function addComment(cookbookId: string, text: string): Promise<void> {
  const d = db();
  const me = auth()?.currentUser;
  if (!d || !me || !text.trim()) return;
  await addDoc(collection(d, "cookbooks", cookbookId, "comments"), {
    uid: me.uid,
    name: me.displayName ?? "chef",
    text: text.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------- discovery

export interface ChefStat extends ProfileDoc {
  stars: number;
  books: number;
}

export interface Discovery {
  popularCookbooks: CookbookDoc[];
  recentCookbooks: CookbookDoc[];
  popularChefs: ChefStat[];
  recentChefs: ProfileDoc[];
}

/**
 * Everything the Find-chefs page shows below the search bar. Derived from a
 * single public-cookbook read (sorted client-side, so no composite indexes are
 * needed) plus a recent-users query. Popular chefs are ranked by the summed
 * stars across their public cookbooks.
 */
export async function getDiscovery(): Promise<Discovery> {
  const empty: Discovery = {
    popularCookbooks: [],
    recentCookbooks: [],
    popularChefs: [],
    recentChefs: [],
  };
  const d = db();
  if (!d) return empty;

  const snap = await getDocs(
    query(collection(d, "cookbooks"), where("public", "==", true), limit(200)),
  );
  const books = snap.docs.map((s) => ({ id: s.id, ...s.data() }) as CookbookDoc);

  const popularCookbooks = [...books]
    .sort((a, b) => (b.starCount ?? 0) - (a.starCount ?? 0))
    .slice(0, 10);
  const recentCookbooks = [...books]
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))
    .slice(0, 10);

  // Cumulative stars per chef, across their public cookbooks.
  const agg = new Map<string, { stars: number; books: number }>();
  for (const b of books) {
    const cur = agg.get(b.uid) ?? { stars: 0, books: 0 };
    cur.stars += b.starCount ?? 0;
    cur.books += 1;
    agg.set(b.uid, cur);
  }
  const topOwners = [...agg.entries()]
    .sort((a, b) => b[1].stars - a[1].stars || b[1].books - a[1].books)
    .slice(0, 10);
  const chefs = await Promise.all(
    topOwners.map(async ([uid, stat]) => {
      const p = await getProfile(uid);
      return p ? ({ ...p, stars: stat.stars, books: stat.books } as ChefStat) : null;
    }),
  );
  const popularChefs = chefs.filter((c): c is ChefStat => c !== null);

  // Newest accounts (single-field orderBy is auto-indexed). Legacy docs without
  // createdAt simply don't appear here.
  let recentChefs: ProfileDoc[] = [];
  try {
    const us = await getDocs(
      query(collection(d, "users"), orderBy("createdAt", "desc"), limit(10)),
    );
    recentChefs = us.docs.map((s) => ({ uid: s.id, ...s.data() }) as ProfileDoc);
  } catch {
    /* createdAt index/field may be absent on a fresh project */
  }

  return { popularCookbooks, recentCookbooks, popularChefs, recentChefs };
}
