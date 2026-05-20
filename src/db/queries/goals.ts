import { db } from "@/db/client";
import {
  goals,
  goalProgress,
  goalChecklist,
  habits,
  habitLogs,
  habitValueLogs,
  pomodoroSessions,
} from "@/db/schema";
import { and, asc, between, eq, inArray, isNull, sum, count } from "drizzle-orm";
import {
  periodRangeFor,
  shiftPeriodKey,
  todayLocal,
  type DateString,
  type GoalPeriod,
} from "@/lib/dates";
import { pomoUnits } from "@/lib/pomodoro-meta";

export type GoalRow = typeof goals.$inferSelect;
export type GoalProgressRow = typeof goalProgress.$inferSelect;
export type GoalChecklistItem = typeof goalChecklist.$inferSelect;

export type GoalWithDerived = GoalRow & {
  /**
   * Type-dependent derived progress value.
   *  - number:    SUM(goalProgress.delta) for this goal
   *  - habit:     habit_logs in period (Day C will populate; Day B returns 0)
   *  - pomodoro:  pomodoro_sessions in period (Day C will populate; Day B returns 0)
   *  - milestone: count of done checklist items (NOT a ratio — caller divides by total)
   */
  currentValue: number;
  checklist?: GoalChecklistItem[];
  children?: GoalWithDerived[];
};

// ---------- Internal helpers ----------

async function listChecklistsForGoals(goalIds: string[]): Promise<Map<string, GoalChecklistItem[]>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(goalChecklist)
    .where(inArray(goalChecklist.goalId, goalIds))
    .orderBy(asc(goalChecklist.position), asc(goalChecklist.id));
  const out = new Map<string, GoalChecklistItem[]>();
  for (const r of rows) {
    let arr = out.get(r.goalId);
    if (!arr) {
      arr = [];
      out.set(r.goalId, arr);
    }
    arr.push(r);
  }
  return out;
}

async function sumProgressForGoals(goalIds: string[]): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db
    .select({
      goalId: goalProgress.goalId,
      total: sum(goalProgress.delta).mapWith(Number),
    })
    .from(goalProgress)
    .where(inArray(goalProgress.goalId, goalIds))
    .groupBy(goalProgress.goalId);
  return new Map(rows.map((r) => [r.goalId, r.total ?? 0]));
}

/**
 * Days-in-range that the habit was "done", per its tracking kind.
 *  - binary  → count habit_logs rows (already one per day, PK)
 *  - number  → count distinct dates where SUM(value) >= dailyTarget
 *  - pomodoro → count distinct dates where COUNT(sessions for cat) >= dailyTarget
 *
 * Habit row is loaded once so we can dispatch on `trackingKind`. Missing or
 * malformed daily_target collapses to "any positive value counts" so a
 * goal linked to a misconfigured number/pomo habit still has a working
 * derivation rather than silently sitting at 0.
 */
async function habitCountInRange(
  habitId: string,
  start: DateString,
  end: DateString,
): Promise<number> {
  const habitRow = await db
    .select({
      trackingKind: habits.trackingKind,
      dailyTarget: habits.dailyTarget,
      pomoCategoryId: habits.pomoCategoryId,
    })
    .from(habits)
    .where(eq(habits.id, habitId))
    .limit(1);
  const h = habitRow[0];
  if (!h) return 0;

  if (h.trackingKind === "binary") {
    const rows = await db
      .select({ n: count(habitLogs.date) })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), between(habitLogs.date, start, end)));
    return rows[0]?.n ?? 0;
  }

  if (h.trackingKind === "number") {
    const rows = await db
      .select({ date: habitValueLogs.date, value: habitValueLogs.value })
      .from(habitValueLogs)
      .where(and(eq(habitValueLogs.habitId, habitId), between(habitValueLogs.date, start, end)));
    const perDay = new Map<string, number>();
    for (const r of rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.value);
    const target = h.dailyTarget && h.dailyTarget > 0 ? h.dailyTarget : null;
    let qualifying = 0;
    for (const v of perDay.values()) {
      if (target == null ? v > 0 : v >= target) qualifying++;
    }
    return qualifying;
  }

  // pomodoro
  if (!h.pomoCategoryId) return 0;
  const rows = await db
    .select({ date: pomodoroSessions.date })
    .from(pomodoroSessions)
    .where(
      and(
        eq(pomodoroSessions.categoryId, h.pomoCategoryId),
        between(pomodoroSessions.date, start, end),
      ),
    );
  const perDay = new Map<string, number>();
  for (const r of rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + 1);
  const target = h.dailyTarget && h.dailyTarget > 0 ? h.dailyTarget : null;
  let qualifying = 0;
  for (const v of perDay.values()) {
    if (target == null ? v > 0 : v >= target) qualifying++;
  }
  return qualifying;
}

