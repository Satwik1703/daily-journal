// Pomodoro constants + pure helpers. DB-free so client components can import freely.

export type PomoDurationKey = "full" | "half";

export const POMO_DURATIONS: ReadonlyArray<{
  key: PomoDurationKey;
  min: number;
  label: string;
  shortLabel: string;
}> = [
  { key: "full", min: 50, label: "1 pomo · 50 min", shortLabel: "50m" },
  { key: "half", min: 30, label: "½ pomo · 30 min", shortLabel: "30m" },
] as const;

export const DEFAULT_DURATION_KEY: PomoDurationKey = "full";

/** 50 min = 1.0 pomo, 30 min = 0.6 pomo, 25 min = 0.5 pomo. */
export function pomoUnits(durationMin: number): number {
  return durationMin / 50;
}

/** Round display number: keep 1 decimal unless integer. */
export function fmtPomos(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(1);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "5:00 PM → 5:50 PM" */
export function formatTimeSpan(start: Date, end: Date): string {
  return `${formatClock(start)} → ${formatClock(end)}`;
}

export function formatClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export type SoundOption = { id: string; label: string; description: string };

export const SOUND_OPTIONS: ReadonlyArray<SoundOption> = [
  { id: "bell", label: "Soft Bell", description: "Warm sine bell with slow decay" },
  { id: "chime", label: "Chime", description: "Major triad chime, three voices" },
  { id: "digital", label: "Digital", description: "Crisp square-wave beep pattern" },
  { id: "birds", label: "Birds", description: "Quick gentle bird-like chirps" },
] as const;

export const DEFAULT_SOUND_ID = "bell";

export const SOUND_PLAYBACK_MS = 5000;

/** Default category names + colors used to seed `pomodoro_categories` on first read. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  emoji: string;
  color: string;
}> = [
  { name: "Work", emoji: "💼", color: "#0ea5e9" },
  { name: "Study", emoji: "📚", color: "#a855f7" },
  { name: "Read", emoji: "📖", color: "#10b981" },
  { name: "Exercise", emoji: "🏃", color: "#f43f5e" },
  { name: "Create", emoji: "🎨", color: "#f59e0b" },
  { name: "Other", emoji: "✨", color: "#64748b" },
] as const;
