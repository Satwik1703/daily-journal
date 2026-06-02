import { db } from "@/db/client";
import { todos, todoLists, todoTags, todoTagLinks, todoSections, todoFilters } from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import type {
  Todo,
  TodoList,
  TodoViewMode,
  TodoListKind,
  TodoTag,
  TodoSection,
  TodoFilter,
} from "@/lib/todo/todo-meta";

function rowTodo(r: typeof todos.$inferSelect): Todo {
  return {
    id: r.id,
    listId: r.listId,
    parentId: r.parentId,
    sectionId: r.sectionId,
    title: r.title,
    note: r.note,
    priority: r.priority,
    status: r.status,
    completedAt: r.completedAt ? r.completedAt.getTime() : null,
    dueDate: r.dueDate,
    dueTime: r.dueTime,
    isAllDay: r.isAllDay,
    repeatJson: r.repeatJson,
    pinned: r.pinned,
    position: r.position,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

function rowList(r: typeof todoLists.$inferSelect): TodoList {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    kind: r.kind as TodoListKind,
    parentId: r.parentId,
    viewMode: r.viewMode as TodoViewMode,
    position: r.position,
  };
}

/** All non-archived lists + folders, ordered for the switcher. */
export async function getLists(userId: string): Promise<TodoList[]> {
  const rows = await db
    .select()
    .from(todoLists)
    .where(and(eq(todoLists.userId, userId), isNull(todoLists.archivedAt)))
    .orderBy(asc(todoLists.position), asc(todoLists.id));
  return rows.map(rowList);
}

/** Every active (not done / not won't-do) todo for the user. Small per-user
 * volume, so we fetch all and slice into views + counts in JS. */
export async function getActiveTodos(userId: string): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.status, "active")))
    .orderBy(asc(todos.position), asc(todos.createdAt));
  return rows.map(rowTodo);
}

/** Recently completed / won't-do todos, newest first. */
export async function getCompletedTodos(
  userId: string,
  limit = 200,
): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), inArray(todos.status, ["done", "wontDo"])))
    .orderBy(desc(todos.completedAt))
    .limit(limit);
  return rows.map(rowTodo);
}

export async function findTodoById(userId: string, id: string): Promise<Todo | null> {
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .limit(1);
  return rows[0] ? rowTodo(rows[0]) : null;
}

/** Subtasks of a parent todo (active + completed), ordered. */
export async function getSubtasks(userId: string, parentId: string): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.parentId, parentId)))
    .orderBy(asc(todos.position), asc(todos.createdAt));
  return rows.map(rowTodo);
}

/** Next append position within a list (null = inbox). */
export async function nextTodoPosition(
  userId: string,
  listId: string | null,
): Promise<number> {
  const rows = await db
    .select({ p: todos.position })
    .from(todos)
    .where(
      and(
        eq(todos.userId, userId),
        listId === null ? isNull(todos.listId) : eq(todos.listId, listId),
      ),
    )
    .orderBy(desc(todos.position))
    .limit(1);
  return (rows[0]?.p ?? -1) + 1;
}

