"use server";

import { db } from "@/db/client";
import {
  todos,
  todoLists,
  todoTags,
  todoTagLinks,
  todoSections,
  todoCompletions,
  todoFilters,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { parseRule, advanceOrEnd } from "@/lib/todo/recurrence";
import { parseFilterRules } from "@/lib/todo/filters";
import { requireUser } from "@/lib/auth/context";
import {
  MAX_TODO_TITLE_LEN,
  MAX_TODO_NOTE_LEN,
  type TodoStatus,
} from "@/lib/todo/todo-meta";
import {
  nextTodoPosition,
  nextListPosition,
  nextTagPosition,
  nextSectionPosition,
  nextFilterPosition,
  findTodoById,
  resolveTagNames,
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

/** Replace a todo's tag links with the given tag ids. */
async function applyTodoTags(userId: string, todoId: string, tagIds: string[]): Promise<void> {
  await db
    .delete(todoTagLinks)
    .where(and(eq(todoTagLinks.userId, userId), eq(todoTagLinks.todoId, todoId)));
  const unique = [...new Set(tagIds)].filter(Boolean);
  if (unique.length) {
    await db
      .insert(todoTagLinks)
      .values(unique.map((tagId) => ({ userId, todoId, tagId })))
      .onConflictDoNothing();
  }
}

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
  sectionId?: string | null;
  repeatJson?: string | null;
  tagNames?: string[];
  tagIds?: string[];
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const title = sanitizeTitle(input.title);
  const note = sanitizeNote(input.note);
  const priority = sanitizePriority(input.priority);
  const dueDate = sanitizeDueDate(input.dueDate);
  const dueTime = sanitizeDueTime(input.dueTime);
  const listId = input.listId ?? null;
  const parentId = input.parentId ?? null;
  const sectionId = input.sectionId ?? null;
  const repeatRule = input.repeatJson ? parseRule(input.repeatJson) : null;
  const repeatJson = repeatRule ? JSON.stringify(repeatRule) : null;
  const id = input.id ?? nanoid(12);
  const position = await nextTodoPosition(user.id, listId);

  const values = {
    id,
    userId: user.id,
    listId,
    parentId,
    sectionId,
    title,
    note,
    priority,
    dueDate,
    dueTime,
    isAllDay: !dueTime,
    repeatJson,
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
        repeatJson,
        pinned: input.pinned ?? false,
        updatedAt: new Date(),
      },
    });

  // Tags: explicit ids + resolved names (create missing).
  const tagIds = [...(input.tagIds ?? [])];
  if (input.tagNames?.length) {
    tagIds.push(...(await resolveTagNames(user.id, input.tagNames)));
  }
  if (tagIds.length) await applyTodoTags(user.id, id, tagIds);

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
  repeatJson?: string | null;
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
  if (input.repeatJson !== undefined) {
    if (input.repeatJson === null || input.repeatJson === "") {
      set.repeatJson = null;
    } else {
      const rule = parseRule(input.repeatJson);
      if (!rule) throw new Error("Invalid repeat rule");
      set.repeatJson = JSON.stringify(rule);
    }
  }

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

  // Recurring task being completed → roll forward to the next occurrence
  // instead of marking done (unless the series has ended).
  const rule = nowDone && existing.repeatJson ? parseRule(existing.repeatJson) : null;
  if (rule) {
    const today = todayLocal();
    const priorRow = await db
      .select({ n: sql<number>`count(*)` })
      .from(todoCompletions)
      .where(and(eq(todoCompletions.userId, user.id), eq(todoCompletions.todoId, existing.id)));
    const completedCount = (Number(priorRow[0]?.n) || 0) + 1;
    await db.insert(todoCompletions).values({
      id: nanoid(12),
      userId: user.id,
      todoId: existing.id,
      completedDate: today,
    });
    const base = rule.mode === "completion" ? today : (existing.dueDate ?? today);
    const next = advanceOrEnd(rule, base, completedCount);
    if (next) {
      await db
        .update(todos)
        .set({ dueDate: next, status: "active", completedAt: null, updatedAt: new Date() })
        .where(and(eq(todos.id, existing.id), eq(todos.userId, user.id)));
      revalidate();
      return { status: "active" };
    }
    // Series ended — fall through to a normal completion.
  }

  const status: TodoStatus = nowDone ? "done" : "active";
  await db
    .update(todos)
    .set({ status, completedAt: nowDone ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
  return { status };
}

export async function skipRecurrence(input: { id: string }): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const existing = await findTodoById(user.id, input.id);
  if (!existing || !existing.repeatJson) throw new Error("not a recurring todo");
  const rule = parseRule(existing.repeatJson);
  if (!rule) return;
  const today = todayLocal();
  const base = rule.mode === "completion" ? today : (existing.dueDate ?? today);
  // Skip = advance without logging a completion (count unchanged).
  const priorRow = await db
    .select({ n: sql<number>`count(*)` })
    .from(todoCompletions)
    .where(and(eq(todoCompletions.userId, user.id), eq(todoCompletions.todoId, existing.id)));
  const next = advanceOrEnd(rule, base, Number(priorRow[0]?.n) || 0);
  if (next) {
    await db
      .update(todos)
      .set({ dueDate: next, updatedAt: new Date() })
      .where(and(eq(todos.id, existing.id), eq(todos.userId, user.id)));
  } else {
    await db
      .update(todos)
      .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(todos.id, existing.id), eq(todos.userId, user.id)));
  }
  revalidate();
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
  // Moving to a different list clears any section assignment (sections belong
  // to a single list).
  await db
    .update(todos)
    .set({ listId, sectionId: null, position, updatedAt: new Date() })
    .where(and(eq(todos.id, input.id), eq(todos.userId, user.id)));
  revalidate();
}

