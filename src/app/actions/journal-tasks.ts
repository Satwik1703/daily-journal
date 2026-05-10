"use server";

import { db } from "@/db/client";
import { journalTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { ensureEntry, nextTaskPosition } from "@/db/queries/journal-tasks";
import { TASK_KINDS, type TaskKind } from "@/lib/task-meta";

const MAX_TEXT_LEN = 240;

function sanitizeKind(raw: unknown): TaskKind {
  if (typeof raw !== "string" || !TASK_KINDS.includes(raw as TaskKind)) {
    throw new Error(`kind must be one of: ${TASK_KINDS.join(", ")}`);
  }
  return raw as TaskKind;
}

function sanitizeText(raw: unknown, allowEmpty = false): string {
  if (typeof raw !== "string") throw new Error("text must be a string");
  const s = raw.trim();
  if (!allowEmpty && !s) throw new Error("text is required");
  if (s.length > MAX_TEXT_LEN) throw new Error(`text must be ≤ ${MAX_TEXT_LEN} chars`);
  return s;
}

export async function addTask(input: {
  date: string;
  kind: string;
  text?: string;
}): Promise<{ id: string }> {
  if (!isValidDateString(input.date)) throw new Error(`Invalid date: ${input.date}`);
  const kind = sanitizeKind(input.kind);
  const text = sanitizeText(input.text ?? "", true); // allow empty for "blank row added"
  await ensureEntry(input.date);
  const id = nanoid(12);
  const position = await nextTaskPosition(input.date, kind);
  await db.insert(journalTasks).values({ id, date: input.date, kind, text, position });
  revalidatePath(`/journal/${input.date}`);
  return { id };
}

export async function toggleTask(id: string): Promise<{ done: boolean }> {
  if (!id) throw new Error("id required");
  const existing = await db.select().from(journalTasks).where(eq(journalTasks.id, id)).limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  const done = !row.done;
  await db.update(journalTasks).set({ done }).where(eq(journalTasks.id, id));
  revalidatePath(`/journal/${row.date}`);
  return { done };
}

export async function updateTaskText(input: { id: string; text: string }): Promise<void> {
  if (!input.id) throw new Error("id required");
  const text = sanitizeText(input.text, true);
  const existing = await db.select().from(journalTasks).where(eq(journalTasks.id, input.id)).limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  await db.update(journalTasks).set({ text }).where(eq(journalTasks.id, input.id));
  revalidatePath(`/journal/${row.date}`);
}

export async function deleteTask(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const existing = await db.select().from(journalTasks).where(eq(journalTasks.id, id)).limit(1);
  const row = existing[0];
  if (!row) return;
  await db.delete(journalTasks).where(eq(journalTasks.id, id));
  revalidatePath(`/journal/${row.date}`);
}