async function pomodoroValueInRange(
  pomoCategoryId: string | null,
  metric: "minutes" | "pomos" | "sessions",
  start: DateString,
  end: DateString,
): Promise<number> {
  const filters = [between(pomodoroSessions.date, start, end)];
  if (pomoCategoryId) filters.push(eq(pomodoroSessions.categoryId, pomoCategoryId));
  const rows = await db
    .select({ duration: pomodoroSessions.durationMin })
    .from(pomodoroSessions)
    .where(and(...filters));
  if (metric === "sessions") return rows.length;
  if (metric === "minutes") return rows.reduce((acc, r) => acc + (r.duration ?? 0), 0);
  // pomos
  return rows.reduce((acc, r) => acc + pomoUnits(r.duration ?? 0), 0);
}

/**
 * Derive currentValue per goal type.
 *  - number:    SUM(goalProgress.delta) for the goal
 *  - habit:     COUNT(habit_logs) where date in period range
 *  - pomodoro:  SUM/COUNT pomodoroSessions filtered by category + metric
 *  - milestone: COUNT of done checklist items
 */
async function deriveCurrentValues(
  rows: GoalRow[],
  rangeFor: (g: GoalRow) => { start: DateString; end: DateString },
): Promise<{
  values: Map<string, number>;
  checklists: Map<string, GoalChecklistItem[]>;
}> {
  const numberIds = rows.filter((r) => r.type === "number").map((r) => r.id);
  const milestoneIds = rows.filter((r) => r.type === "milestone").map((r) => r.id);
  const habitGoals = rows.filter((r) => r.type === "habit" && r.habitId);
  const pomoGoals = rows.filter((r) => r.type === "pomodoro" && r.pomoMetric);

  const [numberTotals, checklists, habitCounts, pomoValues] = await Promise.all([
    sumProgressForGoals(numberIds),
    listChecklistsForGoals(milestoneIds),
    Promise.all(
      habitGoals.map(async (g) => {
        const { start, end } = rangeFor(g);
        const n = await habitCountInRange(g.habitId!, start, end);
        return [g.id, n] as const;
      }),
    ),
    Promise.all(
      pomoGoals.map(async (g) => {
        const { start, end } = rangeFor(g);
        const n = await pomodoroValueInRange(
          g.pomoCategoryId ?? null,
          g.pomoMetric as "minutes" | "pomos" | "sessions",
          start,
          end,
        );
        return [g.id, n] as const;
      }),
    ),
  ]);

  const habitMap = new Map(habitCounts);
  const pomoMap = new Map(pomoValues);

  const values = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "number") {
      values.set(r.id, numberTotals.get(r.id) ?? 0);
    } else if (r.type === "milestone") {
      const items = checklists.get(r.id) ?? [];
      values.set(r.id, items.filter((i) => i.done).length);
    } else if (r.type === "habit") {
      values.set(r.id, habitMap.get(r.id) ?? 0);
    } else if (r.type === "pomodoro") {
      values.set(r.id, pomoMap.get(r.id) ?? 0);
    } else {
      values.set(r.id, 0);
    }
  }
  return { values, checklists };
}

// ---------- Public API ----------

/**
 * Fetch all goals for a (period, periodKey) including derived currentValue
 * and (for milestones) inline checklist items.
 *
 * Auto-finalize: if the period's `end < today` and any goal is still
 * `active`, this stamps them to `achieved` / `missed` based on derived
 * progress. Idempotent — only touches rows with `finalizedAt = null`. No
 * cron required.
 */
export async function getGoalsForPeriod(
  period: GoalPeriod,
  periodKey: string,
): Promise<GoalWithDerived[]> {
  const range = periodRangeFor(periodKey, period);
  const rows = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.period, period),
        eq(goals.periodKey, periodKey),
        isNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.position), asc(goals.createdAt));

  if (rows.length === 0) return [];

  const rangeFor = () => range;

  const { values, checklists } = await deriveCurrentValues(rows, rangeFor);

  // Lazy auto-finalize for closed periods.
  const today = todayLocal();
  if (range.end < today) {
    const stillActive = rows.filter(
      (r) => r.status === "active" && r.finalizedAt == null,
    );
    if (stillActive.length > 0) {
      const now = new Date();
      await Promise.all(
        stillActive.map(async (g) => {
          let achieved = false;
          const target = g.targetValue;
          const current = values.get(g.id) ?? 0;
          if (g.type === "milestone") {
            const items = checklists.get(g.id) ?? [];
            achieved = items.length > 0 && items.every((i) => i.done);
          } else if (target != null && target > 0) {
            achieved = current >= target;
          }
          await db
            .update(goals)
            .set({ status: achieved ? "achieved" : "missed", finalizedAt: now })
            .where(eq(goals.id, g.id));
          // Reflect locally so this read sees the new status.
          (g as GoalRow).status = achieved ? "achieved" : "missed";
          (g as GoalRow).finalizedAt = now;
        }),
      );
    }
  }

  return rows.map((r) => ({
    ...r,
    currentValue: values.get(r.id) ?? 0,
    checklist: r.type === "milestone" ? checklists.get(r.id) ?? [] : undefined,
  }));
}

