"use client";

import { useEffect, useState } from "react";
import { updateProfile, type ProfileDoc, type ProfileLinks } from "@/lib/db";

const LINK_FIELDS: { key: keyof ProfileLinks; label: string; placeholder: string }[] = [
  { key: "website", label: "🌐 Website", placeholder: "https://myfood.blog" },
  { key: "instagram", label: "📸 Instagram", placeholder: "@handle or URL" },
  { key: "x", label: "𝕏 / Twitter", placeholder: "@handle or URL" },
  { key: "youtube", label: "▶️ YouTube", placeholder: "@channel or URL" },
  { key: "tiktok", label: "🎵 TikTok", placeholder: "@handle or URL" },
  { key: "github", label: "🐙 GitHub", placeholder: "@handle or URL" },
];

/** Owner-only editor for the bio + social links shown on a profile. */
export default function ProfileSettingsModal({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileDoc;
  onSaved: (patch: { bio: string; links: ProfileLinks }) => void;
}) {
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<ProfileLinks>({});
  const [saving, setSaving] = useState(false);

  // Seed the form whenever it opens.
  useEffect(() => {
    if (!open) return;
    setBio(profile.bio ?? "");
    setLinks(profile.links ?? {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, profile, onClose]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    await updateProfile(profile.uid, { bio, links });
    setSaving(false);
    onSaved({ bio: bio.trim().slice(0, 280), links });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />
      <div className="doodle-card animate-pop relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-7">
        <span className="tape -top-3 left-1/2 -ml-9 -rotate-2" aria-hidden />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full border-2 border-line px-2.5 py-1 text-sm text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          ✕
        </button>

        <h2 className="doodle-underline inline-block font-display text-3xl font-bold text-ink">
          Edit your profile
        </h2>

        <label className="mt-5 block text-sm font-semibold text-ink">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Tell the kitchen who you are…"
          className="mt-1.5 w-full resize-y rounded-xl border-2 border-line bg-cream/60 p-3 text-ink outline-none transition-colors focus:border-accent focus:bg-paper"
        />
        <div className="mt-1 text-right text-xs text-ink-soft tabular-nums">
          {bio.length}/280
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {LINK_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="font-semibold text-ink">{f.label}</span>
              <input
                value={links[f.key] ?? ""}
                onChange={(e) =>
                  setLinks((l) => ({ ...l, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-xl border-2 border-line bg-cream/60 px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:bg-paper"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-doodle flex-1 px-6 py-3"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border-2 border-line px-6 py-3 font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
