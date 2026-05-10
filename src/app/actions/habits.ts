"use server";

import { db } from "@/db/client";
import { habits, habitLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { isActiveHabit, nextPosition } from "@/db/queries/habits";
import { PRESET_COLORS } from "@/lib/habit-meta";

const MAX_NAME_LEN = 80;
const MAX_EMOJI_LEN = 8;

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

export async function createHabit(input: {
  name: string;
  emoji?: string | null;
  color?: string;
}): Promise<{ id: string }> {
  const name = sanitizeName(input.name);
  const emoji = sanitizeEmoji(input.emoji);
  const color = sanitizeColor(input.color ?? PRESET_COLORS[0]);
  const id = nanoid(12);
  const position = await nextPosition();
  await db.insert(habits).values({ id, name, emoji, color, position });
  revalidatePath("/habits");
  return { id };
}



export async function updateHabit(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = sanitizeName(input.name);
  if (input.emoji !== undefined) patch.emoji = sanitizeEmoji(input.emoji);
  if (input.color !== undefined) patch.color = sanitizeColor(input.color);
  if (Object.keys(patch).length === 0) return;
  await db.update(habits).set(patch).where(eq(habits.id, input.id));
  revalidatePath("/habits");
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
 * Toggle a habit log for a date. Returns the new state (true if logged).
 */
export async function toggleHabitForDate(
  habitId: string,
  date: string,
): Promise<{ done: boolean }> {
  if (!habitId) throw new Error("habitId is required");
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  if (!(await isActiveHabit(habitId))) throw new Error("Habit not found or archived");

  const existing = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
    revalidatePath("/habits");
    return { done: false };
  }
  await db.insert(habitLogs).values({ habitId, date });
  revalidatePath("/habits");
  return { done: true };
}
