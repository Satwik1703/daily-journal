import { db } from "@/db/client";
import { habits, habitLogs } from "@/db/schema";
import { and, asc, between, eq, isNotNull, isNull } from "drizzle-orm";
import { addDays, todayLocal, type DateString } from "@/lib/dates";

export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;

export async function getActiveHabits(): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(isNull(habits.archivedAt))
    .orderBy(asc(habits.position), asc(habits.createdAt));
}

export async function getArchivedHabits(): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(isNotNull(habits.archivedAt))
    .orderBy(asc(habits.archivedAt));
}

export async function getLogsOnDate(date: DateString): Promise<HabitLog[]> {
  return db.select().from(habitLogs).where(eq(habitLogs.date, date));
}

export async function getLogsInRange(start: DateString, end: DateString): Promise<HabitLog[]> {
  return db.select().from(habitLogs).where(between(habitLogs.date, start, end));
}

export type HabitsSnapshot = {
  active: Habit[];
  archived: Habit[];
  today: DateString;
  doneTodayIds: Set<string>;
  /** Map<habitId, Set<dateString>> for last `windowDays` days inclusive of today */
  windowLogs: Map<string, Set<DateString>>;
  windowDates: DateString[];
};

export async function getHabitsSnapshot(windowDays = 30): Promise<HabitsSnapshot> {
  const today = todayLocal();
  const start = addDays(today, -(windowDays - 1));
  const [active, archived, rangeLogs] = await Promise.all([
    getActiveHabits(),
    getArchivedHabits(),
    getLogsInRange(start, today),
  ]);

  const windowLogs = new Map<string, Set<DateString>>();
  const doneTodayIds = new Set<string>();
  for (const log of rangeLogs) {
    let set = windowLogs.get(log.habitId);
    if (!set) {
      set = new Set();
      windowLogs.set(log.habitId, set);
    }
    set.add(log.date);
    if (log.date === today) doneTodayIds.add(log.habitId);
  }

  const windowDates: DateString[] = [];
  for (let i = 0; i < windowDays; i++) {
    windowDates.push(addDays(start, i));
  }

  return { active, archived, today, doneTodayIds, windowLogs, windowDates };
}

export async function findHabitById(id: string): Promise<Habit | null> {
  const rows = await db.select().from(habits).where(eq(habits.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function nextPosition(): Promise<number> {
  const all = await db.select({ position: habits.position }).from(habits);
  if (all.length === 0) return 0;
  return Math.max(...all.map((r) => r.position)) + 1;
}

// Used to validate (habitId belongs to non-archived habit) before logging.
export async function isActiveHabit(id: string): Promise<boolean> {
  const rows = await db
    .select({ archivedAt: habits.archivedAt })
    .from(habits)
    .where(and(eq(habits.id, id), isNull(habits.archivedAt)))
    .limit(1);
  return rows.length > 0;
}