/** Per-parent subtask progress: { parentId: { done, total } }. */
export async function getSubtaskCounts(
  userId: string,
): Promise<Record<string, { done: number; total: number }>> {
  const rows = await db
    .select({
      parentId: todos.parentId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${todos.status} = 'done' then 1 else 0 end)`,
    })
    .from(todos)
    .where(and(eq(todos.userId, userId), isNotNull(todos.parentId)))
    .groupBy(todos.parentId);
  const out: Record<string, { done: number; total: number }> = {};
  for (const r of rows) {
    if (!r.parentId) continue;
    out[r.parentId] = { done: Number(r.done) || 0, total: Number(r.total) || 0 };
  }
  return out;
}

// ---- Tags ----

function rowTag(r: typeof todoTags.$inferSelect): TodoTag {
  return { id: r.id, name: r.name, color: r.color, position: r.position };
}

export async function getTags(userId: string): Promise<TodoTag[]> {
  const rows = await db
    .select()
    .from(todoTags)
    .where(eq(todoTags.userId, userId))
    .orderBy(asc(todoTags.position), asc(todoTags.nameLower));
  return rows.map(rowTag);
}

/** Map todoId → tags, for all the user's todos. */
export async function getTagsByTodo(userId: string): Promise<Record<string, TodoTag[]>> {
  const rows = await db
    .select({
      todoId: todoTagLinks.todoId,
      id: todoTags.id,
      name: todoTags.name,
      color: todoTags.color,
      position: todoTags.position,
    })
    .from(todoTagLinks)
    .innerJoin(todoTags, eq(todoTagLinks.tagId, todoTags.id))
    .where(eq(todoTagLinks.userId, userId))
    .orderBy(asc(todoTags.position));
  const out: Record<string, TodoTag[]> = {};
  for (const r of rows) {
    (out[r.todoId] ??= []).push({ id: r.id, name: r.name, color: r.color, position: r.position });
  }
  return out;
}

export async function getTodoIdsForTag(userId: string, tagId: string): Promise<Set<string>> {
  const rows = await db
    .select({ todoId: todoTagLinks.todoId })
    .from(todoTagLinks)
    .where(and(eq(todoTagLinks.userId, userId), eq(todoTagLinks.tagId, tagId)));
  return new Set(rows.map((r) => r.todoId));
}

export async function findTagById(userId: string, id: string): Promise<TodoTag | null> {
  const rows = await db
    .select()
    .from(todoTags)
    .where(and(eq(todoTags.id, id), eq(todoTags.userId, userId)))
    .limit(1);
  return rows[0] ? rowTag(rows[0]) : null;
}

export async function nextTagPosition(userId: string): Promise<number> {
  const rows = await db
    .select({ p: todoTags.position })
    .from(todoTags)
    .where(eq(todoTags.userId, userId))
    .orderBy(desc(todoTags.position))
    .limit(1);
  return (rows[0]?.p ?? -1) + 1;
}

/** Resolve tag names to ids, creating any that don't exist (case-insensitive). */
export async function resolveTagNames(userId: string, names: string[]): Promise<string[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (clean.length === 0) return [];
  const existing = await db
    .select()
    .from(todoTags)
    .where(eq(todoTags.userId, userId));
  const byLower = new Map(existing.map((t) => [t.nameLower, t.id]));
  const ids: string[] = [];
  let pos = (existing.reduce((mx, t) => Math.max(mx, t.position), -1)) + 1;
  const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];
  for (const name of clean) {
    const lower = name.toLowerCase();
    const hit = byLower.get(lower);
    if (hit) {
      ids.push(hit);
      continue;
    }
    const { nanoid } = await import("nanoid");
    const id = nanoid(12);
    const color = PALETTE[pos % PALETTE.length];
    await db.insert(todoTags).values({ id, userId, name, nameLower: lower, color, position: pos });
    byLower.set(lower, id);
    ids.push(id);
    pos += 1;
  }
  return ids;
}

export async function findListById(userId: string, id: string): Promise<TodoList | null> {
  const rows = await db
    .select()
    .from(todoLists)
    .where(and(eq(todoLists.id, id), eq(todoLists.userId, userId)))
    .limit(1);
  return rows[0] ? rowList(rows[0]) : null;
}

export async function nextListPosition(userId: string): Promise<number> {
  const rows = await db
    .select({ p: todoLists.position })
    .from(todoLists)
    .where(eq(todoLists.userId, userId))
    .orderBy(desc(todoLists.position))
    .limit(1);
  return (rows[0]?.p ?? -1) + 1;
}

// ---- Sections ----

export async function getSectionsForList(userId: string, listId: string): Promise<TodoSection[]> {
  const rows = await db
    .select()
    .from(todoSections)
    .where(and(eq(todoSections.userId, userId), eq(todoSections.listId, listId)))
    .orderBy(asc(todoSections.position), asc(todoSections.id));
  return rows.map((r) => ({ id: r.id, listId: r.listId, name: r.name, position: r.position }));
}

export async function nextSectionPosition(userId: string, listId: string): Promise<number> {
  const rows = await db
    .select({ p: todoSections.position })
    .from(todoSections)
    .where(and(eq(todoSections.userId, userId), eq(todoSections.listId, listId)))
    .orderBy(desc(todoSections.position))
    .limit(1);
  return (rows[0]?.p ?? -1) + 1;
}

// ---- Filters ----

export async function getFilters(userId: string): Promise<TodoFilter[]> {
  const rows = await db
    .select()
    .from(todoFilters)
    .where(eq(todoFilters.userId, userId))
    .orderBy(asc(todoFilters.position), asc(todoFilters.id));
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, rulesJson: r.rulesJson, position: r.position }));
}

export async function findFilterById(userId: string, id: string): Promise<TodoFilter | null> {
  const rows = await db
    .select()
    .from(todoFilters)
    .where(and(eq(todoFilters.id, id), eq(todoFilters.userId, userId)))
    .limit(1);
  const r = rows[0];
  return r ? { id: r.id, name: r.name, color: r.color, rulesJson: r.rulesJson, position: r.position } : null;
}

export async function nextFilterPosition(userId: string): Promise<number> {
  const rows = await db
    .select({ p: todoFilters.position })
    .from(todoFilters)
    .where(eq(todoFilters.userId, userId))
    .orderBy(desc(todoFilters.position))
    .limit(1);
  return (rows[0]?.p ?? -1) + 1;
}
