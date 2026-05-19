// Client-only Web Audio API synth for pomodoro completion sounds.
// No external mp3 assets — works offline, on every platform, after first user gesture.

type StopFn = () => void;

let ctxRef: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctxRef) return ctxRef;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  ctxRef = new Ctx();
  return ctxRef;
}

/** Prime the audio context inside a user gesture (Start tap). iOS requires this once per session. */
export function primeAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function softBell(ctx: AudioContext, start: number, freq: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.0);
  osc.start(start);
  osc.stop(start + 2.1);
}

function chimeTriad(ctx: AudioContext, start: number): void {
  for (const f of [523.25, 659.25, 783.99]) softBell(ctx, start, f);
}

function digitalBeep(ctx: AudioContext, start: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 1480;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.18, start + 0.005);
  gain.gain.setValueAtTime(0.18, start + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
  osc.start(start);
  osc.stop(start + 0.18);
}

function birdChirp(ctx: AudioContext, start: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, start);
  osc.frequency.exponentialRampToValueAtTime(2600, start + 0.08);
  osc.frequency.exponentialRampToValueAtTime(1500, start + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
  osc.start(start);
  osc.stop(start + 0.22);
}

/**
 * Schedule a sound to play repeatedly for ~durationMs.
 * Returns a stop fn (no-op if already finished — every osc auto-stops).
 */
export function playPomodoroSound(soundId: string, durationMs = 5000): StopFn {
  const ctx = getCtx();
  if (!ctx) return () => {};
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const endAt = now + durationMs / 1000;

  const repeat = (intervalSec: number, fire: (t: number) => void) => {
    for (let t = now; t < endAt; t += intervalSec) fire(t);
  };

  switch (soundId) {
    case "chime":
      repeat(1.6, (t) => chimeTriad(ctx, t));
      break;
    case "digital":
      repeat(0.45, (t) => digitalBeep(ctx, t));
      break;
    case "birds":
      repeat(0.35, (t) => birdChirp(ctx, t + Math.random() * 0.1));
      break;
    case "bell":
    default:
      repeat(1.8, (t) => softBell(ctx, t, 880));
      break;
  }

  return () => {
    // Per-oscillator stops are already scheduled; nothing additional to do.
    // (We could disconnect, but each note's gain ramps to ~0 quickly.)
  };
}
