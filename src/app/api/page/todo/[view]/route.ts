import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import {
  getLists,
  getActiveTodos,
  getCompletedTodos,
  getSubtaskCounts,
  getTags,
  getTagsByTodo,
  getTodoIdsForTag,
  getSectionsForList,
  getFilters,
  findFilterById,
} from "@/db/queries/todo";
import { addDays, todayLocal } from "@/lib/dates";
import { parseFilterRules, evalFilter } from "@/lib/todo/filters";
import {
  parseViewParam,
  todoMatchesSmartView,
  type Todo,
  type TodoPageData,
  type TodoViewCounts,
} from "@/lib/todo/todo-meta";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ view: string }> },
) {
  const { view } = await ctx.params;
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const target = parseViewParam(view);
  if (!target) return NextResponse.json({ error: "Unknown view" }, { status: 404 });

  const today = todayLocal();
  const tomorrow = addDays(today, 1);
  const next7End = addDays(today, 6);

  const [lists, active, subtasks, tags, tagsByTodo, filters] = await Promise.all([
    getLists(userId),
    getActiveTodos(userId),
    getSubtaskCounts(userId),
    getTags(userId),
    getTagsByTodo(userId),
    getFilters(userId),
  ]);

  // Top-level active todos drive the main list + all counts.
  const topActive = active.filter((t) => t.parentId == null);

  const counts: TodoViewCounts = {
    today: topActive.filter((t) => t.dueDate != null && t.dueDate <= today).length,
    tomorrow: topActive.filter((t) => t.dueDate === tomorrow).length,
    next7: topActive.filter((t) => t.dueDate != null && t.dueDate <= next7End).length,
    inbox: topActive.filter((t) => t.listId == null).length,
    all: topActive.length,
    byList: {},
  };
  for (const t of topActive) {
    if (t.listId) counts.byList[t.listId] = (counts.byList[t.listId] ?? 0) + 1;
  }

  let viewTodos: Todo[];
  if (target.kind === "smart" && target.view === "completed") {
    const completed = await getCompletedTodos(userId);
    viewTodos = completed.filter((t) => t.parentId == null);
  } else if (target.kind === "smart") {
    viewTodos = topActive.filter((t) =>
      todoMatchesSmartView(t, target.view, today, tomorrow, next7End),
    );
  } else if (target.kind === "tag") {
    const ids = await getTodoIdsForTag(userId, target.tagId);
    viewTodos = topActive.filter((t) => ids.has(t.id));
  } else if (target.kind === "filter") {
    const filter = await findFilterById(userId, target.filterId);
    const rules = filter ? parseFilterRules(filter.rulesJson) : null;
    if (!rules) {
      viewTodos = [];
    } else {
      // Filters can match completed/won't-do too (status conditions), so
      // evaluate over the full top-level set.
      const completed = await getCompletedTodos(userId, 500);
      const all = [...topActive, ...completed.filter((t) => t.parentId == null)];
      const ctx = { today, tagsByTodo };
      viewTodos = all.filter((t) => evalFilter(t, rules, ctx));
    }
  } else {
    viewTodos = topActive.filter((t) => t.listId === target.listId);
  }

  const sections =
    target.kind === "list" ? await getSectionsForList(userId, target.listId) : [];

  const payload: TodoPageData = {
    view,
    lists,
    tags,
    tagsByTodo,
    sections,
    filters,
    todos: viewTodos,
    subtasks,
    counts,
    today,
  };
  return NextResponse.json(payload);
}
