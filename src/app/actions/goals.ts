"use server";

import { db } from "@/db/client";
import { goals, goalProgress, goalChecklist, habits, journalTasks, journalEntries } from "@/db/schema";
import { and, asc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import {
  addDays,
  enumerateWeeksThrough,
  isValidDateString,
  isoWeekKey,
  monthKeyOf,
  periodKeyFor,
  periodRangeFor,
  shiftPeriodKey,
  todayLocal,
  type GoalPeriod,
} from "@/lib/dates";
import { findGoalById, nextPositionFor } from "@/db/queries/goals";
import { ensureEntry, nextTaskPosition } from "@/db/queries/journal-tasks";
import {
  PRESET_COLORS,
  GOAL_PERIODS,
  GOAL_TYPES,
  autoSplitTargets,
  type GoalType,
  type PomoMetric,
} from "@/lib/goal-meta";

const MAX_TITLE_LEN = 120;
const MAX_EMOJI_LEN = 8;
const MAX_UNIT_LEN = 24;
const MAX_NOTE_LEN = 2_000;
const MAX_CHECKLIST_LEN = 200;
const MAX_RATING = 5;

function sanitizeTitle(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("title must be a string");
  const s = raw.trim();
  if (!s) throw new Error("title is required");
  if (s.length > MAX_TITLE_LEN) throw new Error(`title must be ≤ ${MAX_TITLE_LEN} chars`);
  return s;
}

function sanitizeEmoji(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("emoji must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_EMOJI_LEN) throw new Error(`emoji must be ≤ ${MAX_EMOJI_LEN} chars`);
  return s;
}

function sanitizeColor(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("color must be a string");
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) throw new Error("color must be #rrggbb");
  return raw.toLowerCase();
}

function sanitizeUnit(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("unit must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_UNIT_LEN) throw new Error(`unit must be ≤ ${MAX_UNIT_LEN} chars`);
  return s;
}

function sanitizeNote(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("note must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_NOTE_LEN) throw new Error(`note must be ≤ ${MAX_NOTE_LEN} chars`);
  return s;
}

function sanitizeChecklistText(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("text must be a string");
  const s = raw.trim();
  if (!s) throw new Error("checklist item text is required");
  if (s.length > MAX_CHECKLIST_LEN) throw new Error(`item must be ≤ ${MAX_CHECKLIST_LEN} chars`);
  return s;
}

function sanitizeTarget(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) throw new Error("target must be a number");
  if (n < 0) throw new Error("target must be ≥ 0");
  return n;
}

function assertPeriod(raw: unknown): GoalPeriod {
  if (typeof raw !== "string" || !(GOAL_PERIODS as readonly string[]).includes(raw)) {
    throw new Error(`period must be one of ${GOAL_PERIODS.join(", ")}`);
  }
  return raw as GoalPeriod;
}

function assertType(raw: unknown): GoalType {
  if (typeof raw !== "string" || !(GOAL_TYPES as readonly string[]).includes(raw)) {
    throw new Error(`type must be one of ${GOAL_TYPES.join(", ")}`);
  }
  return raw as GoalType;
}

function assertPeriodKey(raw: unknown, period: GoalPeriod): string {
  if (typeof raw !== "string" || !raw) throw new Error("periodKey is required");
  if (period === "year" && !/^\d{4}$/.test(raw)) throw new Error("year periodKey must be YYYY");
  if (period === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new Error("month periodKey must be YYYY-MM");
  }
  if (period === "week" && !/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(raw)) {
    throw new Error("week periodKey must be YYYY-Www");
  }
  return raw;
}

function revalidateGoals() {
  revalidatePath("/goals", "layout");
}

// ---------- Goals CRUD ----------

export async function createGoal(input: {
  id?: string;
  period: GoalPeriod;
  periodKey: string;
  title: string;
  type: GoalType;
  emoji?: string | null;
  color?: string;
  targetValue?: number | null;
  unit?: string | null;
  habitId?: string | null;
  pomoCategoryId?: string | null;
  pomoMetric?: PomoMetric | null;
  parentId?: string | null;
  autoSplitChildren?: boolean;
  /** Surfaces in the "Important" top section on /goals. Default false. */
  pinned?: boolean;
  /**
   * Reverse cascade (week → month → year). When set on a week-period goal,
   * the form's standard single-row insert is skipped and we delegate to
   * createReverseCascade() which inserts year + month parents + weekly
   * clones for every week in the horizon.
   */
  repeat?: {
    through: "endOfMonth" | "endOfYear";
    monthKey?: string; // required when through === "endOfMonth"
  };
}): Promise<{ id: string }> {
  const period = assertPeriod(input.period);
  const periodKey = assertPeriodKey(input.periodKey, period);
  const title = sanitizeTitle(input.title);
  const type = assertType(input.type);
  const emoji = sanitizeEmoji(input.emoji);
  const color = sanitizeColor(input.color ?? PRESET_COLORS[0]);
  const targetValue = sanitizeTarget(input.targetValue);
  const unit = sanitizeUnit(input.unit);

  if (type === "number" && (targetValue == null || targetValue <= 0)) {
    throw new Error("Number goals need a positive target");
  }
  if (type === "habit" && !input.habitId) {
    throw new Error("Habit-linked goals need a habitId");
  }
  if (type === "pomodoro" && !input.pomoMetric) {
    throw new Error("Pomodoro goals need a metric");
  }

  // ---------- Reverse cascade branch ----------
  if (input.repeat) {
    if (period !== "week") {
      throw new Error("`repeat` only valid on week-period goals");
    }
    if (type === "milestone") {
      throw new Error("Milestone goals can't repeat (no shared target across periods)");
    }
    if (targetValue == null || targetValue <= 0) {
      throw new Error("Repeating goals need a positive target");
    }
    let endRef: string;
    if (input.repeat.through === "endOfMonth") {
      if (!input.repeat.monthKey || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.repeat.monthKey)) {
        throw new Error("repeat.monthKey must be YYYY-MM for endOfMonth");
      }
      const todayMonth = periodKeyFor(todayLocal(), "month");
      if (input.repeat.monthKey < todayMonth) {
        throw new Error("repeat.monthKey must be the current month or later");
      }
      endRef = input.repeat.monthKey;
    } else {
      endRef = periodKey.slice(0, 4); // year of the current week key
    }
    const { id: yearGoalId } = await createReverseCascade({
      currentWeekKey: periodKey,
      endKind: input.repeat.through,
      endRef,
      title,
      emoji,
      color,
      type,
      weeklyTarget: targetValue,
      unit,
      habitId: input.habitId ?? null,
      pomoCategoryId: input.pomoCategoryId ?? null,
      pomoMetric: input.pomoMetric ?? null,
    });
    revalidateGoals();
    return { id: yearGoalId };
  }

  const id = input.id ?? nanoid(12);
  const position = await nextPositionFor(period, periodKey);
  await db.insert(goals).values({
    id,
    period,
    periodKey,
    parentId: input.parentId ?? null,
    title,
    emoji,
    color,
    type,
    targetValue,
    unit,
    habitId: input.habitId ?? null,
    pomoCategoryId: input.pomoCategoryId ?? null,
    pomoMetric: input.pomoMetric ?? null,
    status: "active",
    pinned: input.pinned === true,
    position,
  });

  if (
    input.autoSplitChildren &&
    (period === "year" || period === "month") &&
    type !== "milestone" &&
    targetValue != null &&
    targetValue > 0
  ) {
    await createCascadeChildren({
      parentId: id,
      parentPeriod: period,
      parentKey: periodKey,
      title,
      emoji,
      color,
      type,
      targetValue,
      unit,
      habitId: input.habitId ?? null,
      pomoCategoryId: input.pomoCategoryId ?? null,
      pomoMetric: input.pomoMetric ?? null,
    });
  }

  revalidateGoals();
  return { id };
}

/**
 * Yearly → 12 monthly children. Monthly → ~4 weekly children (ISO weeks
 * whose Thursday lies in the month). Skips past periods (only creates
 * current + future children when invoked mid-period).
 */
async function createCascadeChildren(opts: {
  parentId: string;
  parentPeriod: "year" | "month";
  parentKey: string;
  title: string;
  emoji: string | null;
  color: string;
  type: GoalType;
  targetValue: number;
  unit: string | null;
  habitId: string | null;
  pomoCategoryId: string | null;
  pomoMetric: PomoMetric | null;
}) {
  const today = todayLocal();
  const childPeriod: GoalPeriod = opts.parentPeriod === "year" ? "month" : "week";
  const childKeys = enumerateChildKeys(opts.parentPeriod, opts.parentKey);
  const isReal = opts.unit === "min" || opts.unit === "minutes";
  const splits = autoSplitTargets(opts.targetValue, childKeys.length, isReal);

  // Filter past — only create children for current or future periods.
  const future = childKeys
    .map((key, i) => ({ key, target: splits[i] }))
    .filter(({ key }) => {
      const { end } = periodRangeFor(key, childPeriod);
      return end >= today;
    });

  for (const { key, target } of future) {
    const position = await nextPositionFor(childPeriod, key);
    await db.insert(goals).values({
      id: nanoid(12),
      period: childPeriod,
      periodKey: key,
      parentId: opts.parentId,
      title: opts.title,
      emoji: opts.emoji,
      color: opts.color,
      type: opts.type,
      targetValue: target,
      unit: opts.unit,
      habitId: opts.habitId,
      pomoCategoryId: opts.pomoCategoryId,
      pomoMetric: opts.pomoMetric,
      status: "active",
      position,
    });
  }
}

/**
 * Reverse cascade: start at a weekly target and create
 *   - one yearly parent (only if endKind === "endOfYear")
 *   - N monthly parents (one per month spanned by the weeks)
 *   - one weekly clone per week in the horizon
 * Linked by parentId so the existing CascadeChildren rollup works as-is.
 *
 * Returns the topmost parent id (yearGoalId if any, else the first monthly
 * parent id) so the caller can revalidate / route off it.
 */
async function createReverseCascade(opts: {
  currentWeekKey: string;
  endKind: "endOfMonth" | "endOfYear";
  endRef: string;
  title: string;
  emoji: string | null;
  color: string;
  type: GoalType;
  weeklyTarget: number;
  unit: string | null;
  habitId: string | null;
  pomoCategoryId: string | null;
  pomoMetric: PomoMetric | null;
}): Promise<{ id: string; weekCount: number; monthCount: number; yearCount: number }> {
  const weekKeys = enumerateWeeksThrough(opts.currentWeekKey, opts.endKind, opts.endRef);
  if (weekKeys.length === 0) throw new Error("No weeks in horizon");

  // Group weeks by their Thursday's month (ISO convention — matches
  // createCascadeChildren's enumeration so the same week never lands in two
  // different month buckets).
  const monthsToWeeks = new Map<string, string[]>();
  for (const wk of weekKeys) {
    const wkRange = periodRangeFor(wk, "week");
    const thursday = addDays(wkRange.start, 4);
    const monthKey = thursday.slice(0, 7);
    let arr = monthsToWeeks.get(monthKey);
    if (!arr) {
      arr = [];
      monthsToWeeks.set(monthKey, arr);
    }
    arr.push(wk);
  }

  const shared = {
    title: opts.title,
    emoji: opts.emoji,
    color: opts.color,
    type: opts.type,
    unit: opts.unit,
    habitId: opts.habitId,
    pomoCategoryId: opts.pomoCategoryId,
    pomoMetric: opts.pomoMetric,
    status: "active" as const,
  };

  let yearGoalId: string | null = null;
  let yearCount = 0;
  if (opts.endKind === "endOfYear") {
    const yearKey = opts.endRef;
    const yearTarget = opts.weeklyTarget * weekKeys.length;
    yearGoalId = nanoid(12);
    const position = await nextPositionFor("year", yearKey);
    await db.insert(goals).values({
      ...shared,
      id: yearGoalId,
      period: "year",
      periodKey: yearKey,
      parentId: null,
      targetValue: yearTarget,
      position,
    });
    yearCount = 1;
  }

  // Monthly parents — one per month, target = sum of weeks in that month
  const monthlyParentIdByMonth = new Map<string, string>();
  for (const [monthKey, weeksInMonth] of monthsToWeeks) {
    const monthGoalId = nanoid(12);
    const monthTarget = opts.weeklyTarget * weeksInMonth.length;
    const position = await nextPositionFor("month", monthKey);
    await db.insert(goals).values({
      ...shared,
      id: monthGoalId,
      period: "month",
      periodKey: monthKey,
      parentId: yearGoalId,
      targetValue: monthTarget,
      position,
    });
    monthlyParentIdByMonth.set(monthKey, monthGoalId);
  }

  // Weekly clones — link to their month
  for (const wk of weekKeys) {
    const wkRange = periodRangeFor(wk, "week");
    const monthKey = addDays(wkRange.start, 4).slice(0, 7);
    const parentId = monthlyParentIdByMonth.get(monthKey)!;
    const position = await nextPositionFor("week", wk);
    await db.insert(goals).values({
      ...shared,
      id: nanoid(12),
      period: "week",
      periodKey: wk,
      parentId,
      targetValue: opts.weeklyTarget,
      position,
    });
  }

  return {
    id: yearGoalId ?? Array.from(monthlyParentIdByMonth.values())[0],
    weekCount: weekKeys.length,
    monthCount: monthsToWeeks.size,
    yearCount,
  };
}

function enumerateChildKeys(
  parentPeriod: "year" | "month",
  parentKey: string,
): string[] {
  if (parentPeriod === "year") {
    return Array.from({ length: 12 }, (_, i) => `${parentKey}-${String(i + 1).padStart(2, "0")}`);
  }
  // month → ISO weeks whose Thursday lies in this month
  const { start, end } = periodRangeFor(parentKey, "month");
  const seen = new Set<string>();
  // Iterate every day in the month; pick unique ISO weeks whose Thursday
  // falls within the month.
  let d = start;
  while (d <= end) {
    const wk = isoWeekKey(d);
    const wkRange = periodRangeFor(wk, "week");
    // Thursday of this ISO week:
    const thu = addDays(wkRange.start, 4); // Sun-start, +4 = Thursday
    if (thu >= start && thu <= end) seen.add(wk);
    d = addDays(d, 1);
  }
  return Array.from(seen).sort();
}

export async function updateGoal(input: {
  id: string;
  title?: string;
  emoji?: string | null;
  color?: string;
  targetValue?: number | null;
  unit?: string | null;
  pinned?: boolean;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = sanitizeTitle(input.title);
  if (input.emoji !== undefined) patch.emoji = sanitizeEmoji(input.emoji);
  if (input.color !== undefined) patch.color = sanitizeColor(input.color);
  if (input.targetValue !== undefined) patch.targetValue = sanitizeTarget(input.targetValue);
  if (input.unit !== undefined) patch.unit = sanitizeUnit(input.unit);
  if (input.pinned !== undefined) patch.pinned = input.pinned === true;
  if (Object.keys(patch).length === 0) return;
  await db.update(goals).set(patch).where(eq(goals.id, input.id));
  revalidateGoals();
}

// ---------- Cross-level cascade edit + delete ----------

type GoalRow = typeof goals.$inferSelect;
type TreeNode = GoalRow & { children: TreeNode[] };

async function findRoot(id: string): Promise<GoalRow | null> {
  let current = await findGoalById(id);
  if (!current) return null;
  while (current.parentId) {
    const next = await findGoalById(current.parentId);
    if (!next) break;
    current = next;
  }
  return current;
}

async function loadTree(rootId: string): Promise<TreeNode | null> {
  const root = await findGoalById(rootId);
  if (!root) return null;
  const node: TreeNode = { ...root, children: [] };
  const queue: TreeNode[] = [node];
  while (queue.length > 0) {
    const ids = queue.map((n) => n.id);
    queue.length = 0;
    const kids =
      ids.length === 0
        ? []
        : await db.select().from(goals).where(inArray(goals.parentId, ids));
    if (kids.length === 0) break;
    const byParent = new Map<string, TreeNode[]>();
    for (const k of kids) {
      const t: TreeNode = { ...k, children: [] };
      const arr = byParent.get(k.parentId ?? "") ?? [];
      arr.push(t);
      byParent.set(k.parentId ?? "", arr);
      queue.push(t);
    }
    function attach(n: TreeNode) {
      const c = byParent.get(n.id);
      if (c) n.children = c;
      n.children.forEach(attach);
    }
    attach(node);
  }
  return node;
}

function isFutureOrCurrent(g: { period: string; periodKey: string }, today: string): boolean {
  return periodRangeFor(g.periodKey, g.period as GoalPeriod).end >= today;
}

function flattenTree(n: TreeNode): TreeNode[] {
  const out: TreeNode[] = [n];
  for (const c of n.children) out.push(...flattenTree(c));
  return out;
}

/**
 * Edit a goal and propagate changes through the cascade tree to every
 * current/future instance. Past instances are frozen.
 *
 * Non-target fields (title/emoji/color/unit/habitId/pomoCategoryId/pomoMetric/pinned)
 * copy to every current/future node in the tree.
 *
 * Target changes pivot around the source goal's level:
 *  - Set every current/future node at the source's level to the new target.
 *  - Walk UP: ancestor target = sum of children targets (past untouched).
 *  - Walk DOWN: split parent target across current/future children via
 *    autoSplitTargets, subtracting past children's targets first.
 *
 * `type` is not editable post-creation (data model would diverge).
 */
export async function updateGoalCascade(input: {
  id: string;
  title?: string;
  emoji?: string | null;
  color?: string;
  targetValue?: number | null;
  unit?: string | null;
  habitId?: string | null;
  pomoCategoryId?: string | null;
  pomoMetric?: PomoMetric | null;
  pinned?: boolean;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const source = await findGoalById(input.id);
  if (!source) throw new Error("Goal not found");

  const root = await findRoot(source.id);
  if (!root) throw new Error("Goal root not found");
  const tree = await loadTree(root.id);
  if (!tree) throw new Error("Goal tree not found");

  const today = todayLocal();
  const all = flattenTree(tree);

  // Sanitize non-target patch fields.
  const patchBase: Record<string, unknown> = {};
  if (input.title !== undefined) patchBase.title = sanitizeTitle(input.title);
  if (input.emoji !== undefined) patchBase.emoji = sanitizeEmoji(input.emoji);
  if (input.color !== undefined) patchBase.color = sanitizeColor(input.color);
  if (input.unit !== undefined) patchBase.unit = sanitizeUnit(input.unit);
  if (input.habitId !== undefined) patchBase.habitId = input.habitId;
  if (input.pomoCategoryId !== undefined) patchBase.pomoCategoryId = input.pomoCategoryId;
  if (input.pomoMetric !== undefined) patchBase.pomoMetric = input.pomoMetric ?? null;
  if (input.pinned !== undefined) patchBase.pinned = input.pinned === true;

  const newTargetProvided = input.targetValue !== undefined;
  const newTarget = newTargetProvided ? sanitizeTarget(input.targetValue) : null;
  const sourceLevel = source.period as GoalPeriod;
  const isReal = (source.unit === "min" || source.unit === "minutes");

  if (newTargetProvided) {
    // Step 1: set source-level current/future nodes to newTarget.
    for (const n of all) {
      if (n.period === sourceLevel && isFutureOrCurrent(n, today)) {
        n.targetValue = newTarget;
      }
    }

    // Step 2: recompute. Ancestors (above sourceLevel) post-order sum children;
    // descendants (below sourceLevel) top-down split parent target.
    const recompute = (n: TreeNode): void => {
      if (n.period === sourceLevel) {
        redistribute(n);
        return;
      }
      for (const c of n.children) recompute(c);
      if (isFutureOrCurrent(n, today)) {
        const sum = n.children.reduce((acc, c) => acc + (c.targetValue ?? 0), 0);
        n.targetValue = sum;
      }
    };
    const redistribute = (n: TreeNode): void => {
      if (n.children.length === 0) return;
      if (!isFutureOrCurrent(n, today)) return;
      const past = n.children.filter((c) => !isFutureOrCurrent(c, today));
      const future = n.children.filter((c) => isFutureOrCurrent(c, today));
      const pastSum = past.reduce((acc, c) => acc + (c.targetValue ?? 0), 0);
      const remainder = Math.max(0, (n.targetValue ?? 0) - pastSum);
      if (future.length > 0) {
        const split = autoSplitTargets(remainder, future.length, isReal);
        future.forEach((c, i) => {
          c.targetValue = split[i] ?? 0;
        });
      }
      for (const c of future) redistribute(c);
    };
    recompute(tree);
  }

  // Persist: every current/future node gets patchBase. If target changed, also
  // write recomputed targetValue (covers past ancestors whose target we DIDN'T
  // change too — those still have their original value, so writing them is a
  // no-op).
  await db.transaction(async (tx) => {
    for (const n of all) {
      const future = isFutureOrCurrent(n, today);
      const updates: Record<string, unknown> = {};
      if (future) Object.assign(updates, patchBase);
      if (newTargetProvided) updates.targetValue = n.targetValue;
      if (Object.keys(updates).length === 0) continue;
      await tx.update(goals).set(updates).where(eq(goals.id, n.id));
    }
  });

  revalidateGoals();
  revalidatePath("/habits", "layout");
  revalidatePath("/journal", "layout");
}

/**
 * Delete the cascade tree across the source's hierarchy. Only current + future
 * instances are removed; past instances stay so achievement history is intact.
 * Drizzle FK cascade handles goal_progress + goal_checklist.
 */
export async function deleteGoalCascade(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  const source = await findGoalById(id);
  if (!source) throw new Error("Goal not found");
  const root = await findRoot(source.id);
  if (!root) throw new Error("Goal root not found");
  const tree = await loadTree(root.id);
  if (!tree) return;
  const today = todayLocal();
  const toDelete = flattenTree(tree)
    .filter((n) => isFutureOrCurrent(n, today))
    .map((n) => n.id);
  if (toDelete.length === 0) return;
  await db.delete(goals).where(inArray(goals.id, toDelete));
  revalidateGoals();
  revalidatePath("/habits", "layout");
  revalidatePath("/journal", "layout");
}

export async function setGoalPinned(input: { id: string; pinned: boolean }): Promise<void> {
  if (!input.id) throw new Error("id is required");
  await db.update(goals).set({ pinned: input.pinned === true }).where(eq(goals.id, input.id));
  revalidateGoals();
}

export async function deleteGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(goals).where(eq(goals.id, id));
  revalidateGoals();
}

export async function archiveGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  const goal = await findGoalById(id);
  if (!goal) throw new Error("Goal not found");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(goals)
      .set({ archivedAt: now, status: "archived" })
      .where(eq(goals.id, id));
    // Bi-directional: if habit-linked, archive the habit too (which will in
    // turn cascade to any sibling goals via archiveHabit's own logic — but
    // we're inside a transaction, so do the habit update directly here).
    if (goal.habitId) {
      await tx
        .update(habits)
        .set({ archivedAt: now })
        .where(and(eq(habits.id, goal.habitId), isNull(habits.archivedAt)));
      // Archive every other active goal linked to the same habit.
      await tx
        .update(goals)
        .set({ archivedAt: now, status: "archived" })
        .where(and(eq(goals.habitId, goal.habitId), isNull(goals.archivedAt)));
    }
  });
  revalidateGoals();
  revalidatePath("/habits", "layout");
}

