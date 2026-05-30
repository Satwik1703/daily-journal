"use server";

import { db } from "@/db/client";
import { journalTasks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { formatShortDate, isValidDateString } from "@/lib/dates";
import { ensureEntry, nextTaskPosition } from "@/db/queries/journal-tasks";
import { TASK_KINDS, TASK_TRACE_MARKER, isTraceTask, type TaskKind } from "@/lib/task-meta";
import { requireUser } from "@/lib/auth/context";

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
  const { user } = await requireUser();
  const kind = sanitizeKind(input.kind);
  const text = sanitizeText(input.text ?? "", true);
  await ensureEntry(user.id, input.date);
  const id = input.id ?? nanoid(12);
  const position = await nextTaskPosition(user.id, input.date, kind);
  await db.insert(journalTasks).values({
    id,
    userId: user.id,
    date: input.date,
    kind,
    text,
    position,
  });
  revalidatePath(`/journal/${input.date}`);
  return { id };
}

export async function toggleTask(id: string): Promise<{ done: boolean }> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  const existing = await db
    .select()
    .from(journalTasks)
    .where(and(eq(journalTasks.id, id), eq(journalTasks.userId, user.id)))
    .limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  const done = !row.done;
  await db
    .update(journalTasks)
    .set({ done })
    .where(and(eq(journalTasks.id, id), eq(journalTasks.userId, user.id)));
  revalidatePath(`/journal/${row.date}`);
  return { done };
}

export async function updateTaskText(input: { id: string; text: string }): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const text = sanitizeText(input.text, true);
  const existing = await db
    .select()
    .from(journalTasks)
    .where(and(eq(journalTasks.id, input.id), eq(journalTasks.userId, user.id)))
    .limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  await db
    .update(journalTasks)
    .set({ text })
    .where(and(eq(journalTasks.id, input.id), eq(journalTasks.userId, user.id)));
  revalidatePath(`/journal/${row.date}`);
}

export async function deleteTask(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  const existing = await db
    .select()
    .from(journalTasks)
    .where(and(eq(journalTasks.id, id), eq(journalTasks.userId, user.id)))
    .limit(1);
  const row = existing[0];
  if (!row) return;
  await db
    .delete(journalTasks)
    .where(and(eq(journalTasks.id, id), eq(journalTasks.userId, user.id)));
  revalidatePath(`/journal/${row.date}`);
}

const TRACE_EXCERPT_MAX = 60;

export async function moveJournalTask(input: {
  id: string;
  newDate: string;
}): Promise<{ ok: true }> {
  if (!input.id) throw new Error("id required");
  if (!isValidDateString(input.newDate)) throw new Error(`Invalid newDate: ${input.newDate}`);
  const { user } = await requireUser();
  const existing = await db
    .select()
    .from(journalTasks)
    .where(and(eq(journalTasks.id, input.id), eq(journalTasks.userId, user.id)))
    .limit(1);
  const row = existing[0];
  if (!row) throw new Error("task not found");
  if (isTraceTask(row.text)) throw new Error("can't move a trace stub");
  if (row.date === input.newDate) throw new Error("newDate matches current date");

  await ensureEntry(user.id, input.newDate);
  const newPosition = await nextTaskPosition(user.id, input.newDate, row.kind as TaskKind);
  await db
    .update(journalTasks)
    .set({ date: input.newDate, position: newPosition, done: false })
    .where(and(eq(journalTasks.id, input.id), eq(journalTasks.userId, user.id)));

  const excerpt =
    row.text.length > TRACE_EXCERPT_MAX
      ? row.text.slice(0, TRACE_EXCERPT_MAX - 1) + "…"
      : row.text;
  const tracePosition = await nextTaskPosition(user.id, row.date, row.kind as TaskKind);
  await db.insert(journalTasks).values({
    id: nanoid(12),
    userId: user.id,
    date: row.date,
    kind: row.kind,
    text: `${excerpt}${TASK_TRACE_MARKER}${formatShortDate(input.newDate)}`,
    done: true,
    position: tracePosition,
    movedToDate: input.newDate,
  });

  revalidatePath(`/journal/${row.date}`);
  revalidatePath(`/journal/${input.newDate}`);
  return { ok: true };
}

export async function reorderTasks(input: {
  date: string;
  kind: string;
  orderedIds: string[];
}): Promise<void> {
  if (!isValidDateString(input.date)) throw new Error(`Invalid date: ${input.date}`);
  const { user } = await requireUser();
  const kind = sanitizeKind(input.kind);
  if (!Array.isArray(input.orderedIds)) throw new Error("orderedIds must be an array");
  const seen = new Set<string>();
  for (const id of input.orderedIds) {
    if (typeof id !== "string" || !id) throw new Error("invalid id in orderedIds");
    if (seen.has(id)) throw new Error("duplicate id in orderedIds");
    seen.add(id);
  }
  if (input.orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(journalTasks)
        .set({ position: i })
        .where(
          and(
            eq(journalTasks.id, input.orderedIds[i]),
            eq(journalTasks.userId, user.id),
          ),
        );
    }
  });
  void kind;
  revalidatePath(`/journal/${input.date}`);
}
