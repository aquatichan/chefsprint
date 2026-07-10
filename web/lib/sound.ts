"use client";

// Tiny synthesized completion chime (no audio asset needed).
// Browsers only allow audio after a user gesture, so `primeAudio()` must be
// called from a click handler (we call it on "Cook my cookbook"); the chime can
// then play minutes later when generation finishes.

let ctx: AudioContext | null = null;

export function primeAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio unsupported — stay silent */
  }
}

export function playChime(): void {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  // A warm two-note "ding-dong" (E6 → A6) with soft decay.
  [[1318.5, 0], [1760, 0.18]].forEach(([freq, delay]) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.1);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 1.2);
  });
}
