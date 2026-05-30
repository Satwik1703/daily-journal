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
import { and, asc, between, eq, inArray, isNotNull, isNull, sum, count, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  addDays,
  periodKeyFor,
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
  currentValue: number;
  checklist?: GoalChecklistItem[];
  children?: GoalWithDerived[];
};

async function listChecklistsForGoals(
  userId: string,
  goalIds: string[],
): Promise<Map<string, GoalChecklistItem[]>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(goalChecklist)
    .where(
      and(
        eq(goalChecklist.userId, userId),
        inArray(goalChecklist.goalId, goalIds),
      ),
    )
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

async function sumProgressForGoals(
  userId: string,
  goalIds: string[],
): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db
    .select({
      goalId: goalProgress.goalId,
      total: sum(goalProgress.delta).mapWith(Number),
    })
    .from(goalProgress)
    .where(
      and(
        eq(goalProgress.userId, userId),
        inArray(goalProgress.goalId, goalIds),
      ),
    )
    .groupBy(goalProgress.goalId);
  return new Map(rows.map((r) => [r.goalId, r.total ?? 0]));
}

async function habitCountInRange(
  userId: string,
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
    .where(and(eq(habits.userId, userId), eq(habits.id, habitId)))
    .limit(1);
  const h = habitRow[0];
  if (!h) return 0;

  if (h.trackingKind === "binary") {
    const rows = await db
      .select({ n: count(habitLogs.date) })
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, userId),
          eq(habitLogs.habitId, habitId),
          between(habitLogs.date, start, end),
        ),
      );
    return rows[0]?.n ?? 0;
  }

  if (h.trackingKind === "number") {
    const rows = await db
      .select({ date: habitValueLogs.date, value: habitValueLogs.value })
      .from(habitValueLogs)
      .where(
        and(
          eq(habitValueLogs.userId, userId),
          eq(habitValueLogs.habitId, habitId),
          between(habitValueLogs.date, start, end),
        ),
      );
    const perDay = new Map<string, number>();
    for (const r of rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.value);
    const target = h.dailyTarget && h.dailyTarget > 0 ? h.dailyTarget : null;
    let qualifying = 0;
    for (const v of perDay.values()) {
      if (target == null ? v > 0 : v >= target) qualifying++;
    }
    return qualifying;
  }

  if (!h.pomoCategoryId) return 0;
  const rows = await db
    .select({ date: pomodoroSessions.date })
    .from(pomodoroSessions)
    .where(
      and(
        eq(pomodoroSessions.userId, userId),
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
  userId: string,
  pomoCategoryId: string | null,
  metric: "minutes" | "pomos" | "sessions",
  start: DateString,
  end: DateString,
): Promise<number> {
  const filters = [
    eq(pomodoroSessions.userId, userId),
    between(pomodoroSessions.date, start, end),
  ];
  if (pomoCategoryId) filters.push(eq(pomodoroSessions.categoryId, pomoCategoryId));
  const rows = await db
    .select({ duration: pomodoroSessions.durationMin })
    .from(pomodoroSessions)
    .where(and(...filters));
  if (metric === "sessions") return rows.length;
  if (metric === "minutes") return rows.reduce((acc, r) => acc + (r.duration ?? 0), 0);
  return rows.reduce((acc, r) => acc + pomoUnits(r.duration ?? 0), 0);
}

async function deriveCurrentValues(
  userId: string,
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
    sumProgressForGoals(userId, numberIds),
    listChecklistsForGoals(userId, milestoneIds),
    Promise.all(
      habitGoals.map(async (g) => {
        const { start, end } = rangeFor(g);
        const n = await habitCountInRange(userId, g.habitId!, start, end);
        return [g.id, n] as const;
      }),
    ),
    Promise.all(
      pomoGoals.map(async (g) => {
        const { start, end } = rangeFor(g);
        const n = await pomodoroValueInRange(
          userId,
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

export async function getGoalsForPeriod(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
): Promise<GoalWithDerived[]> {
  const range = periodRangeFor(periodKey, period);

  if (period === "week") {
    await autoExtendReverseCascadeTrees(userId, periodKey);
  }

  const rows = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.period, period),
        eq(goals.periodKey, periodKey),
        isNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.position), asc(goals.createdAt));

  if (rows.length === 0) return [];

  const rangeFor = () => range;

  const { values, checklists } = await deriveCurrentValues(userId, rows, rangeFor);

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
            .where(and(eq(goals.userId, userId), eq(goals.id, g.id)));
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

export async function getGoalsHistory(
  userId: string,
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
    const goalsForKey = await getGoalsForPeriod(userId, period, key);
    results.push({ periodKey: key, goals: goalsForKey });
  }
  return results;
}

export async function getGoalsYearHeatmap(
  userId: string,
  year: number,
): Promise<{ byWeek: Record<string, "crazy" | "great" | "good" | "avg" | "bad" | "empty"> }> {
  const allRows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)));
  const yearStr = String(year);
  const inYear = allRows.filter((r) => r.periodKey.startsWith(yearStr));
  if (inYear.length === 0) return { byWeek: {} };

  const { values, checklists } = await deriveCurrentValues(userId, inYear, (g) =>
    periodRangeFor(g.periodKey, g.period as GoalPeriod),
  );

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

export async function getChildrenOfGoal(
  userId: string,
  parentId: string,
): Promise<GoalWithDerived[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.parentId, parentId),
        isNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.periodKey));
  if (rows.length === 0) return [];
  const { values, checklists } = await deriveCurrentValues(userId, rows, (g) =>
    periodRangeFor(g.periodKey, g.period as GoalPeriod),
  );
  return rows.map((r) => ({
    ...r,
    currentValue: values.get(r.id) ?? 0,
    checklist: r.type === "milestone" ? checklists.get(r.id) ?? [] : undefined,
  }));
}

