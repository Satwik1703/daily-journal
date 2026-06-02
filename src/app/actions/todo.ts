"use server";

import { db } from "@/db/client";
import { todos, todoLists } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { requireUser } from "@/lib/auth/context";
import {
  MAX_TODO_TITLE_LEN,
  MAX_TODO_NOTE_LEN,
  type TodoStatus,
} from "@/lib/todo/todo-meta";
import {
  nextTodoPosition,
  nextListPosition,
  findTodoById,
} from "@/db/queries/todo";

function revalidate() {
  revalidatePath("/todo", "layout");
}

function sanitizeTitle(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("title must be a string");
  const s = raw.trim();
  if (!s) throw new Error("title is required");
  if (s.length > MAX_TODO_TITLE_LEN) throw new Error(`title must be ≤ ${MAX_TODO_TITLE_LEN} chars`);
  return s;
}

function sanitizeNote(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") throw new Error("note must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_TODO_NOTE_LEN) throw new Error(`note must be ≤ ${MAX_TODO_NOTE_LEN} chars`);
  return s;
}

function sanitizePriority(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > 3) return 0;
  return n;
}

function sanitizeDueDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (!isValidDateString(raw)) throw new Error(`Invalid dueDate: ${String(raw)}`);
  return raw;
}

function sanitizeDueTime(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(raw)) {
    throw new Error(`Invalid dueTime: ${String(raw)}`);
  }
  // Normalize "9:00" -> "09:00".
  const [h, m] = raw.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

// ---- Todos ----

export async function createTodo(input: {
  id?: string;
  title: string;
  note?: string | null;
  listId?: string | null;
  parentId?: string | null;
  priority?: number;
  dueDate?: string | null;
  dueTime?: string | null;
  pinned?: boolean;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const title = sanitizeTitle(input.title);
  const note = sanitizeNote(input.note);
  const priority = sanitizePriority(input.priority);
  const dueDate = sanitizeDueDate(input.dueDate);
  const dueTime = sanitizeDueTime(input.dueTime);
  const listId = input.listId ?? null;
  const parentId = input.parentId ?? null;
  const id = input.id ?? nanoid(12);
  const position = await nextTodoPosition(user.id, listId);

  const values = {
    id,
    userId: user.id,
    listId,
    parentId,
    title,
    note,
    priority,
    dueDate,
    dueTime,
    isAllDay: !dueTime,
    pinned: input.pinned ?? false,
    position,
  };
  await db
    .insert(todos)
    .values(values)
    .onConflictDoUpdate({
      target: todos.id,
      // Idempotent replay: re-apply the captured fields.
      set: {
        title,
        note,
        listId,
        parentId,
        priority,
        dueDate,
        dueTime,
        isAllDay: !dueTime,
        pinned: input.pinned ?? false,
        updatedAt: new Date(),
      },
    });
  revalidate();
  return { id };
}

export async function updateTodo(input: {
  id: string;
  title?: string;
  note?: string | null;
  listId?: string | null;
  priority?: number;
  dueDate?: string | null;
  dueTime?: string | null;
  pinned?: boolean;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const existing = await findTodoById(user.id, input.id);
  if (!existing) throw new Error("todo not found");

  const set: Partial<typeof todos.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) set.title = sanitizeTitle(input.title);
  if (input.note !== undefined) set.note = sanitizeNote(input.note);
  if (input.listId !== undefined) set.listId = input.listId;
  if (input.priority !== undefined) set.priority = sanitizePriority(input.priority);
  if (input.dueDate !== undefined) set.dueDate = sanitizeDueDate(input.dueDate);
  if (input.dueTime !== undefined) {
    set.dueTime = sanitizeDueTime(input.dueTime);
    set.isAllDay = !set.dueTime;
  }
  if (input.pinned !== undefined) set.pinned = input.pinned;

  await db
    .update(todos)
    .set(set)
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
}

export async function toggleTodo(input: { id: string }): Promise<{ status: TodoStatus }> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const existing = await findTodoById(user.id, input.id);
  if (!existing) throw new Error("todo not found");
  const nowDone = existing.status !== "done";
  const status: TodoStatus = nowDone ? "done" : "active";
  await db
    .update(todos)
    .set({ status, completedAt: nowDone ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
  return { status };
}

export async function setTodoStatus(input: {
  id: string;
  status: TodoStatus;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  if (!["active", "done", "wontDo"].includes(input.status)) {
    throw new Error(`Invalid status: ${input.status}`);
  }
  const { user } = await requireUser();
  const done = input.status !== "active";
  await db
    .update(todos)
    .set({ status: input.status, completedAt: done ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
}

export async function deleteTodo(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  // Remove subtasks first (parentId is a plain column, no cascade).
  await db
    .delete(todos)
    .where(and(eq(todos.parentId, id), eq(todos.userId, user.id)));
  await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, user.id)));
  revalidate();
}

export async function moveTodoToList(input: {
  id: string;
  listId: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const listId = input.listId ?? null;
  const position = await nextTodoPosition(user.id, listId);
  await db
    .update(todos)
    .set({ listId, position, updatedAt: new Date() })
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
}

export async function reorderTodos(input: { orderedIds: string[] }): Promise<void> {
  const { user } = await requireUser();
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
        .update(todos)
        .set({ position: i })
        .where(and(eq(todos.id, input.orderedIds[i]), eq(todos.userId, user.id)));
    }
  });
  revalidate();
}

// ---- Lists ----

function sanitizeListName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("name must be a string");
  const s = raw.trim();
  if (!s) throw new Error("List name required");
  if (s.length > 80) throw new Error("List name too long");
  return s;
}

export async function createList(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  color?: string;
  kind?: "list" | "folder";
  parentId?: string | null;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = sanitizeListName(input.name);
  const id = input.id ?? nanoid(12);
  const position = await nextListPosition(user.id);
  await db
    .insert(todoLists)
    .values({
      id,
      userId: user.id,
      name,
      emoji: input.emoji?.trim() || null,
      color: input.color || "#3b82f6",
      kind: input.kind ?? "list",
      parentId: input.parentId ?? null,
      position,
    })
    .onConflictDoUpdate({
      target: todoLists.id,
      set: {
        name,
        emoji: input.emoji?.trim() || null,
        color: input.color || "#3b82f6",
        parentId: input.parentId ?? null,
      },
    });
  revalidate();
  return { id };
}

export async function updateList(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
  viewMode?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const set: Partial<typeof todoLists.$inferInsert> = {};
  if (input.name !== undefined) set.name = sanitizeListName(input.name);
  if (input.emoji !== undefined) set.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) set.color = input.color;
  if (input.viewMode !== undefined) {
    set.viewMode = input.viewMode as typeof todoLists.$inferInsert.viewMode;
  }
  if (Object.keys(set).length === 0) return;
  await db
    .update(todoLists)
    .set(set)
    .where(and(eq(todoLists.id, input.id), eq(todoLists.userId, user.id)));
  revalidate();
}

export async function deleteList(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  // Todos in this list fall back to the Inbox (FK is ON DELETE SET NULL).
  await db
    .delete(todoLists)
    .where(and(eq(todoLists.id, id), eq(todoLists.userId, user.id)));
  revalidate();
}

export async function reorderLists(input: { orderedIds: string[] }): Promise<void> {
  const { user } = await requireUser();
  if (!Array.isArray(input.orderedIds) || input.orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(todoLists)
        .set({ position: i })
        .where(and(eq(todoLists.id, input.orderedIds[i]), eq(todoLists.userId, user.id)));
    }
  });
  revalidate();
}
