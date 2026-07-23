"use client";

import { useEffect, useRef, useState } from "react";

// A big pool of kitchen glyphs; the reel is sampled fresh on every mount so the
// spin looks different each visit. It always resolves to the Chefsprint logo.
const POOL = [
  "🍕", "🍜", "🌮", "🍣", "🥞", "🍦", "🥐", "🍛", "🍪", "🥟", "🍝", "🍤",
  "🧁", "🌯", "🥘", "🍩", "🍔", "🌭", "🥗", "🍲", "🍱", "🍚", "🍥", "🍢",
  "🥓", "🧇", "🍳", "🥨", "🥯", "🫓", "🥖", "🧀", "🍗", "🍖", "🥙", "🫔",
  "🍫", "🍬", "🍰", "🎂", "🥧", "🍮", "🍯", "🥞", "🫕", "🍄", "🥑", "🌶️",
];

function sampleReel(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(POOL[Math.floor(Math.random() * POOL.length)]);
  }
  return out;
}

export default function HeroLogo() {
  // Reel of emoji frames; `null` head sentinel means "show the logo".
  const [reel, setReel] = useState<string[]>([]);
  const [frame, setFrame] = useState(0);
  const [settled, setSettled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const r = sampleReel(15);
    setReel(r);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(true);
      return;
    }

    let i = 0;
    const step = () => {
      i += 1;
      setFrame(i);
      if (i >= r.length) {
        setSettled(true);
        return;
      }
      const t = i / r.length;
      timer.current = setTimeout(step, 55 + 300 * t * t);
    };
    timer.current = setTimeout(step, 55);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const spinning = !settled && frame < reel.length;

  return (
    <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
      {/* Rotating golden sun rays, revealed once the reel settles */}
      <div
        aria-hidden
        className={`hero-rays absolute inset-[-34%] transition-opacity duration-1000 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Soft golden halo behind the emblem */}
      <div
        aria-hidden
        className={`hero-halo absolute inset-[-10%] transition-opacity duration-1000 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Rounded black backdrop tile that makes the emblem pop */}
      <div
        className={`relative flex h-28 w-28 items-center justify-center rounded-[26px] shadow-[4px_5px_0_rgba(59,52,46,0.28)] transition-colors duration-500 ${
          settled ? "bg-ink" : "bg-ink/85"
        } ${settled ? "hero-settle" : ""}`}
      >
        {spinning ? (
          <span className="text-6xl leading-none">{reel[frame]}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/chefsprint-logo.png"
            alt="Chefsprint logo"
            className="h-20 w-20 drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
          />
        )}
      </div>
    </div>
  );
}
