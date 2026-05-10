// Day-status palette + computation. Shared by the journal and habits
// calendars. DB-free so client components can import freely.

export type JournalStatus = "crazy" | "great" | "good" | "avg" | "bad" | "empty";

export const STATUS_ORDER: readonly JournalStatus[] = [
  "crazy",
  "great",
  "good",
  "avg",
  "bad",
  "empty",
] as const;

export const STATUS_META: Record<
  JournalStatus,
  { label: string; cssVar: string; description: string }
> = {
  crazy: {
    label: "Crazy",
    cssVar: "--status-crazy",
    description: "All non-negotiables done + 3 or more completed total",
  },
  great: {
    label: "Great",
    cssVar: "--status-great",
    description: "All non-negotiables done",
  },
  good: {
    label: "Good",
    cssVar: "--status-good",
    description: "3 or more completed across lists",
  },
  avg: {
    label: "Avg",
    cssVar: "--status-avg",
    description: "Some progress, but not enough",
  },
  bad: {
    label: "Bad",
    cssVar: "--status-bad",
    description: "Entry started, nothing completed",
  },
  empty: {
    label: "—",
    cssVar: "--status-empty",
    description: "No entry",
  },
};

/**
 * Journal day status from task counts.
 *
 * sum = nonNegDone + goalsDone + secondaryDone
 * allNonNegDone = nonNegTotal > 0 && nonNegDone === nonNegTotal
 *
 * empty if !hasEntry
 * crazy if  allNonNegDone && sum >= 3
 * great if  allNonNegDone && sum  < 3
 * good  if !allNonNegDone && sum >= 3
 * avg   if !allNonNegDone && sum  < 3 && sum > 0
 * bad   if !allNonNegDone && sum === 0
 */
export function computeJournalStatus(input: {
  nonNegTotal: number;
  nonNegDone: number;
  goalsDone: number;
  secondaryDone: number;
  hasEntry: boolean;
}): JournalStatus {
  if (!input.hasEntry) return "empty";
  const sum = input.nonNegDone + input.goalsDone + input.secondaryDone;
  const allNonNegDone = input.nonNegTotal > 0 && input.nonNegDone === input.nonNegTotal;
  if (allNonNegDone) return sum >= 3 ? "crazy" : "great";
  if (sum >= 3) return "good";
  if (sum > 0) return "avg";
  return "bad";
}

/**
 * Habit day status from the raw count of habits checked off that day.
 *
 * crazy if doneCount >= 5
 * great if doneCount === 4
 * good  if doneCount === 3
 * avg   if doneCount in [1, 2]
 * bad   if doneCount === 0 (and there were active habits that day)
 * empty if no habits were active that day at all
 */
export function computeHabitsStatus(
  doneCount: number,
  hadActiveHabits: boolean,
): JournalStatus {
  if (!hadActiveHabits) return "empty";
  if (doneCount >= 5) return "crazy";
  if (doneCount === 4) return "great";
  if (doneCount === 3) return "good";
  if (doneCount >= 1) return "avg";
  return "bad";
}

export function statusBg(status: JournalStatus): string {
  return `var(${STATUS_META[status].cssVar})`;
}