/**
 * History strip data: the most recent N periods preceding `currentKey`.
 * Returns an entry per period containing the goals (with derived values)
 * so the caller can render colored summary chips.
 */
export async function getGoalsHistory(
  period: GoalPeriod,
  currentKey: string,
  count: number,
): Promise<Array<{ periodKey: string; goals: GoalWithDerived[] }>> {
  const keys: string[] = [];
  let k = currentKey;
  for (let i = 0; i < count; i++) {
    k = shiftPeriodKey(k, period, -1);
    keys.push(k);
  }
  const results: Array<{ periodKey: string; goals: GoalWithDerived[] }> = [];
  for (const key of keys) {
    const goalsForKey = await getGoalsForPeriod(period, key);
    results.push({ periodKey: key, goals: goalsForKey });
  }
  return results;
}

/**
 * Per-week status map for the goals heatmap on the year view. Computed by
 * loading all goals for the year (and its month/week children) and folding
 * them per ISO week into the shared status palette.
 */
export async function getGoalsYearHeatmap(
  year: number,
): Promise<{ byWeek: Record<string, "crazy" | "great" | "good" | "avg" | "bad" | "empty"> }> {
  // Pull every goal whose periodKey starts with the year.
  const allRows = await db
    .select()
    .from(goals)
    .where(isNull(goals.archivedAt));
  const yearStr = String(year);
  const inYear = allRows.filter((r) => r.periodKey.startsWith(yearStr));
  if (inYear.length === 0) return { byWeek: {} };

  const { values, checklists } = await deriveCurrentValues(inYear, (g) =>
    periodRangeFor(g.periodKey, g.period as GoalPeriod),
  );

  // Group week-period goals by week; ignore month/year aggregates for the
  // cell color (they'd otherwise dominate the heatmap with their own status).
  const weeklyByKey = new Map<string, typeof inYear>();
  for (const g of inYear) {
    if (g.period !== "week") continue;
    let arr = weeklyByKey.get(g.periodKey);
    if (!arr) {
      arr = [];
      weeklyByKey.set(g.periodKey, arr);
    }
    arr.push(g);
  }

  const byWeek: Record<string, "crazy" | "great" | "good" | "avg" | "bad" | "empty"> = {};
  const today = todayLocal();
  for (const [weekKey, group] of weeklyByKey) {
    let achieved = 0;
    for (const g of group) {
      const target =
        g.type === "milestone"
          ? (checklists.get(g.id)?.length ?? 0) || 1
          : g.targetValue ?? null;
      const cur = values.get(g.id) ?? 0;
      if (target != null && target > 0 && cur >= target) achieved++;
    }
    const ratio = achieved / group.length;
    byWeek[weekKey] =
      ratio >= 1 ? "crazy" : ratio >= 0.66 ? "great" : ratio >= 0.33 ? "good" : ratio > 0 ? "avg" : "bad";
    void today;
  }

  return { byWeek };
}

/**
 * Children grafted onto a parent goal. Used for cascade rollup display on
 * year/month view. Returns child rows with derived currentValue.
 */
export async function getChildrenOfGoal(
  parentId: string,
): Promise<GoalWithDerived[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.parentId, parentId), isNull(goals.archivedAt)))
    .orderBy(asc(goals.periodKey));
  if (rows.length === 0) return [];
  const { values, checklists } = await deriveCurrentValues(rows, (g) =>
    periodRangeFor(g.periodKey, g.period as GoalPeriod),
  );
  return rows.map((r) => ({
    ...r,
    currentValue: values.get(r.id) ?? 0,
    checklist: r.type === "milestone" ? checklists.get(r.id) ?? [] : undefined,
  }));
}

/** Find a single goal (any period) by id. Useful for action validation. */
export async function findGoalById(id: string): Promise<GoalRow | null> {
  const rows = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Next position within a (period, periodKey) bucket. */
export async function nextPositionFor(
  period: GoalPeriod,
  periodKey: string,
): Promise<number> {
  const rows = await db
    .select({ position: goals.position })
    .from(goals)
    .where(and(eq(goals.period, period), eq(goals.periodKey, periodKey)));
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.position)) + 1;
}

/**
 * Cheap helper: in-period date range for a periodKey. Re-exported here so
 * callers in server code don't need to import lib/dates separately.
 */
export function rangeForPeriod(
  periodKey: string,
  period: GoalPeriod,
): { start: DateString; end: DateString } {
  return periodRangeFor(periodKey, period);
}

/** Today helper, here for parity with other queries that already do this. */
export function getToday(): DateString {
  return todayLocal();
}
