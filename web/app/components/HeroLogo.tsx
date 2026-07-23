"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import logo from "@/public/chefsprint-logo.png";

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

  // The intro reel is a client-only, timer-driven animation, so it necessarily
  // sets state after mount — that's what this effect is for. The React 19
  // set-state-in-effect rule is a false positive here.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const spinning = !settled && frame < reel.length;

  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
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
        className={`relative flex h-[140px] w-[140px] items-center justify-center rounded-[32px] shadow-[4px_5px_0_rgba(59,52,46,0.28)] transition-colors duration-500 ${
          settled ? "bg-ink" : "bg-ink/85"
        } ${settled ? "hero-settle" : ""}`}
      >
        {spinning ? (
          <span className="text-7xl leading-none">{reel[frame]}</span>
        ) : (
          <Image
            src={logo}
            alt="Chefsprint logo"
            width={100}
            height={100}
            className="h-[100px] w-[100px] drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
          />
        )}
      </div>
    </div>
  );
}
