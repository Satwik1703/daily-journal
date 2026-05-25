export const PRESET_COLORS = [
  "#10b981", "#0ea5e9", "#a855f7", "#f43f5e",
  "#f59e0b", "#84cc16", "#ec4899", "#64748b",
] as const;

export type PresetColor = (typeof PRESET_COLORS)[number];

// Phase 6: a habit can track in three modes. Determines which UI control
// shows on /habits/[date] and how "done" is derived for habit-linked goals.
export const HABIT_TRACKING_KINDS = ["binary", "number", "pomodoro"] as const;
export type HabitTrackingKind = (typeof HABIT_TRACKING_KINDS)[number];

export const TRACKING_KIND_LABELS: Record<HabitTrackingKind, string> = {
  binary: "Just tick",
  number: "Log a number",
  pomodoro: "Pomodoro sessions",
};

export const TRACKING_KIND_HINTS: Record<HabitTrackingKind, string> = {
  binary: "Single checkbox per day.",
  number: "Enter today's amount (e.g. 5000 steps).",
  pomodoro: "Auto-counted from pomodoro_sessions for a category.",
};

/**
 * Was the habit "done" on the given date, per its tracking kind?
 *
 *  - binary  → a `habit_logs` row exists for that date (`hadLog === true`)
 *  - number  → `daySumOrCount` is the SUM of `habit_value_logs.value` for
 *              that date, and we compare to `dailyTarget`
 *  - pomodoro → `daySumOrCount` is the COUNT of pomodoro_sessions for the
 *              linked category on that date, compared to `dailyTarget`
 *
 * If `dailyTarget` is missing for a number/pomo habit, fall back to "any
 * positive value counts" — keeps malformed rows from getting stuck at "not
 * done" forever.
 */
export function isHabitDoneOnDate(
  kind: HabitTrackingKind,
  dailyTarget: number | null,
  daySumOrCount: number,
  hadLog: boolean,
): boolean {
  if (kind === "binary") return hadLog;
  if (dailyTarget == null || dailyTarget <= 0) return daySumOrCount > 0;
  return daySumOrCount >= dailyTarget;
}

// Phase 10: per-habit weekday visibility. 7-bit mask, bit i = JS getDay()
// (Sun=0..Sat=6). 127 = all days; 65 = Sun+Sat (weekend); 62 = Mon-Fri.
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LABELS_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;
export const WEEKDAY_MASK_ALL = 127;
export const WEEKDAY_MASK_WEEKDAYS = 62; // Mon..Fri
export const WEEKDAY_MASK_WEEKENDS = 65; // Sun + Sat

export function isHabitActiveOnWeekday(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}

export function weekdayMaskFromArray(bools: readonly boolean[]): number {
  let m = 0;
  for (let i = 0; i < 7; i++) if (bools[i]) m |= 1 << i;
  return m;
}

export function arrayFromWeekdayMask(mask: number): boolean[] {
  return Array.from({ length: 7 }, (_, i) => isHabitActiveOnWeekday(mask, i));
}

/**
 * One-line summary of which weekdays a habit runs on, for UI subtitles.
 * Returns "" when mask is 127 (all-days, no need to mention).
 */
export function summarizeMask(mask: number): string {
  if (mask === WEEKDAY_MASK_ALL) return "";
  if (mask === WEEKDAY_MASK_WEEKDAYS) return "Mon–Fri";
  if (mask === WEEKDAY_MASK_WEEKENDS) return "Weekends";
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (isHabitActiveOnWeekday(mask, i)) days.push(WEEKDAY_LABELS[i]);
  }
  return days.join(", ");
}

// ---------- Phase 11.1: shared color + cell-fill helpers ----------

/** Convert a `#rrggbb` (or `rrggbb`) string to an `rgba()` with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * 0..1 ratio of progress toward the day's target for a given habit.
 *  - binary  → 1 if `hadLog` else 0.
 *  - number/pomo → daySum / dailyTarget, clamped to [0, 1].
 *  - falls back to "any positive value === fully met" when target is missing.
 */