export async function getArchivedGoalsForPeriod(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
): Promise<GoalRow[]> {
  return db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.period, period),
        eq(goals.periodKey, periodKey),
        isNotNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.position), asc(goals.createdAt));
}

export async function findGoalById(
  userId: string,
  id: string,
): Promise<GoalRow | null> {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function nextPositionFor(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
): Promise<number> {
  const rows = await db
    .select({ position: goals.position })
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.period, period),
        eq(goals.periodKey, periodKey),
      ),
    );
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.position)) + 1;
}

export function rangeForPeriod(
  periodKey: string,
  period: GoalPeriod,
): { start: DateString; end: DateString } {
  return periodRangeFor(periodKey, period);
}

export function getToday(): DateString {
  return todayLocal();
}

async function autoExtendReverseCascadeTrees(
  userId: string,
  currentWeekKey: string,
): Promise<void> {
  const nextWeekKey = shiftPeriodKey(currentWeekKey, "week", 1);
  const yearOfNext = nextWeekKey.slice(0, 4);

  const yearlies = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.period, "year"),
        eq(goals.periodKey, yearOfNext),
        isNull(goals.archivedAt),
      ),
    );
  if (yearlies.length === 0) return;

  for (const yearly of yearlies) {
    if (yearly.type === "milestone") continue;
    const matchClauses = yearly.habitId
      ? eq(goals.habitId, yearly.habitId)
      : eq(goals.title, yearly.title);
    const latestWeekly = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          matchClauses,
          eq(goals.period, "week"),
          isNull(goals.archivedAt),
        ),
      )
      .orderBy(desc(goals.periodKey))
      .limit(1);
    if (latestWeekly.length === 0) continue;

    const lastKey = latestWeekly[0].periodKey;
    if (lastKey >= nextWeekKey) continue;
    const targetWeekKey = nextWeekKey;
    if (!targetWeekKey.startsWith(yearOfNext)) continue;

    const wkRange = periodRangeFor(targetWeekKey, "week");
    const thursday = addDays(wkRange.start, 4);
    const monthKey = thursday.slice(0, 7);

    let monthly = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          matchClauses,
          eq(goals.period, "month"),
          eq(goals.periodKey, monthKey),
          isNull(goals.archivedAt),
        ),
      )
      .limit(1);

    let monthlyParentId: string;
    if (monthly.length > 0) {
      monthlyParentId = monthly[0].id;
    } else {
      const weeklyTarget = latestWeekly[0].targetValue ?? yearly.targetValue ?? 0;
      monthlyParentId = nanoid(12);
      const position = await nextPositionFor(userId, "month", monthKey);
      await db.insert(goals).values({
        id: monthlyParentId,
        userId,
        period: "month",
        periodKey: monthKey,
        parentId: yearly.id,
        title: yearly.title,
        emoji: yearly.emoji,
        color: yearly.color,
        type: yearly.type,
        targetValue: weeklyTarget,
        unit: yearly.unit,
        habitId: yearly.habitId,
        pomoCategoryId: yearly.pomoCategoryId,
        pomoMetric: yearly.pomoMetric,
        status: "active",
        position,
      });
      monthly = await db
        .select()
        .from(goals)
        .where(eq(goals.id, monthlyParentId))
        .limit(1);
    }

    const weeklyTarget = latestWeekly[0].targetValue ?? yearly.targetValue ?? 0;
    const position = await nextPositionFor(userId, "week", targetWeekKey);
    await db.insert(goals).values({
      id: nanoid(12),
      userId,
      period: "week",
      periodKey: targetWeekKey,
      parentId: monthlyParentId,
      title: yearly.title,
      emoji: yearly.emoji,
      color: yearly.color,
      type: yearly.type,
      targetValue: weeklyTarget,
      unit: yearly.unit,
      habitId: yearly.habitId,
      pomoCategoryId: yearly.pomoCategoryId,
      pomoMetric: yearly.pomoMetric,
      status: "active",
      position,
    });
  }
}

void periodKeyFor;
