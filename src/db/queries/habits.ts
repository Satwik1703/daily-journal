import { db } from "@/db/client";
import { habits, habitLogs, habitValueLogs, pomodoroSessions } from "@/db/schema";
import { and, asc, between, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { addDays, parseDate, todayLocal, type DateString } from "@/lib/dates";
import {
  isHabitActiveOnWeekday,
  isHabitDoneOnDate,
  xpForHabit,
  type HabitTrackingKind,
} from "@/lib/habit-meta";

export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type HabitValueLog = typeof habitValueLogs.$inferSelect;
/** Alias used by client UI imports (today-toggles). */
export type HabitValueLogRow = HabitValueLog;

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

/** Per-day value sums for the given range, grouped by habit_id then date. */
export async function getValueLogsInRange(
  start: DateString,
  end: DateString,
): Promise<HabitValueLog[]> {
  return db
    .select()
    .from(habitValueLogs)
    .where(between(habitValueLogs.date, start, end));
}

/** Per-day session counts grouped by category for the given range. */
export async function getPomoSessionsInRange(
  start: DateString,
  end: DateString,
): Promise<Array<{ date: string; categoryId: string | null }>> {
  return db
    .select({ date: pomodoroSessions.date, categoryId: pomodoroSessions.categoryId })
    .from(pomodoroSessions)
    .where(between(pomodoroSessions.date, start, end));
}

export type HabitsSnapshot = {
  /** All non-archived habits (no weekday-mask filtering). Use for grids spanning a range. */
  active: Habit[];
  /** Subset of `active` whose `weekdayMask` includes `anchor`'s weekday. */
  activeForAnchor: Habit[];
  archived: Habit[];
  /** The date the page is centered on. Today by default; a past date when backfilling. */
  anchor: DateString;
  today: DateString;
  /** Habits that are "done" on `anchor` per their tracking kind. */
  doneOnAnchorIds: Set<string>;
  /** Map<habitId, Set<dateString>> for the last `windowDays` ending on `anchor` (binary kind). */
  windowLogs: Map<string, Set<DateString>>;
  /** Map<habitId, Map<dateString, sumValue>> for number-kind habits. */
  windowValuesByHabit: Map<string, Map<DateString, number>>;
  /** Map<habitId, Map<dateString, sessionCount>> for pomo-kind habits. */
  windowPomoByHabit: Map<string, Map<DateString, number>>;
  windowDates: DateString[];
};

export async function getHabitsSnapshot(
  opts: { anchor?: DateString; windowDays?: number } = {},
): Promise<HabitsSnapshot> {
  const today = todayLocal();
  const anchor = opts.anchor ?? today;
  const windowDays = opts.windowDays ?? 7;
  const start = addDays(anchor, -(windowDays - 1));

  const [active, archived, rangeLogs, valueLogs, pomoSessions] = await Promise.all([
    getActiveHabits(),
    getArchivedHabits(),
    getLogsInRange(start, anchor),
    getValueLogsInRange(start, anchor),
    getPomoSessionsInRange(start, anchor),
  ]);

  // Phase 10: subset for `anchor`-day rendering (weekday mask filter).
  const anchorWeekday = parseDate(anchor).getDay();
  const activeForAnchor = active.filter((h) =>
    isHabitActiveOnWeekday(h.weekdayMask, anchorWeekday),
  );

  // ----- Binary windowLogs -----
  const windowLogs = new Map<string, Set<DateString>>();
  for (const log of rangeLogs) {
    let set = windowLogs.get(log.habitId);
    if (!set) {
      set = new Set();
      windowLogs.set(log.habitId, set);
    }
    set.add(log.date);
  }

  // ----- Number values: habitId -> (date -> sum) -----
  const windowValuesByHabit = new Map<string, Map<DateString, number>>();
  for (const v of valueLogs) {
    let dayMap = windowValuesByHabit.get(v.habitId);
    if (!dayMap) {
      dayMap = new Map();
      windowValuesByHabit.set(v.habitId, dayMap);
    }
    dayMap.set(v.date, (dayMap.get(v.date) ?? 0) + v.value);
  }

  // ----- Pomo sessions: build (categoryId -> date -> count) then bind to pomo-kind habits -----
  const sessionsByCatDate = new Map<string, Map<DateString, number>>();
  for (const s of pomoSessions) {
    if (!s.categoryId) continue;
    let dayMap = sessionsByCatDate.get(s.categoryId);
    if (!dayMap) {
      dayMap = new Map();
      sessionsByCatDate.set(s.categoryId, dayMap);
    }
    dayMap.set(s.date, (dayMap.get(s.date) ?? 0) + 1);
  }

  const windowPomoByHabit = new Map<string, Map<DateString, number>>();
  for (const h of active) {
    if (h.trackingKind !== "pomodoro" || !h.pomoCategoryId) continue;
    const catMap = sessionsByCatDate.get(h.pomoCategoryId);
    if (catMap) windowPomoByHabit.set(h.id, new Map(catMap));
  }

  // ----- doneOnAnchorIds via kind-aware check (only for masked-on habits) -----
  const doneOnAnchorIds = new Set<string>();
  for (const h of activeForAnchor) {
    const kind = h.trackingKind as HabitTrackingKind;
    const hadLog = windowLogs.get(h.id)?.has(anchor) ?? false;
    const daySumOrCount =
      kind === "number"
        ? windowValuesByHabit.get(h.id)?.get(anchor) ?? 0
        : kind === "pomodoro"
          ? windowPomoByHabit.get(h.id)?.get(anchor) ?? 0
          : 0;
    if (isHabitDoneOnDate(kind, h.dailyTarget, daySumOrCount, hadLog)) {
      doneOnAnchorIds.add(h.id);
    }
  }

  const windowDates: DateString[] = [];
  for (let i = 0; i < windowDays; i++) {
    windowDates.push(addDays(start, i));
  }

  return {
    active,
    activeForAnchor,
    archived,
    anchor,
    today,
    doneOnAnchorIds,
    windowLogs,
    windowValuesByHabit,
    windowPomoByHabit,
    windowDates,
  };
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

// Phase 11.1: deltas history per habit on a single date. Used by the NumberRow
// popover to list and delete individual entries.
export async function getValueLogsOnDate(
  date: DateString,
): Promise<Record<string, HabitValueLog[]>> {
  const rows = await db
    .select()
    .from(habitValueLogs)
    .where(eq(habitValueLogs.date, date))
    .orderBy(desc(habitValueLogs.createdAt));
  const out: Record<string, HabitValueLog[]> = {};
  for (const r of rows) {
    let arr = out[r.habitId];
    if (!arr) {
      arr = [];
      out[r.habitId] = arr;
    }
    arr.push(r);
  }
  return out;
}

/**
 * Phase 11.1: all-time XP per habit. Derived live from logs (no persisted
 * field). Three queries (binary count, number per-day sums, pomo per-day
 * counts) then aggregated in JS so we never N+1.
 */
export async function getXpByHabit(): Promise<Record<string, number>> {
  const [active, allBinary, allValue, allPomo] = await Promise.all([
    db.select().from(habits),
    db.select().from(habitLogs),
    db.select().from(habitValueLogs),
    db
      .select({ date: pomodoroSessions.date, categoryId: pomodoroSessions.categoryId })
      .from(pomodoroSessions),
  ]);

  // Binary: count per habit.
  const binaryDays = new Map<string, number>();
  for (const r of allBinary) {
    binaryDays.set(r.habitId, (binaryDays.get(r.habitId) ?? 0) + 1);
  }

  // Number: per-habit per-date sums.
  const valueSumByHabitDate = new Map<string, Map<string, number>>();
  for (const r of allValue) {
    let m = valueSumByHabitDate.get(r.habitId);
    if (!m) {
      m = new Map();
      valueSumByHabitDate.set(r.habitId, m);
    }
    m.set(r.date, (m.get(r.date) ?? 0) + r.value);
  }

  // Pomo: per-category per-date counts.
  const pomoCountByCatDate = new Map<string, Map<string, number>>();
  for (const r of allPomo) {
    if (!r.categoryId) continue;
    let m = pomoCountByCatDate.get(r.categoryId);
    if (!m) {
      m = new Map();
      pomoCountByCatDate.set(r.categoryId, m);
    }
    m.set(r.date, (m.get(r.date) ?? 0) + 1);
  }

  const out: Record<string, number> = {};
  for (const h of active) {
    const kind = h.trackingKind as HabitTrackingKind;
    let qualifyingDays = 0;
    if (kind === "binary") {
      qualifyingDays = binaryDays.get(h.id) ?? 0;
    } else if (kind === "number") {
      const m = valueSumByHabitDate.get(h.id);
      if (m && h.dailyTarget != null && h.dailyTarget > 0) {
        for (const sum of m.values()) {
          if (sum >= h.dailyTarget) qualifyingDays++;
        }
      } else if (m) {
        qualifyingDays = m.size; // any-positive-counts when no target
      }
    } else if (kind === "pomodoro" && h.pomoCategoryId) {
      const m = pomoCountByCatDate.get(h.pomoCategoryId);
      if (m && h.dailyTarget != null && h.dailyTarget > 0) {
        for (const count of m.values()) {
          if (count >= h.dailyTarget) qualifyingDays++;
        }
      } else if (m) {
        qualifyingDays = m.size;
      }
    }
    out[h.id] = xpForHabit(qualifyingDays, h.difficulty ?? 1);
  }
  return out;
}
