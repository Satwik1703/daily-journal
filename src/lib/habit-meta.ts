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
