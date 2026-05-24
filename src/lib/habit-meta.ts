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
