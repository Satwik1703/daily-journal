import { addDays, todayLocal, type DateString } from "@/lib/dates";

/**
 * Compute current and longest streak (consecutive days) for a sorted set of date strings.
 * "Current" is counted as the run ending today OR yesterday — yesterday because the user may
 * not have logged today's habit yet.
 */
export function computeStreaks(dates: Iterable<DateString>): {
  current: number;
  longest: number;
} {
  const set = new Set(dates);
  if (set.size === 0) return { current: 0, longest: 0 };

  // longest run anywhere in the set
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: DateString | null = null;
  for (const d of sorted) {
    if (prev !== null && addDays(prev, 1) === d) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // current: walk backwards from today, allow today missing if yesterday is present
  const today = todayLocal();
  let cursor = today;
  if (!set.has(cursor)) {
    cursor = addDays(today, -1);
    if (!set.has(cursor)) return { current: 0, longest };
  }
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}