export async function moveTodoToSection(input: {
  id: string;
  sectionId: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  await db
    .update(todos)
    .set({ sectionId: input.sectionId ?? null, updatedAt: new Date() })
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
  parentId?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const set: Partial<typeof todoLists.$inferInsert> = {};
  if (input.name !== undefined) set.name = sanitizeListName(input.name);
  if (input.emoji !== undefined) set.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) set.color = input.color;
  if (input.parentId !== undefined) set.parentId = input.parentId;
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

// ---- Tags ----

function sanitizeTagName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("name must be a string");
  const s = raw.trim().replace(/^#/, "");
  if (!s) throw new Error("Tag name required");
  if (s.length > 40) throw new Error("Tag name too long");
  return s;
}

export async function createTag(input: {
  id?: string;
  name: string;
  color?: string;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = sanitizeTagName(input.name);
  const nameLower = name.toLowerCase();
  // Reuse an existing tag with the same name (case-insensitive).
  const existing = await db
    .select()
    .from(todoTags)
    .where(and(eq(todoTags.userId, user.id), eq(todoTags.nameLower, nameLower)))
    .limit(1);
  if (existing[0]) {
    if (input.color) {
      await db
        .update(todoTags)
        .set({ color: input.color })
        .where(eq(todoTags.id, existing[0].id));
    }
    revalidate();
    return { id: existing[0].id };
  }
  const id = input.id ?? nanoid(12);
  const position = await nextTagPosition(user.id);
  await db
    .insert(todoTags)
    .values({ id, userId: user.id, name, nameLower, color: input.color || "#64748b", position })
    .onConflictDoNothing();
  revalidate();
  return { id };
}

export async function updateTag(input: {
  id: string;
  name?: string;
  color?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const set: Partial<typeof todoTags.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = sanitizeTagName(input.name);
    set.name = name;
    set.nameLower = name.toLowerCase();
  }
  if (input.color !== undefined) set.color = input.color;
  if (Object.keys(set).length === 0) return;
  await db
    .update(todoTags)
    .set(set)
    .where(and(eq(todoTags.id, input.id), eq(todoTags.userId, user.id)));
  revalidate();
}

export async function deleteTag(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  // Links cascade via FK.
  await db.delete(todoTags).where(and(eq(todoTags.id, id), eq(todoTags.userId, user.id)));
  revalidate();
}

export async function setTodoTags(input: {
  todoId: string;
  tagIds?: string[];
  tagNames?: string[];
}): Promise<void> {
  if (!input.todoId) throw new Error("todoId required");
  const { user } = await requireUser();
  const todo = await findTodoById(user.id, input.todoId);
  if (!todo) throw new Error("todo not found");
  const tagIds = [...(input.tagIds ?? [])];
  if (input.tagNames?.length) {
    tagIds.push(...(await resolveTagNames(user.id, input.tagNames)));
  }
  await applyTodoTags(user.id, input.todoId, tagIds);
  revalidate();
}

// ---- Sections ----

function sanitizeSectionName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("name must be a string");
  const s = raw.trim();
  if (!s) throw new Error("Section name required");
  if (s.length > 80) throw new Error("Section name too long");
  return s;
}

export async function createSection(input: {
  id?: string;
  listId: string;
  name: string;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  if (!input.listId) throw new Error("listId required");
  const name = sanitizeSectionName(input.name);
  const id = input.id ?? nanoid(12);
  const position = await nextSectionPosition(user.id, input.listId);
  await db
    .insert(todoSections)
    .values({ id, userId: user.id, listId: input.listId, name, position })
    .onConflictDoUpdate({ target: todoSections.id, set: { name } });
  revalidate();
  return { id };
}

export async function updateSection(input: { id: string; name: string }): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const name = sanitizeSectionName(input.name);
  await db
    .update(todoSections)
    .set({ name })
    .where(and(eq(todoSections.id, input.id), eq(todoSections.userId, user.id)));
  revalidate();
}

export async function deleteSection(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  // Detach todos from the section (keep the tasks), then delete the section.
  await db
    .update(todos)
    .set({ sectionId: null })
    .where(and(eq(todos.sectionId, id), eq(todos.userId, user.id)));
  await db
    .delete(todoSections)
    .where(and(eq(todoSections.id, id), eq(todoSections.userId, user.id)));
  revalidate();
}

export async function reorderSections(input: { orderedIds: string[] }): Promise<void> {
  const { user } = await requireUser();
  if (!Array.isArray(input.orderedIds) || input.orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(todoSections)
        .set({ position: i })
        .where(and(eq(todoSections.id, input.orderedIds[i]), eq(todoSections.userId, user.id)));
    }
  });
  revalidate();
}

