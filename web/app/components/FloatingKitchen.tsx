"use client";

import { useEffect, useRef } from "react";

// A big pool so every refresh scatters a different set of kitchen doodles.
const POOL = [
  "🍕", "🍜", "🌮", "🍣", "🥞", "🍦", "🥐", "🍛", "🍪", "🥟", "🍝", "🍤",
  "🧁", "🌯", "🥘", "🍩", "🌭", "🥗", "🍲", "🍱", "🍚", "🥓", "🧇", "🍳",
  "🥨", "🥯", "🫓", "🥖", "🧀", "🍗", "🥙", "🍫", "🍰", "🥧", "🍮", "🥑",
  "🍅", "🥕", "🧄", "🧅", "🌶️", "🌽", "🥦", "🍋", "🍓", "🍇", "🫐", "🍄",
];

interface Sprite {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  glyph: string;
  phase: number;
  freq: number;
  spin: number;
  rot: number;
  trail: { x: number; y: number }[];
  paused: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Ambient background layer: kitchen emojis wander the page along smooth,
 * ever-changing curves, each dragging a dotted trail that fades behind it.
 * Press and hold an emoji to freeze it in place. The cast, their paths, and
 * their speeds are randomized on every mount, so no two visits look alike.
 *
 * The canvas is pointer-transparent (never blocks the UI); pausing is handled
 * by a window-level hit test so a hold on an emoji works without stealing
 * clicks from buttons underneath.
 */
export default function FloatingKitchen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const count = reduce ? 5 : Math.round(rand(7, 10));
    const sprites: Sprite[] = Array.from({ length: count }, () => {
      const size = rand(30, 46);
      return {
        x: rand(size, w - size),
        y: rand(size, h - size),
        angle: rand(0, Math.PI * 2),
        speed: rand(16, 40),
        size,
        glyph: POOL[Math.floor(Math.random() * POOL.length)],
        phase: rand(0, Math.PI * 2),
        freq: rand(0.2, 0.7),
        spin: rand(-0.5, 0.5),
        rot: rand(-0.25, 0.25),
        trail: [],
        paused: false,
      };
    });

    // Static, motionless render for reduced-motion users.
    if (reduce) {
      ctx.clearRect(0, 0, w, h);
      for (const s of sprites) {
        ctx.globalAlpha = 0.5;
        ctx.font = `${s.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.glyph, s.x, s.y);
      }
      ctx.globalAlpha = 1;
      const onResizeStatic = () => resize();
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    // --- Pause-on-hold via a pointer-transparent hit test -------------------
    let held: Sprite | null = null;
    function onDown(e: PointerEvent) {
      let best: Sprite | null = null;
      let bestD = Infinity;
      for (const s of sprites) {
        const d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
        if (d < s.size * 0.8 && d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (best) {
        best.paused = true;
        held = best;
      }
    }
    function onUp() {
      if (held) held.paused = false;
      held = null;
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", resize);

    let last = performance.now();
    let sinceSample = 0;
    let raf = 0;

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      sinceSample += dt;
      const sample = sinceSample > 0.045;
      if (sample) sinceSample = 0;

      ctx!.clearRect(0, 0, w, h);

      for (const s of sprites) {
        if (!s.paused) {
          // Smooth wander: heading eased by a per-sprite sine, plus gentle
          // steering back toward center when near an edge (keeps them on-page
          // without hard bounces).
          s.angle += Math.sin((now / 1000) * s.freq + s.phase) * 0.9 * dt;
          const m = 70;
          if (s.x < m || s.x > w - m || s.y < m || s.y > h - m) {
            const toC = Math.atan2(h / 2 - s.y, w / 2 - s.x);
            let diff = toC - s.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            s.angle += diff * 1.4 * dt;
          }
          s.x += Math.cos(s.angle) * s.speed * dt;
          s.y += Math.sin(s.angle) * s.speed * dt;
          s.rot += s.spin * dt;

          if (sample) {
            s.trail.push({ x: s.x, y: s.y });
            if (s.trail.length > 30) s.trail.shift();
          }
        }

        // Dotted trail — older points fainter & smaller, so it fades behind.
        const len = s.trail.length;
        for (let i = 0; i < len; i++) {
          const p = s.trail[i];
          const t = i / len; // 0 = oldest
          ctx!.globalAlpha = t * 0.55;
          ctx!.fillStyle = "#c56b4a";
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 1.6 + t * 2.1, 0, Math.PI * 2);
          ctx!.fill();
        }

        // The emoji itself
        ctx!.globalAlpha = s.paused ? 1 : 0.82;
        ctx!.save();
        ctx!.translate(s.x, s.y);
        ctx!.rotate(s.rot);
        if (s.paused) {
          // Halo ring while held, so the freeze reads as intentional.
          ctx!.globalAlpha = 0.9;
          ctx!.strokeStyle = "#7c8a5a";
          ctx!.lineWidth = 2.5;
          ctx!.beginPath();
          ctx!.arc(0, 0, s.size * 0.7, 0, Math.PI * 2);
          ctx!.stroke();
        }
        ctx!.font = `${s.size}px serif`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(s.glyph, 0, 0);
        ctx!.restore();
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
