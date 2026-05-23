"use server";

import { db } from "@/db/client";
import { journalTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { formatShortDate, isValidDateString } from "@/lib/dates";
import { ensureEntry, nextTaskPosition } from "@/db/queries/journal-tasks";
import { TASK_KINDS, TASK_TRACE_MARKER, isTraceTask, type TaskKind } from "@/lib/task-meta";

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
  id?: string;
  date: string;
  kind: string;
  text?: string;
}): Promise<{ id: string }> {
  if (!isValidDateString(input.date)) throw new Error(`Invalid date: ${input.date}`);
  const kind = sanitizeKind(input.kind);
  const text = sanitizeText(input.text ?? "", true); // allow empty for "blank row added"
  await ensureEntry(input.date);
  const id = input.id ?? nanoid(12);
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

const TRACE_EXCERPT_MAX = 60;

/**
 * Move a journal task to a different date. Leaves a small trace stub on
 * the original date so the calendar still tells the truth ("you considered
 * this on day A, deferred it to day B").
 *
 * Throws on: invalid id, missing task, same-date moves, moving a trace
 * stub, or invalid newDate.
 */
export async function moveJournalTask(input: {
  id: string;
  newDate: string;
}): Promise<{ ok: true }> {
  if (!input.id) throw new Error("id required");
  if (!isValidDateString(input.newDate)) throw new Error(`Invalid newDate: ${input.newDate}`);
  const existing = await db
    .select()
    .from(journalTasks)
    .where(eq(journalTasks.id, input.id))
    .limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  if (isTraceTask(row.text)) throw new Error("can't move a trace stub");
  if (row.date === input.newDate) throw new Error("newDate matches current date");

  await ensureEntry(input.newDate);
  const newPosition = await nextTaskPosition(input.newDate, row.kind as TaskKind);
  await db
    .update(journalTasks)
    .set({ date: input.newDate, position: newPosition, done: false })
    .where(eq(journalTasks.id, input.id));

  // Leave a trace stub on the original date.
  // Format: "{originalText} → Moved to {Month DD}". Excerpted to keep the
  // row compact when the task text is long.
  const excerpt =
    row.text.length > TRACE_EXCERPT_MAX
      ? row.text.slice(0, TRACE_EXCERPT_MAX - 1) + "…"
      : row.text;
  const tracePosition = await nextTaskPosition(row.date, row.kind as TaskKind);
  await db.insert(journalTasks).values({
    id: nanoid(12),
    date: row.date,
    kind: row.kind,
    text: `${excerpt}${TASK_TRACE_MARKER}${formatShortDate(input.newDate)}`,
    done: true,
    position: tracePosition,
  });

  revalidatePath(`/journal/${row.date}`);
  revalidatePath(`/journal/${input.newDate}`);
  return { ok: true };
}
