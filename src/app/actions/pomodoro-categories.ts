"use server";

import { db } from "@/db/client";
import { pomodoroCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { nextCategoryPosition } from "@/db/queries/pomodoro-categories";
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

function revalidatePomodoro() {
  revalidatePath("/pomodoro", "layout");
  revalidatePath("/settings");
  revalidatePath("/insights");
}

export async function createCategory(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  color?: string;
}): Promise<{ id: string }> {
  const name = sanitizeName(input.name);
  const emoji = sanitizeEmoji(input.emoji);
  const color = sanitizeColor(input.color ?? PRESET_COLORS[0]);
  const id = input.id ?? nanoid(12);
  const position = await nextCategoryPosition();
  await db.insert(pomodoroCategories).values({ id, name, emoji, color, position });
  revalidatePomodoro();
  return { id };
}

export async function updateCategory(input: {
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
  await db
    .update(pomodoroCategories)
    .set(patch)
    .where(eq(pomodoroCategories.id, input.id));
  revalidatePomodoro();
}

export async function archiveCategory(id: string): Promise<void> {
  await db
    .update(pomodoroCategories)
    .set({ archivedAt: new Date() })
    .where(eq(pomodoroCategories.id, id));
  revalidatePomodoro();
}

export async function unarchiveCategory(id: string): Promise<void> {
  await db
    .update(pomodoroCategories)
    .set({ archivedAt: null })
    .where(eq(pomodoroCategories.id, id));
  revalidatePomodoro();
}

export async function reorderCategories(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await db
      .update(pomodoroCategories)
      .set({ position: i })
      .where(eq(pomodoroCategories.id, ids[i]));
  }
  revalidatePomodoro();
}