export async function unarchiveGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  const goal = await findGoalById(id);
  if (!goal) throw new Error("Goal not found");
  await db.transaction(async (tx) => {
    await tx
      .update(goals)
      .set({ archivedAt: null, status: "active" })
      .where(eq(goals.id, id));
    if (goal.habitId) {
      await tx
        .update(habits)
        .set({ archivedAt: null })
        .where(and(eq(habits.id, goal.habitId), isNotNull(habits.archivedAt)));
      // Restore every other archived goal linked to the same habit.
      await tx
        .update(goals)
        .set({ archivedAt: null, status: "active" })
        .where(and(eq(goals.habitId, goal.habitId), isNotNull(goals.archivedAt)));
    }
  });
  revalidateGoals();
  revalidatePath("/habits", "layout");
}

// ---------- Number goal progress ----------

export async function logProgress(input: {
  id?: string;
  goalId: string;
  delta: number;
  note?: string | null;
  date?: string;
}): Promise<{ id: string }> {
  if (!input.goalId) throw new Error("goalId is required");
  const goal = await findGoalById(input.goalId);
  if (!goal) throw new Error("Goal not found");
  if (goal.type !== "number") throw new Error("Progress logging is only valid for number goals");
  const delta = typeof input.delta === "number" ? input.delta : Number(input.delta);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("delta must be a non-zero number");
  const date = input.date ?? todayLocal();
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  const id = input.id ?? nanoid(12);
  await db.insert(goalProgress).values({
    id,
    goalId: input.goalId,
    date,
    delta,
    note: sanitizeNote(input.note),
  });
  revalidateGoals();
  return { id };
}

