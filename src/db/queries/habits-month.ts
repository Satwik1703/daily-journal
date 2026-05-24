import { db } from "@/db/client";
import { habits, habitLogs, habitValueLogs, pomodoroSessions } from "@/db/schema";
import { between } from "drizzle-orm";
import { formatLocalYMD, parseDate, type DateString } from "@/lib/dates";
import { computeHabitsStatus, type JournalStatus } from "@/lib/journal-status";
import {
  isHabitActiveOnWeekday,
  isHabitDoneOnDate,
  type HabitTrackingKind,
} from "@/lib/habit-meta";

/**
 * For each date in [start, end], compute the habits-day status from the
 * count of habits "done" that day (kind-aware) and whether any habit was
 * active that day. A habit is "active on date" if `createdAt <= date`,
 * (`archivedAt is null OR archivedAt > date`), and its `weekdayMask`
 * includes that weekday.
 *
 * Per-kind "done" derivation:
 *  - binary   → `habit_logs` row exists for (habitId, date)
 *  - number   → SUM(habit_value_logs.value) for that date >= dailyTarget
 *  - pomodoro → COUNT(pomodoro_sessions) for linked category that date >= dailyTarget
 */
export async function getHabitsMonthStatus(
  start: DateString,
  end: DateString,
): Promise<Record<DateString, JournalStatus>> {
  const [allHabits, rangeLogs, rangeValueLogs, rangePomoSessions] = await Promise.all([
    db
      .select({
        id: habits.id,
        trackingKind: habits.trackingKind,
        dailyTarget: habits.dailyTarget,
        pomoCategoryId: habits.pomoCategoryId,
        createdAt: habits.createdAt,
        archivedAt: habits.archivedAt,
        weekdayMask: habits.weekdayMask,
      })
      .from(habits),
    db
      .select({ date: habitLogs.date, habitId: habitLogs.habitId })
      .from(habitLogs)
      .where(between(habitLogs.date, start, end)),
    db
      .select({
        date: habitValueLogs.date,
        habitId: habitValueLogs.habitId,
        value: habitValueLogs.value,
      })
      .from(habitValueLogs)
      .where(between(habitValueLogs.date, start, end)),
    db
      .select({
        date: pomodoroSessions.date,
        categoryId: pomodoroSessions.categoryId,
      })
      .from(pomodoroSessions)
      .where(between(pomodoroSessions.date, start, end)),
  ]);

  // Binary logs → habitId → set of dates with a log row.
  const binaryLogsByHabit = new Map<string, Set<DateString>>();
  for (const l of rangeLogs) {
    let s = binaryLogsByHabit.get(l.habitId);
    if (!s) { s = new Set(); binaryLogsByHabit.set(l.habitId, s); }
    s.add(l.date);
  }

  // Number values → habitId → date → summed value.
  const valuesByHabit = new Map<string, Map<DateString, number>>();
  for (const v of rangeValueLogs) {
    let m = valuesByHabit.get(v.habitId);
    if (!m) { m = new Map(); valuesByHabit.set(v.habitId, m); }
    m.set(v.date, (m.get(v.date) ?? 0) + v.value);
  }

  // Pomo sessions → categoryId → date → session count.
  const sessionsByCatDate = new Map<string, Map<DateString, number>>();
  for (const s of rangePomoSessions) {
    if (!s.categoryId) continue;
    let m = sessionsByCatDate.get(s.categoryId);
    if (!m) { m = new Map(); sessionsByCatDate.set(s.categoryId, m); }
    m.set(s.date, (m.get(s.date) ?? 0) + 1);
  }

  function activeOn(date: DateString) {
    const weekday = parseDate(date).getDay();
    return allHabits.filter(
      (h) =>
        formatLocalYMD(h.createdAt) <= date &&
        (h.archivedAt === null || formatLocalYMD(h.archivedAt) > date) &&
        isHabitActiveOnWeekday(h.weekdayMask, weekday),
    );
  }

  function doneCountOn(date: DateString, activeList: typeof allHabits): number {
    let n = 0;
    for (const h of activeList) {
      const kind = h.trackingKind as HabitTrackingKind;
      const hadLog =
        kind === "binary"
          ? binaryLogsByHabit.get(h.id)?.has(date) ?? false
          : false;
      const daySumOrCount =
        kind === "number"
          ? valuesByHabit.get(h.id)?.get(date) ?? 0
          : kind === "pomodoro"
            ? h.pomoCategoryId
              ? sessionsByCatDate.get(h.pomoCategoryId)?.get(date) ?? 0
              : 0
            : 0;
      if (isHabitDoneOnDate(kind, h.dailyTarget, daySumOrCount, hadLog)) n++;
    }
    return n;
  }

  const out: Record<DateString, JournalStatus> = {};
  let d = start;
  while (d <= end) {
    const active = activeOn(d);
    out[d] = computeHabitsStatus(doneCountOn(d, active), active.length > 0);
    const [y, m, day] = d.split("-").map(Number);
    const next = new Date(y, m - 1, day + 1);
    d = formatLocalYMD(next);
  }
  return out;
}
