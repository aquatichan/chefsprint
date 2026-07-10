"use client";

import { useEffect, useRef, useState } from "react";

// Emoji roulette: spins fast, decelerates, always lands on the burger.
const REEL = [
  "🍕", "🍜", "🌮", "🍣", "🥞", "🍦", "🥐", "🍛",
  "🍪", "🥟", "🍝", "🍤", "🧁", "🌯", "🥘", "🍩",
  "🍔", // final frame
];

export default function HeroLogo() {
  const [frame, setFrame] = useState(0);
  const [settled, setSettled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip the show for users who prefer reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFrame(REEL.length - 1);
      setSettled(true);
      return;
    }

    let i = 0;
    const step = () => {
      i += 1;
      setFrame(i);
      if (i >= REEL.length - 1) {
        setSettled(true);
        return;
      }
      // Start fast (~55ms/frame), ease out toward ~340ms for the last flips.
      const t = i / (REEL.length - 1);
      timer.current = setTimeout(step, 55 + 290 * t * t);
    };
    timer.current = setTimeout(step, 55);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      {/* Rotating golden sun rays, revealed once the reel settles */}
      <div
        aria-hidden
        className={`hero-rays absolute inset-[-38%] transition-opacity duration-1000 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Soft golden halo behind the emblem */}
      <div
        aria-hidden
        className={`hero-halo absolute inset-[-12%] transition-opacity duration-1000 ${
          settled ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        className={`relative text-6xl leading-none ${settled ? "hero-settle" : ""}`}
      >
        {REEL[frame]}
      </span>
    </div>
  );
}