export async function deleteProgress(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(goalProgress).where(eq(goalProgress.id, id));
  revalidateGoals();
}

// ---------- Milestone checklist ----------

export async function addChecklistItem(input: {
  id?: string;
  goalId: string;
  text: string;
}): Promise<{ id: string }> {
  if (!input.goalId) throw new Error("goalId is required");
  const goal = await findGoalById(input.goalId);
  if (!goal) throw new Error("Goal not found");
  if (goal.type !== "milestone") throw new Error("Checklist items only valid on milestone goals");
  const text = sanitizeChecklistText(input.text);
  const existing = await db
    .select({ position: goalChecklist.position })
    .from(goalChecklist)
    .where(eq(goalChecklist.goalId, input.goalId));
  const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;
  const id = input.id ?? nanoid(12);
  await db.insert(goalChecklist).values({ id, goalId: input.goalId, text, position });
  revalidateGoals();
  return { id };
}

export async function updateChecklistItem(input: {
  id: string;
  text?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  if (input.text === undefined) return;
  const text = sanitizeChecklistText(input.text);
  await db.update(goalChecklist).set({ text }).where(eq(goalChecklist.id, input.id));
  revalidateGoals();
}

export async function toggleChecklistItem(itemId: string): Promise<{ done: boolean }> {
  if (!itemId) throw new Error("itemId is required");
  const rows = await db
    .select({ done: goalChecklist.done })
    .from(goalChecklist)
    .where(eq(goalChecklist.id, itemId))
    .limit(1);
  if (rows.length === 0) throw new Error("Checklist item not found");
  const next = !rows[0].done;
  await db.update(goalChecklist).set({ done: next }).where(eq(goalChecklist.id, itemId));
  revalidateGoals();
  return { done: next };
}

export async function deleteChecklistItem(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(goalChecklist).where(eq(goalChecklist.id, id));
  revalidateGoals();
}

// ---------- Finalize + reflection (stub for Day C, public for completeness) ----------

/**
 * Sets each active goal in (period, periodKey) to achieved/missed based on
 * derived progress. Idempotent — only touches rows with finalizedAt=null.
 * Day B keeps the signature for the action; the auto-trigger from
 * getGoalsForPeriod ships in Day C.
 */
export async function finalizePeriod(input: {
  period: GoalPeriod;
  periodKey: string;
}): Promise<{ finalized: number }> {
  const period = assertPeriod(input.period);
  const periodKey = assertPeriodKey(input.periodKey, period);

  // Fetch active, non-archived goals in the period.
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.period, period), eq(goals.periodKey, periodKey), eq(goals.status, "active")));

  let finalized = 0;
  for (const g of rows) {
    let achieved = false;
    if (g.type === "number") {
      const progressRows = await db
        .select({ delta: goalProgress.delta })
        .from(goalProgress)
        .where(eq(goalProgress.goalId, g.id));
      const current = progressRows.reduce((acc, r) => acc + (r.delta ?? 0), 0);
      achieved = g.targetValue != null && current >= g.targetValue;
    } else if (g.type === "milestone") {
      const items = await db
        .select({ done: goalChecklist.done })
        .from(goalChecklist)
        .where(eq(goalChecklist.goalId, g.id))
        .orderBy(asc(goalChecklist.position));
      const done = items.filter((i) => i.done).length;
      // Single-step milestone (no checklist) → consider achieved only if
      // explicitly marked via toggleMilestone (handled in Day C).
      achieved = items.length > 0 && done === items.length;
    } else {
      // habit / pomodoro derivations land in Day C
      continue;
    }
    await db
      .update(goals)
      .set({ status: achieved ? "achieved" : "missed", finalizedAt: new Date() })
      .where(eq(goals.id, g.id));
    finalized++;
  }

  if (finalized > 0) revalidateGoals();
  return { finalized };
}

