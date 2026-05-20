import { db } from "@/db/client";
import { goals, goalProgress, goalChecklist } from "@/db/schema";
import { and, asc, eq, inArray, isNull, sum } from "drizzle-orm";
import {
  periodRangeFor,
  todayLocal,
  type DateString,
  type GoalPeriod,
} from "@/lib/dates";

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
 * Derive currentValue per goal type. Day B implements number + milestone.
 * Habit / pomodoro types return 0 here and will be filled in Day C.
 */
async function deriveCurrentValues(rows: GoalRow[]): Promise<{
  values: Map<string, number>;
  checklists: Map<string, GoalChecklistItem[]>;
}> {
  const numberIds = rows.filter((r) => r.type === "number").map((r) => r.id);
  const milestoneIds = rows.filter((r) => r.type === "milestone").map((r) => r.id);

  const [numberTotals, checklists] = await Promise.all([
    sumProgressForGoals(numberIds),
    listChecklistsForGoals(milestoneIds),
  ]);

  const values = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "number") {
      values.set(r.id, numberTotals.get(r.id) ?? 0);
    } else if (r.type === "milestone") {
      const items = checklists.get(r.id) ?? [];
      values.set(r.id, items.filter((i) => i.done).length);
    } else {
      // habit / pomodoro: 0 until Day C
      values.set(r.id, 0);
    }
  }
  return { values, checklists };
}

// ---------- Public API ----------

/**
 * Fetch all goals for a (period, periodKey) including derived currentValue and
 * (for milestones) inline checklist items. Children of cascaded parents are
 * NOT grafted in here — that comes in Day D with the multi-period cascade view.
 */
export async function getGoalsForPeriod(
  period: GoalPeriod,
  periodKey: string,
): Promise<GoalWithDerived[]> {
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

  const { values, checklists } = await deriveCurrentValues(rows);

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
