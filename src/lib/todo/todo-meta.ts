// Client-safe Todo types + constants. NO db imports here (AGENTS.md rule 7) —
// both client components and server queries import from this module.

import type { DateString } from "@/lib/dates";

export type TodoStatus = "active" | "done" | "wontDo";
export type TodoListKind = "list" | "folder";
export type TodoViewMode = "list" | "kanban" | "calendar" | "eisenhower" | "timeline";

// Serialized shapes returned by queries / the SWR endpoint (timestamps as ms
// numbers, mirroring the gym/books query row-mappers).
export interface Todo {
  id: string;
  listId: string | null;
  parentId: string | null;
  sectionId: string | null;
  title: string;
  note: string | null;
  priority: number; // 0 none · 1 low · 2 medium · 3 high
  status: TodoStatus;
  completedAt: number | null;
  dueDate: DateString | null;
  dueTime: string | null; // "HH:MM" 24h
  isAllDay: boolean;
  repeatJson: string | null;
  pinned: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface TodoList {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  kind: TodoListKind;
  parentId: string | null;
  viewMode: TodoViewMode;
  position: number;
}

export interface TodoTag {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface TodoSection {
  id: string;
  listId: string;
  name: string;
  position: number;
}

// ---- Priority ----

export const PRIORITY_META: Record<
  number,
  { label: string; color: string; short: string }
> = {
  0: { label: "None", color: "#94a3b8", short: "" },
  1: { label: "Low", color: "#3b82f6", short: "!" },
  2: { label: "Medium", color: "#f59e0b", short: "!!" },
  3: { label: "High", color: "#ef4444", short: "!!!" },
};

export function priorityMeta(p: number) {
  return PRIORITY_META[p] ?? PRIORITY_META[0];
}

// ---- Smart lists (computed views, not stored) ----

export type SmartView =
  | "today"
  | "tomorrow"
  | "next7"
  | "inbox"
  | "all"
  | "completed";

export const SMART_VIEWS: { key: SmartView; label: string; hint: string }[] = [
  { key: "today", label: "Today", hint: "Due today + anything overdue" },
  { key: "tomorrow", label: "Tomorrow", hint: "Due tomorrow" },
  { key: "next7", label: "Next 7 Days", hint: "Due within a week" },
  { key: "inbox", label: "Inbox", hint: "No list assigned" },
  { key: "all", label: "All", hint: "Every active task" },
  { key: "completed", label: "Completed", hint: "Recently finished" },
];

export const SMART_VIEW_KEYS = SMART_VIEWS.map((v) => v.key);

export function isSmartView(v: string): v is SmartView {
  return (SMART_VIEW_KEYS as string[]).includes(v);
}

/** Parse a [view] route param into a structured target. */
export type ViewTarget =
  | { kind: "smart"; view: SmartView }
  | { kind: "list"; listId: string }
  | { kind: "tag"; tagId: string };

export function parseViewParam(raw: string): ViewTarget | null {
  if (isSmartView(raw)) return { kind: "smart", view: raw };
  if (raw.startsWith("list-")) {
    const listId = raw.slice("list-".length);
    if (listId) return { kind: "list", listId };
  }
  if (raw.startsWith("tag-")) {
    const tagId = raw.slice("tag-".length);
    if (tagId) return { kind: "tag", tagId };
  }
  return null;
}

export const TODO_PRESET_COLORS = [
  "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b",
  "#ef4444", "#ec4899", "#a855f7", "#64748b", "#6b7280",
];

export const MAX_TODO_TITLE_LEN = 500;
export const MAX_TODO_NOTE_LEN = 5000;

export interface TodoViewCounts {
  today: number;
  tomorrow: number;
  next7: number;
  inbox: number;
  all: number;
  byList: Record<string, number>;
}

// Payload returned by /api/page/todo/[view] and consumed via useCachedPage.
export interface TodoPageData {
  view: string;
  lists: TodoList[];
  tags: TodoTag[];
  tagsByTodo: Record<string, TodoTag[]>;
  sections: TodoSection[]; // sections of the current list (empty for non-list views)
  todos: Todo[]; // top-level todos for the view
  subtasks: Record<string, { done: number; total: number }>;
  counts: TodoViewCounts;
  today: DateString;
}

// ---- Sort ----

export type TodoSort = "manual" | "due" | "priority" | "title" | "created";

export const SORT_OPTIONS: { key: TodoSort; label: string }[] = [
  { key: "manual", label: "Manual" },
  { key: "due", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "title", label: "Title" },
  { key: "created", label: "Date added" },
];

function cmpDue(a: Todo, b: Todo): number {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** Sort a copy of `rows` by the given mode. Pinned-first is applied separately. */
export function sortTodos(rows: Todo[], mode: TodoSort): Todo[] {
  const out = [...rows];
  switch (mode) {
    case "due":
      out.sort((a, b) => cmpDue(a, b) || b.priority - a.priority || a.position - b.position);
      break;
    case "priority":
      out.sort((a, b) => b.priority - a.priority || cmpDue(a, b) || a.position - b.position);
      break;
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "created":
      out.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "manual":
    default:
      out.sort((a, b) => a.position - b.position);
      break;
  }
  return out;
}

/** Whether a top-level active todo belongs in a given smart view. */
export function todoMatchesSmartView(
  t: Todo,
  view: SmartView,
  today: DateString,
  tomorrow: DateString,
  next7End: DateString,
): boolean {
  switch (view) {
    case "today":
      return t.dueDate != null && t.dueDate <= today;
    case "tomorrow":
      return t.dueDate === tomorrow;
    case "next7":
      return t.dueDate != null && t.dueDate <= next7End;
    case "inbox":
      return t.listId == null;
    case "all":
      return true;
    case "completed":
      return false; // handled separately (status-based)
  }
}
