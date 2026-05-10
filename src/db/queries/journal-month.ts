import { db } from "@/db/client";
import { journalEntries, journalTasks } from "@/db/schema";
import { and, between, gte, lte } from "drizzle-orm";
import { computeJournalStatus, type JournalStatus } from "@/lib/journal-status";
import type { DateString } from "@/lib/dates";

type TaskAgg = {
  // per-date counts
  nonNegTotal: number;
  nonNegDone: number;
  goalsDone: number;
  secondaryDone: number;
};

function emptyAgg(): TaskAgg {
  return { nonNegTotal: 0, nonNegDone: 0, goalsDone: 0, secondaryDone: 0 };
}

/**
 * Map<DateString, JournalStatus> for every date in [start, end] that has any
 * journal data. Dates with no entry and no tasks are omitted (callers treat
 * them as "empty").
 */
export async function getJournalMonthStatus(
  start: DateString,
  end: DateString,
): Promise<Record<DateString, JournalStatus>> {
  const [entryRows, taskRows] = await Promise.all([
    db
      .select({ date: journalEntries.date })
      .from(journalEntries)
      .where(and(gte(journalEntries.date, start), lte(journalEntries.date, end))),
    db
      .select({
        date: journalTasks.date,
        kind: journalTasks.kind,
        done: journalTasks.done,
      })
      .from(journalTasks)
      .where(between(journalTasks.date, start, end)),
  ]);

  const hasEntryByDate = new Set<DateString>(entryRows.map((r) => r.date));
  const aggByDate = new Map<DateString, TaskAgg>();

  for (const t of taskRows) {
    let agg = aggByDate.get(t.date);
    if (!agg) {
      agg = emptyAgg();
      aggByDate.set(t.date, agg);
    }
    if (t.kind === "nonNegotiable") {
      agg.nonNegTotal += 1;
      if (t.done) agg.nonNegDone += 1;
    } else if (t.kind === "goal") {
      if (t.done) agg.goalsDone += 1;
    } else if (t.kind === "secondary") {
      if (t.done) agg.secondaryDone += 1;
    }
  }

  // Union of dates that have either an entry or any task.
  const dates = new Set<DateString>(hasEntryByDate);
  for (const d of aggByDate.keys()) dates.add(d);

  const out: Record<DateString, JournalStatus> = {};
  for (const d of dates) {
    const agg = aggByDate.get(d) ?? emptyAgg();
    out[d] = computeJournalStatus({
      nonNegTotal: agg.nonNegTotal,
      nonNegDone: agg.nonNegDone,
      goalsDone: agg.goalsDone,
      secondaryDone: agg.secondaryDone,
      hasEntry: hasEntryByDate.has(d),
    });
  }
  return out;
}
