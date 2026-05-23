"use server";

import { db } from "@/db/client";
import { habits, habitLogs, habitValueLogs, pomodoroCategories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { findHabitById, isActiveHabit, nextPosition } from "@/db/queries/habits";
import {
  HABIT_TRACKING_KINDS,
  PRESET_COLORS,
  type HabitTrackingKind,
} from "@/lib/habit-meta";

const MAX_NAME_LEN = 80;
const MAX_EMOJI_LEN = 8;
const MAX_UNIT_LEN = 24;
const MAX_NOTE_LEN = 2_000;

function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("name must be a string");
  const s = raw.trim();
  if (!s) throw new Error("name is required");
  if (s.length > MAX_NAME_LEN) throw new Error(`name must be ≤ ${MAX_NAME_LEN} chars`);
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

function assertTrackingKind(raw: unknown): HabitTrackingKind {
  if (typeof raw !== "string" || !(HABIT_TRACKING_KINDS as readonly string[]).includes(raw)) {
    throw new Error(`trackingKind must be one of: ${HABIT_TRACKING_KINDS.join(", ")}`);
  }
  return raw as HabitTrackingKind;
}

function sanitizeDailyTarget(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) throw new Error("dailyTarget must be a number");
  if (n < 0) throw new Error("dailyTarget must be ≥ 0");
  return n;
}

async function assertCategoryExists(id: string): Promise<void> {
  const rows = await db
    .select({ id: pomodoroCategories.id })
    .from(pomodoroCategories)
    .where(eq(pomodoroCategories.id, id))
    .limit(1);
  if (rows.length === 0) throw new Error("Pomodoro category not found");
}

export async function createHabit(input: {
  name: string;
  emoji?: string | null;
  color?: string;
  trackingKind?: HabitTrackingKind;
  dailyTarget?: number | null;
  unit?: string | null;
  pomoCategoryId?: string | null;
}): Promise<{ id: string }> {
  const name = sanitizeName(input.name);
  const emoji = sanitizeEmoji(input.emoji);
  const color = sanitizeColor(input.color ?? PRESET_COLORS[0]);
  const trackingKind = assertTrackingKind(input.trackingKind ?? "binary");
  const dailyTarget = sanitizeDailyTarget(input.dailyTarget);
  const unit = sanitizeUnit(input.unit);
  const pomoCategoryId = input.pomoCategoryId ?? null;

  if (trackingKind === "number" && (dailyTarget == null || dailyTarget <= 0)) {
    throw new Error("Number habits need a positive daily target");
  }
  if (trackingKind === "pomodoro") {
    if (!pomoCategoryId) throw new Error("Pomodoro habits need a category");
    await assertCategoryExists(pomoCategoryId);
    if (dailyTarget == null || dailyTarget <= 0) {
      throw new Error("Pomodoro habits need a positive daily target (sessions)");
    }
  }
  if (trackingKind !== "number" && unit != null) {
    // unit only meaningful for number kind — silently null-out instead of erroring
  }

  const id = nanoid(12);
  const position = await nextPosition();
  await db.insert(habits).values({
    id,
    name,
    emoji,
    color,
    trackingKind,
    dailyTarget,
    unit: trackingKind === "number" ? unit : null,
    pomoCategoryId: trackingKind === "pomodoro" ? pomoCategoryId : null,
    position,
  });
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
  return { id };
}



export async function updateHabit(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
  trackingKind?: HabitTrackingKind;
  dailyTarget?: number | null;
  unit?: string | null;
  pomoCategoryId?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = sanitizeName(input.name);
  if (input.emoji !== undefined) patch.emoji = sanitizeEmoji(input.emoji);
  if (input.color !== undefined) patch.color = sanitizeColor(input.color);
  if (input.trackingKind !== undefined) {
    patch.trackingKind = assertTrackingKind(input.trackingKind);
  }
  if (input.dailyTarget !== undefined) {
    patch.dailyTarget = sanitizeDailyTarget(input.dailyTarget);
  }
  if (input.unit !== undefined) patch.unit = sanitizeUnit(input.unit);
  if (input.pomoCategoryId !== undefined) {
    if (input.pomoCategoryId) await assertCategoryExists(input.pomoCategoryId);
    patch.pomoCategoryId = input.pomoCategoryId;
  }
  if (Object.keys(patch).length === 0) return;
  await db.update(habits).set(patch).where(eq(habits.id, input.id));
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
}

/**
 * Persist a new ordering for habits. Array index becomes the `position` value.
 * Validates each id is a non-empty unique string; orphaned ids no-op.
 */
export async function reorderHabits(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds)) throw new Error("orderedIds must be an array");
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (typeof id !== "string" || !id) throw new Error("invalid id in orderedIds");
    if (seen.has(id)) throw new Error("duplicate id in orderedIds");
    seen.add(id);
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(habits).set({ position: i }).where(eq(habits.id, orderedIds[i]));
    }
  });
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
}

export async function archiveHabit(id: string): Promise<void> {
  await db.update(habits).set({ archivedAt: new Date() }).where(eq(habits.id, id));
  revalidatePath("/habits");
}

export async function unarchiveHabit(id: string): Promise<void> {
  await db.update(habits).set({ archivedAt: null }).where(eq(habits.id, id));
  revalidatePath("/habits");
}

/**
 * Toggle a binary habit log for a date. Returns the new state (true if logged).
 * Errors if the habit is non-binary — use logHabitValue for number kind, and
 * for pomodoro kind the user runs the timer on /pomodoro instead.
 */
export async function toggleHabitForDate(
  habitId: string,
  date: string,
): Promise<{ done: boolean }> {
  if (!habitId) throw new Error("habitId is required");
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  if (!(await isActiveHabit(habitId))) throw new Error("Habit not found or archived");
  const habit = await findHabitById(habitId);
  if (!habit) throw new Error("Habit not found");
  if (habit.trackingKind !== "binary") {
    throw new Error(`Habit '${habit.name}' is ${habit.trackingKind}-tracked — not togglable`);
  }

  const existing = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
    revalidatePath("/habits", "layout");
    revalidatePath("/goals", "layout");
    return { done: false };
  }
  await db.insert(habitLogs).values({ habitId, date });
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
  return { done: true };
}

/**
 * Append a value-log row for a number-kind habit. Multiple rows per day are
 * allowed and summed on read; pass a negative delta to undo.
 */
export async function logHabitValue(input: {
  habitId: string;
  value: number;
  date?: string;
  note?: string | null;
}): Promise<{ id: string }> {
  if (!input.habitId) throw new Error("habitId is required");
  const habit = await findHabitById(input.habitId);
  if (!habit) throw new Error("Habit not found");
  if (habit.trackingKind !== "number") {
    throw new Error(`Habit '${habit.name}' isn't a number-tracking habit`);
  }
  const value = typeof input.value === "number" ? input.value : Number(input.value);
  if (!Number.isFinite(value) || value === 0) {
    throw new Error("value must be a non-zero number");
  }
  const date = input.date ?? todayLocal();
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  const id = nanoid(12);
  await db.insert(habitValueLogs).values({
    id,
    habitId: input.habitId,
    date,
    value,
    note: sanitizeNote(input.note),
  });
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
  return { id };
}

export async function deleteHabitValueLog(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(habitValueLogs).where(eq(habitValueLogs.id, id));
  revalidatePath("/habits", "layout");
  revalidatePath("/goals", "layout");
}