// ---- Filters ----

function sanitizeFilterRules(raw: unknown): string {
  const rules = parseFilterRules(raw);
  if (!rules) throw new Error("Invalid filter rules");
  return JSON.stringify(rules);
}

export async function createFilter(input: {
  id?: string;
  name: string;
  color?: string;
  rules: unknown;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = (typeof input.name === "string" ? input.name.trim() : "") || "Filter";
  const rulesJson = sanitizeFilterRules(input.rules);
  const id = input.id ?? nanoid(12);
  const position = await nextFilterPosition(user.id);
  await db
    .insert(todoFilters)
    .values({ id, userId: user.id, name, color: input.color || "#8b5cf6", rulesJson, position })
    .onConflictDoUpdate({ target: todoFilters.id, set: { name, color: input.color || "#8b5cf6", rulesJson } });
  revalidate();
  return { id };
}

export async function updateFilter(input: {
  id: string;
  name?: string;
  color?: string;
  rules?: unknown;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const set: Partial<typeof todoFilters.$inferInsert> = {};
  if (input.name !== undefined) set.name = input.name.trim() || "Filter";
  if (input.color !== undefined) set.color = input.color;
  if (input.rules !== undefined) set.rulesJson = sanitizeFilterRules(input.rules);
  if (Object.keys(set).length === 0) return;
  await db
    .update(todoFilters)
    .set(set)
    .where(and(eq(todoFilters.id, input.id), eq(todoFilters.userId, user.id)));
  revalidate();
}

export async function deleteFilter(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  await db.delete(todoFilters).where(and(eq(todoFilters.id, id), eq(todoFilters.userId, user.id)));
  revalidate();
}
