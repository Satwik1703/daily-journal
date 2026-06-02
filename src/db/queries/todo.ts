import { db } from "@/db/client";
import { todos, todoLists } from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import type { Todo, TodoList, TodoViewMode, TodoListKind } from "@/lib/todo/todo-meta";

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