export async function saveReflection(input: {
  goalId: string;
  note: string;
  rating: number;
  linkedDate?: string | null;
}): Promise<void> {
  if (!input.goalId) throw new Error("goalId is required");
  const note = sanitizeNote(input.note);
  if (!note) throw new Error("note is required");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > MAX_RATING) {
    throw new Error(`rating must be 1..${MAX_RATING}`);
  }
  if (input.linkedDate && !isValidDateString(input.linkedDate)) {
    throw new Error(`Invalid linkedDate: ${input.linkedDate}`);
  }
  const goal = await findGoalById(input.goalId);
  if (!goal) throw new Error("Goal not found");

  await db
    .update(goals)
    .set({
      reflectionNote: note,
      reflectionRating: rating,
      reflectionLinkedDate: input.linkedDate ?? null,
      reflectionSavedAt: new Date(),
    })
    .where(eq(goals.id, input.goalId));

  // Optional: drop a `secondary` task into the journal entry for `linkedDate`.
  if (input.linkedDate) {
    await ensureEntry(input.linkedDate);
    const position = await nextTaskPosition(input.linkedDate, "secondary");
    const excerpt = note.length > 80 ? note.slice(0, 77) + "…" : note;
    await db.insert(journalTasks).values({
      id: nanoid(12),
      date: input.linkedDate,
      kind: "secondary",
      text: `Reflect: ${goal.title} — ${excerpt}`,
      done: true,
      position,
    });
    revalidatePath(`/journal/${input.linkedDate}`);
  }

  revalidateGoals();
}