export function computeRowRatio(
  kind: HabitTrackingKind,
  dailyTarget: number | null,
  daySumOrCount: number,
  hadLog: boolean,
): number {
  if (kind === "binary") return hadLog ? 1 : 0;
  if (dailyTarget == null || dailyTarget <= 0) return daySumOrCount > 0 ? 1 : 0;
  if (daySumOrCount <= 0) return 0;
  return Math.min(1, daySumOrCount / dailyTarget);
}

/**
 * Background style for a single cell in HabitGrid (the rolling 7/15/30/90-day
 * grid on /habits/[date] + /insights).
 *
 *  - binary  → full habit color if `hadLog`, else muted gray.
 *  - number/pomo → bottom-up battery fill keyed to ratio, layered with the
 *                  pre-existing opacity tint so a 30% day reads as 30% even
 *                  at 16px wide. Visible fill cutoff line + subtle gradient.
 *
 * Returns a CSSProperties object so the caller can spread it onto the cell.
 */
export function computeCellFill(
  kind: HabitTrackingKind,
  color: string,
  dailyTarget: number | null,
  daySumOrCount: number,
  hadLog: boolean,
): import("react").CSSProperties {
  const gray = "rgba(125,125,125,0.10)";
  if (kind === "binary") {
    return { backgroundColor: hadLog ? color : gray };
  }
  // number / pomodoro
  if (dailyTarget == null || dailyTarget <= 0) {
    return { backgroundColor: daySumOrCount > 0 ? color : gray };
  }
  if (daySumOrCount <= 0) return { backgroundColor: gray };
  const ratio = Math.min(1, daySumOrCount / dailyTarget);
  // Fully met: solid color (matches binary).
  if (ratio >= 1) return { backgroundColor: color };
  // Layered: faint tint at the top + bright bottom slab cut at `ratio`.
  // The two-stop linear-gradient produces a hard visual fill line at the
  // ratio percentage, way easier to eyeball than pure opacity scaling.
  const pct = Math.round(ratio * 100);
  const top = hexToRgba(color, 0.18);
  const bottom = hexToRgba(color, 0.9);
  return {
    background: `linear-gradient(to top, ${bottom} 0%, ${bottom} ${pct}%, ${top} ${pct}%, ${top} 100%)`,
  };
}


// ---------- Phase 11.1: XP + levels ----------

/**
 * Threshold table — XP required to reach each level. Index 0 is unused (you
 * start at Lv 1 with 0 XP). Index i is the XP floor for level i+1.
 *
 * Tuned for 1.0-difficulty habits: a daily binary habit logged every day for a
 * year accrues 365 XP (~Lv 4). Bumping difficulty to 2.0 doubles that.
 */
export const LEVEL_THRESHOLDS = [
  0, 50, 150, 300, 600, 1200, 2500, 5000, 10_000, 20_000,
] as const;
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelFor(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

/** XP threshold for next level, or null if already at max. */
export function nextLevelAt(xp: number): number | null {
  const lvl = levelFor(xp);
  if (lvl >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[lvl];
}

/** 0..1 progress toward next level. Returns 1 when at max level. */
export function levelProgress(xp: number): number {
  const lvl = levelFor(xp);
  if (lvl >= MAX_LEVEL) return 1;
  const prev = LEVEL_THRESHOLDS[lvl - 1];
  const next = LEVEL_THRESHOLDS[lvl];
  return Math.max(0, Math.min(1, (xp - prev) / (next - prev)));
}

/**
 * XP for a habit = (qualifying-day count) × (10 × difficulty), rounded.
 * Pass the count of distinct dates where `isHabitDoneOnDate(...) === true`
 * across all-time history.
 */
export function xpForHabit(qualifyingDays: number, difficulty: number): number {
  return Math.round(qualifyingDays * 10 * Math.max(0.1, difficulty));
}
