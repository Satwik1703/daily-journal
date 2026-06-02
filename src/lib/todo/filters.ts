// Pure saved-filter rules + evaluation. No db/framework imports.
// Stored on todo_filters.rulesJson as JSON.stringify(FilterRules).

import { addDays, type DateString } from "@/lib/dates";
import type { Todo, TodoTag } from "@/lib/todo/todo-meta";

export type FilterField = "list" | "tag" | "priority" | "due" | "keyword" | "status";

export interface FilterCondition {
  field: FilterField;
  // Interpretation depends on field — see evalCondition.
  op: string;
  value: string | number;
}

export interface FilterRules {
  combinator: "and" | "or";
  conditions: FilterCondition[];
}

const FIELDS: FilterField[] = ["list", "tag", "priority", "due", "keyword", "status"];

export function parseFilterRules(raw: unknown): FilterRules | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  const combinator = r.combinator === "or" ? "or" : "and";
  if (!Array.isArray(r.conditions)) return null;
  const conditions: FilterCondition[] = [];
  for (const c of r.conditions) {
    if (!c || typeof c !== "object") continue;
    const cc = c as Record<string, unknown>;
    if (!FIELDS.includes(cc.field as FilterField)) continue;
    if (typeof cc.op !== "string") continue;
    const value = (cc.value ?? "") as string | number;
    conditions.push({ field: cc.field as FilterField, op: cc.op, value });
  }
  return { combinator, conditions };
}

export interface FilterCtx {
  today: DateString;
  tagsByTodo: Record<string, TodoTag[]>;
}

export function evalCondition(t: Todo, c: FilterCondition, ctx: FilterCtx): boolean {
  switch (c.field) {
    case "list":
      if (c.op === "inbox") return t.listId == null;
      if (c.op === "isNot") return t.listId !== String(c.value);
      return t.listId === String(c.value);
    case "tag": {
      const tags = ctx.tagsByTodo[t.id] ?? [];
      const has = tags.some((tg) => tg.id === String(c.value));
      return c.op === "isNot" ? !has : has;
    }
    case "priority": {
      const p = Number(c.value);
      if (c.op === "gte") return t.priority >= p;
      if (c.op === "lte") return t.priority <= p;
      return t.priority === p;
    }
    case "due": {
      const d = t.dueDate;
      switch (c.op) {
        case "none":
          return d == null;
        case "any":
          return d != null;
        case "overdue":
          return d != null && d < ctx.today;
        case "today":
          return d === ctx.today;
        case "next7":
          return d != null && d <= addDays(ctx.today, 6);
        case "before":
          return d != null && d < String(c.value);
        case "after":
          return d != null && d > String(c.value);
        default:
          return false;
      }
    }
    case "keyword": {
      const q = String(c.value).toLowerCase();
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q);
    }
    case "status":
      return t.status === String(c.value);
  }
}

export function evalFilter(t: Todo, rules: FilterRules, ctx: FilterCtx): boolean {
  if (rules.conditions.length === 0) return true;
  const results = rules.conditions.map((c) => evalCondition(t, c, ctx));
  return rules.combinator === "or" ? results.some(Boolean) : results.every(Boolean);
}
