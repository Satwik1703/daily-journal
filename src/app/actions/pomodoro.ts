"use server";

import { db } from "@/db/client";
import { pomodoroSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString, formatLocalYMD } from "@/lib/dates";
import { isActiveCategory } from "@/db/queries/pomodoro-categories";

const MAX_DESC_LEN = 2000;
const MIN_DURATION = 1;
const MAX_DURATION = 24 * 60;

function sanitizeDescription(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("description must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_DESC_LEN)
    throw new Error(`description must be ≤ ${MAX_DESC_LEN} chars`);
  return s;
}

function sanitizeDuration(raw: unknown, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    throw new Error(`${label} must be an integer`);
  if (n < MIN_DURATION || n > MAX_DURATION)
    throw new Error(`${label} must be between ${MIN_DURATION} and ${MAX_DURATION}`);
  return n;
}

function sanitizeTimestamp(raw: unknown, label: string): Date {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`);
  const d = new Date(n);
  if (isNaN(d.getTime())) throw new Error(`${label} is invalid`);
  return d;
}

export async function createSession(input: {
  date?: string;
  startedAt: number;
  endedAt: number;
  durationMin: number;
  plannedMin: number;
  categoryId?: string | null;
  description?: string | null;
  source: "timer" | "manual" | "partial";
}): Promise<{ id: string }> {
  const startedAt = sanitizeTimestamp(input.startedAt, "startedAt");
  const endedAt = sanitizeTimestamp(input.endedAt, "endedAt");
  if (endedAt.getTime() < startedAt.getTime())
    throw new Error("endedAt must be ≥ startedAt");

  const durationMin = sanitizeDuration(input.durationMin, "durationMin");
  const plannedMin = sanitizeDuration(input.plannedMin, "plannedMin");

  const date = input.date ?? formatLocalYMD(startedAt);
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);

  let categoryId: string | null = null;
  if (input.categoryId) {
    if (!(await isActiveCategory(input.categoryId)))
      throw new Error("Category not found or archived");
    categoryId = input.categoryId;
  }

  const description = sanitizeDescription(input.description);

  if (input.source !== "timer" && input.source !== "manual" && input.source !== "partial")
    throw new Error("Invalid source");

  const id = nanoid(12);
  await db.insert(pomodoroSessions).values({
    id,
    date,
    startedAt,
    endedAt,
    durationMin,
    plannedMin,
    categoryId,
    description,
    source: input.source,
  });

  revalidatePath("/pomodoro", "layout");
  revalidatePath("/insights");
  return { id };
}

export async function updateSession(input: {
  id: string;
  description?: string | null;
  categoryId?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};

  if (input.description !== undefined)
    patch.description = sanitizeDescription(input.description);

  if (input.categoryId !== undefined) {
    if (input.categoryId === null) {
      patch.categoryId = null;
    } else {
      if (!(await isActiveCategory(input.categoryId)))
        throw new Error("Category not found or archived");
      patch.categoryId = input.categoryId;
    }
  }

  if (Object.keys(patch).length === 0) return;
  await db
    .update(pomodoroSessions)
    .set(patch)
    .where(eq(pomodoroSessions.id, input.id));
  revalidatePath("/pomodoro", "layout");
  revalidatePath("/insights");
}

export async function deleteSession(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  await db.delete(pomodoroSessions).where(eq(pomodoroSessions.id, id));
  revalidatePath("/pomodoro", "layout");
  revalidatePath("/insights");
}
