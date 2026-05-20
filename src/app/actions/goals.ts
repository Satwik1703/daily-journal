"use server";

import { db } from "@/db/client";
import { goals, goalProgress, goalChecklist } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString, todayLocal, type GoalPeriod } from "@/lib/dates";
import { findGoalById, nextPositionFor } from "@/db/queries/goals";
import { PRESET_COLORS, GOAL_PERIODS, GOAL_TYPES, type GoalType, type PomoMetric } from "@/lib/goal-meta";

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

  const id = nanoid(12);
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
    position,
  });
  revalidateGoals();
  return { id };
}

export async function updateGoal(input: {
  id: string;
  title?: string;
  emoji?: string | null;
  color?: string;
  targetValue?: number | null;
  unit?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = sanitizeTitle(input.title);
  if (input.emoji !== undefined) patch.emoji = sanitizeEmoji(input.emoji);
  if (input.color !== undefined) patch.color = sanitizeColor(input.color);
  if (input.targetValue !== undefined) patch.targetValue = sanitizeTarget(input.targetValue);
  if (input.unit !== undefined) patch.unit = sanitizeUnit(input.unit);
  if (Object.keys(patch).length === 0) return;
  await db.update(goals).set(patch).where(eq(goals.id, input.id));
  revalidateGoals();
}

export async function deleteGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(goals).where(eq(goals.id, id));
  revalidateGoals();
}

export async function archiveGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.update(goals).set({ archivedAt: new Date(), status: "archived" }).where(eq(goals.id, id));
  revalidateGoals();
}

export async function unarchiveGoal(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.update(goals).set({ archivedAt: null, status: "active" }).where(eq(goals.id, id));
  revalidateGoals();
}

// ---------- Number goal progress ----------

export async function logProgress(input: {
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
  const id = nanoid(12);
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
  const id = nanoid(12);
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
  await db
    .update(goals)
    .set({
      reflectionNote: note,
      reflectionRating: rating,
      reflectionLinkedDate: input.linkedDate ?? null,
      reflectionSavedAt: new Date(),
    })
    .where(eq(goals.id, input.goalId));
  revalidateGoals();
}
