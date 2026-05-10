import { db } from "@/db/client";
import { habits, habitLogs } from "@/db/schema";
import { between } from "drizzle-orm";
import { formatLocalYMD, type DateString } from "@/lib/dates";
import { computeHabitsStatus, type JournalStatus } from "@/lib/journal-status";

/**
 * For each date in [start, end], compute the habits-day status from the raw
 * count of habits checked off and whether any habit was active that day.
 * A habit is "active on date" if `createdAt <= date` and
 * (`archivedAt is null OR archivedAt > date`).
 */
export async function getHabitsMonthStatus(
  start: DateString,
  end: DateString,
): Promise<Record<DateString, JournalStatus>> {
  const [allHabits, rangeLogs] = await Promise.all([
    db
      .select({
        createdAt: habits.createdAt,
        archivedAt: habits.archivedAt,
      })
      .from(habits),
    db
      .select({ date: habitLogs.date, habitId: habitLogs.habitId })
      .from(habitLogs)
      .where(between(habitLogs.date, start, end)),
  ]);

  // Bucket logs by date — each (habit, date) appears once thanks to the PK.
  const doneByDate = new Map<DateString, number>();
  for (const l of rangeLogs) {
    doneByDate.set(l.date, (doneByDate.get(l.date) ?? 0) + 1);
  }

  // Precompute habit lifespans as YMD strings for fast string comparison.
  const lifespans = allHabits.map((h) => ({
    createdYmd: formatLocalYMD(h.createdAt),
    archivedYmd: h.archivedAt ? formatLocalYMD(h.archivedAt) : null,
  }));

  function hadActiveHabits(date: DateString): boolean {
    for (const s of lifespans) {
      if (s.createdYmd <= date && (s.archivedYmd === null || s.archivedYmd > date)) {
        return true;
      }
    }
    return false;
  }

  // Iterate every date in the range — we need an entry per day so the calendar
  // can render "bad" days (had habits but logged nothing) vs "empty".
  const out: Record<DateString, JournalStatus> = {};
  let d = start;
  while (d <= end) {
    out[d] = computeHabitsStatus(doneByDate.get(d) ?? 0, hadActiveHabits(d));
    // increment by one day
    const [y, m, day] = d.split("-").map(Number);
    const next = new Date(y, m - 1, day + 1);
    d = formatLocalYMD(next);
  }
  return out;
}
