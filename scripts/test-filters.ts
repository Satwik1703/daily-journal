import { evalFilter, parseFilterRules, type FilterRules } from "@/lib/todo/filters";
import type { Todo, TodoTag } from "@/lib/todo/todo-meta";

let pass = 0, fail = 0;
function ok(label: string, got: boolean, exp: boolean) {
  if (got === exp) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}: expected ${exp}, got ${got}`); }
}

const today = "2026-06-03";
const base: Todo = {
  id: "t1", listId: "L1", parentId: null, sectionId: null, title: "Pay the rent", note: "via bank",
  priority: 3, status: "active", completedAt: null, dueDate: "2026-06-01", dueTime: null,
  isAllDay: true, repeatJson: null, pinned: false, position: 0, createdAt: 0, updatedAt: 0,
};
const tags: Record<string, TodoTag[]> = { t1: [{ id: "TAG1", name: "money", color: "#000", position: 0 }] };
const ctx = { today, tagsByTodo: tags };

ok("priority gte 2", evalFilter(base, { combinator: "and", conditions: [{ field: "priority", op: "gte", value: 2 }] }, ctx), true);
ok("overdue", evalFilter(base, { combinator: "and", conditions: [{ field: "due", op: "overdue", value: "" }] }, ctx), true);
ok("today (no)", evalFilter(base, { combinator: "and", conditions: [{ field: "due", op: "today", value: "" }] }, ctx), false);
ok("tag has", evalFilter(base, { combinator: "and", conditions: [{ field: "tag", op: "has", value: "TAG1" }] }, ctx), true);
ok("keyword contains note", evalFilter(base, { combinator: "and", conditions: [{ field: "keyword", op: "contains", value: "bank" }] }, ctx), true);
ok("list is", evalFilter(base, { combinator: "and", conditions: [{ field: "list", op: "is", value: "L1" }] }, ctx), true);
ok("AND both", evalFilter(base, { combinator: "and", conditions: [{ field: "priority", op: "gte", value: 3 }, { field: "due", op: "overdue", value: "" }] }, ctx), true);
ok("AND fails one", evalFilter(base, { combinator: "and", conditions: [{ field: "priority", op: "is", value: 1 }, { field: "due", op: "overdue", value: "" }] }, ctx), false);
ok("OR one matches", evalFilter(base, { combinator: "or", conditions: [{ field: "priority", op: "is", value: 1 }, { field: "due", op: "overdue", value: "" }] }, ctx), true);
ok("status active", evalFilter(base, { combinator: "and", conditions: [{ field: "status", op: "is", value: "active" }] }, ctx), true);
ok("empty matches all", evalFilter(base, { combinator: "and", conditions: [] }, ctx), true);

const parsed = parseFilterRules(JSON.stringify({ combinator: "or", conditions: [{ field: "priority", op: "gte", value: 2 }] })) as FilterRules;
ok("parse roundtrip", parsed.combinator === "or" && parsed.conditions.length === 1, true);
ok("parse bad -> null", parseFilterRules("{nope") === null, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
