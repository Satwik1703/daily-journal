// Goal feature constants + pure helpers. DB-free so client components can
// import freely (AGENTS.md rule #6, #7). Status palette is shared with the
// journal/habits/pomodoro calendars via journal-status.ts.

import { addDays, daysBetween, periodRangeFor, todayLocal, type DateString, type GoalPeriod } from "@/lib/dates";
import { type JournalStatus } from "@/lib/journal-status";

export { PRESET_COLORS, type PresetColor } from "@/lib/habit-meta";

export const GOAL_PERIODS = ["week", "month", "year"] as const satisfies readonly GoalPeriod[];

export const PERIOD_LABELS: Record<GoalPeriod, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
};

export const PERIOD_PLURAL: Record<GoalPeriod, string> = {
  week: "Weeks",
  month: "Months",
  year: "Years",
};

export const GOAL_TYPES = ["number", "habit", "pomodoro", "milestone"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  number: "Number target",
  habit: "Habit-linked",
  pomodoro: "Pomodoro-linked",
  milestone: "Milestone / checklist",
};

export const GOAL_TYPE_HINTS: Record<GoalType, string> = {
  number: "Count something — books read, km run, money saved.",
  habit: "Auto-pulled from an existing habit's logs.",
  pomodoro: "Auto-pulled from pomodoro sessions, optional category filter.",
  milestone: "Single check-off or a checklist of sub-tasks.",
};

export const GOAL_STATUSES = ["active", "achieved", "missed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  achieved: "Achieved",
  missed: "Missed",
  archived: "Archived",
};

export type PomoMetric = "minutes" | "pomos" | "sessions";

export const POMO_METRIC_LABELS: Record<PomoMetric, string> = {
  minutes: "Minutes",
  pomos: "Pomos",
  sessions: "Sessions",
};

// ---------- Pace + status computation ----------

export type PacePill = "not-started" | "behind" | "at-risk" | "on-track" | "ahead" | "achieved" | "missed";

export const PACE_PILL_LABELS: Record<PacePill, string> = {
  "not-started": "Not started",
  behind: "Behind",
  "at-risk": "At risk",
  "on-track": "On track",
  ahead: "Ahead",
  achieved: "Achieved",
  missed: "Missed",
};

export type PaceResult = {
  progress: number; // 0..1 (current / target)
  expected: number; // 0..1 (elapsed / total) — null target gives 0
  delta: number; // progress - expected (signed)
  pill: PacePill;
};

/**
 * Linear pace model. If target ≤ 0 (or null), progress collapses to 0 and the
 * pill reads "not-started". For milestone goals (no target), pass `target = 1`
 * and `current = doneRatio` from the caller.
 */
export function computeGoalPace(input: {
  status: GoalStatus;
  current: number;
  target: number | null;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
}): PaceResult {
  const { status, current, target, periodStart, periodEnd, today } = input;
  if (status === "achieved") {
    return { progress: 1, expected: 1, delta: 0, pill: "achieved" };
  }
  if (status === "missed") {
    const p = target && target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;
    return { progress: p, expected: 1, delta: p - 1, pill: "missed" };
  }
  if (!target || target <= 0) {
    return { progress: 0, expected: 0, delta: 0, pill: "not-started" };
  }
  const totalDays = Math.max(1, daysBetween(periodStart, periodEnd) + 1);
  const elapsedRaw =
    today < periodStart ? 0 : today > periodEnd ? totalDays : daysBetween(periodStart, today) + 1;
  const elapsed = Math.max(0, Math.min(totalDays, elapsedRaw));
  const expected = elapsed / totalDays;
  const progress = Math.max(0, Math.min(1, current / target));
  const delta = progress - expected;
  let pill: PacePill;
  if (progress === 0 && elapsed === 0) pill = "not-started";
  else if (progress >= 1) pill = "achieved";
  else if (delta >= 0.1) pill = "ahead";
  else if (delta >= -0.2) pill = "on-track";
  else if (progress < 0.5 && 1 - expected < 0.25) pill = "at-risk";
  else pill = "behind";
  return { progress, expected, delta, pill };
}

/** Goal cell status for heatmap / history strip rendering. Returns the shared palette. */
export function computeGoalStatus(input: {
  status: GoalStatus;
  current: number;
  target: number | null;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
}): JournalStatus {
  if (input.status === "archived") return "empty";
  const pace = computeGoalPace(input);
  if (pace.pill === "achieved") return "crazy";
  if (pace.pill === "missed") return "bad";
  if (pace.pill === "ahead") return "great";
  if (pace.pill === "on-track") return "good";
  if (pace.pill === "behind") return "avg";
  if (pace.pill === "at-risk") return "bad";
  return "empty";
}

/** True if today is past the inclusive end of the period. */
export function isPeriodClosed(periodKey: string, period: GoalPeriod, today: DateString): boolean {
  const { end } = periodRangeFor(periodKey, period);
  return end < today;
}

/**
 * Largest-remainder integer split for cascading auto-split.
 *
 *   autoSplitTargets(25, 12) → [3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]   (one slot gets the +1)
 *   autoSplitTargets(600, 12) → [50, 50, 50, ...]                     (clean division)
 *
 * `isReal=true` (e.g. minutes) skips remainder distribution and returns `total/slices` on each.
 */
export function autoSplitTargets(total: number, slices: number, isReal = false): number[] {
  if (slices <= 0) return [];
  if (isReal) {
    const each = total / slices;
    return Array.from({ length: slices }, () => each);
  }
  const base = Math.floor(total / slices);
  const extra = Math.round(total - base * slices);
  return Array.from({ length: slices }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Days remaining inclusive of today. 0 if period is in the past, full length if in future.
 */
export function daysRemaining(periodKey: string, period: GoalPeriod, today: DateString = todayLocal()): number {
  const { start, end } = periodRangeFor(periodKey, period);
  if (today > end) return 0;
  if (today < start) return daysBetween(start, end) + 1;
  return daysBetween(today, end) + 1;
}

/** Format a pace-percent into "ahead 12%" / "behind 8%" style string. */
export function formatPaceDelta(delta: number): string {
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return "on pace";
  return delta > 0 ? `+${pct}% ahead` : `−${pct}% behind`;
}

// Re-export utility so callers can avoid double-imports.
export { addDays };
