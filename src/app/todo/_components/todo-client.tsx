"use client";

import { useEffect, useMemo, useState } from "react";
import { Menu, ClipboardList } from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import { useCachedPage } from "@/lib/sync/cache";
import { parseQuickAdd } from "@/lib/todo/quick-parse";
import { addDays, todayLocal } from "@/lib/dates";
import {
  parseViewParam,
  SMART_VIEWS,
  type Todo,
  type TodoList,
  type TodoPageData,
} from "@/lib/todo/todo-meta";
import { QuickAdd } from "./quick-add";
import { TodoListView } from "./todo-list";
import { TaskDetailSheet } from "./task-detail-sheet";
import { ViewSwitcher } from "./view-switcher";
import { ListFormDialog } from "./list-form-dialog";

const EMPTY_COUNTS = { today: 0, tomorrow: 0, next7: 0, inbox: 0, all: 0, byList: {} };

export function TodoClient({ view }: { view: string }) {
  const data = useCachedPage<TodoPageData | null>(`todo:${view}`, null, async () => {
    const res = await fetch(`/api/page/todo/${view}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    return (await res.json()) as TodoPageData;
  });

  const target = parseViewParam(view);
  const today = data?.today ?? todayLocal();

  // Optimistic overlays.
  const [added, setAdded] = useState<Todo[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [statusOverride, setStatusOverride] = useState<Map<string, Todo["status"]>>(new Map());
  const [reorderIds, setReorderIds] = useState<string[] | null>(null);

  // UI state.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [detail, setDetail] = useState<Todo | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<TodoList | null>(null);

  // Reset overlays whenever the view changes.
  useEffect(() => {
    setAdded([]);
    setHidden(new Set());
    setStatusOverride(new Map());
    setReorderIds(null);
  }, [view]);

  // Reconcile overlays against fresh server data.
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.todos.map((t) => t.id));
    setAdded((a) => a.filter((t) => !ids.has(t.id)));
    setHidden((h) => {
      const next = new Set<string>();
      for (const id of h) if (ids.has(id)) next.add(id);
      return next.size === h.size ? h : next;
    });
    setStatusOverride((m) => {
      let changed = false;
      const next = new Map<string, Todo["status"]>();
      for (const [id, st] of m) {
        const row = data.todos.find((t) => t.id === id);
        if (row && row.status === st) {
          changed = true;
          continue;
        }
        if (!ids.has(id) && st !== "active") {
          changed = true;
          continue;
        }
        next.set(id, st);
      }
      return changed ? next : m;
    });
    setReorderIds(null);
  }, [data]);

  const lists = useMemo(() => data?.lists ?? [], [data]);
  const listsById = useMemo(() => {
    const m = new Map<string, TodoList>();
    for (const l of lists) m.set(l.id, l);
    return m;
  }, [lists]);

  const isCompleted = target?.kind === "smart" && target.view === "completed";

  // Compose the visible todo list from server data + overlays.
  const visible = useMemo(() => {
    const base = data?.todos ?? [];
    const byId = new Map<string, Todo>();
    for (const t of base) byId.set(t.id, t);
    for (const t of added) if (!byId.has(t.id)) byId.set(t.id, t);

    let rows = Array.from(byId.values()).filter((t) => {
      if (hidden.has(t.id)) return false;
      const st = statusOverride.get(t.id) ?? t.status;
      if (isCompleted) return st !== "active";
      return st === "active";
    });

    if (reorderIds) {
      const order = new Map(reorderIds.map((id, i) => [id, i]));
      rows = [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    // Pinned float to top (stable otherwise).
    rows = [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return rows;
  }, [data, added, hidden, statusOverride, reorderIds, isCompleted]);

  // ----- view meta -----
  const list = target?.kind === "list" ? listsById.get(target.listId) : undefined;
  const title =
    target?.kind === "list"
      ? (list?.name ?? "List")
      : (SMART_VIEWS.find((v) => v.key === (target?.kind === "smart" ? target.view : ""))?.label ?? "Todo");
  const hint =
    target?.kind === "smart"
      ? SMART_VIEWS.find((v) => v.key === target.view)?.hint
      : list?.emoji
        ? list.emoji
        : undefined;

  // ----- handlers -----
  const handleAdd = (text: string) => {
    const parsed = parseQuickAdd(text, today);
    // Defaults from the active view.
    let dueDate = parsed.dueDate;
    let listId: string | null = null;
    if (target?.kind === "list") listId = target.listId;
    if (target?.kind === "smart") {
      if (target.view === "today" && !dueDate) dueDate = today;
      if (target.view === "tomorrow" && !dueDate) dueDate = addDays(today, 1);
    }
    if (parsed.listName) {
      const match = lists.find(
        (l) => l.kind === "list" && l.name.toLowerCase() === parsed.listName!.toLowerCase(),
      );
      if (match) listId = match.id;
    }
    // Phase 1 has no tag storage — keep them in the title so nothing is lost.
    const title = parsed.tags.length
      ? `${parsed.title} ${parsed.tags.map((t) => `#${t}`).join(" ")}`.trim()
      : parsed.title;
    if (!title) return;

    const id = nanoid(12);
    const optimistic: Todo = {
      id,
      listId,
      parentId: null,
      sectionId: null,
      title,
      note: null,
      priority: parsed.priority,
      status: "active",
      completedAt: null,
      dueDate,
      dueTime: parsed.dueTime,
      isAllDay: !parsed.dueTime,
      repeatJson: null,
      pinned: false,
      position: 9_999,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setAdded((a) => [...a, optimistic]);
    void mutate("create_todo", {
      id,
      title,
      listId,
      priority: parsed.priority,
      dueDate,
      dueTime: parsed.dueTime,
    });
  };

  const handleToggle = (t: Todo) => {
    setStatusOverride((m) => {
      const next = new Map(m);
      next.set(t.id, t.status === "active" ? "done" : "active");
      return next;
    });
    void mutate("toggle_todo", { id: t.id });
  };

  const handlePriority = (t: Todo, p: number) => {
    // Optimistically reflect via added/override is overkill; rely on refetch.
    void mutate("update_todo", { id: t.id, priority: p });
  };

  const handlePin = (t: Todo) => {
    void mutate("update_todo", { id: t.id, pinned: !t.pinned });
  };

  const handleReorder = (orderedIds: string[]) => {
    setReorderIds(orderedIds);
    void mutate("reorder_todos", { orderedIds });
  };

  const openDetail = (t: Todo) => {
    setDetail(t);
    setDetailOpen(true);
  };

  // Keep the open detail sheet in sync with refreshed data.
  const detailLive = detail ? (data?.todos.find((t) => t.id === detail.id) ?? detail) : null;

  const count =
    target?.kind === "list"
      ? (data?.counts.byList[target.listId] ?? visible.length)
      : isCompleted
        ? visible.length
        : (data?.counts[(target?.kind === "smart" ? target.view : "all") as keyof typeof EMPTY_COUNTS] as number ?? visible.length);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="Open lists" onClick={() => setSwitcherOpen(true)}>
          <Menu />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl font-normal leading-tight">{title}</h1>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {typeof count === "number" && count > 0 ? (
          <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </div>

      {!isCompleted ? (
        <QuickAdd today={today} lists={lists} onSubmit={handleAdd} />
      ) : null}

      {data == null ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <ClipboardList className="size-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {isCompleted ? "Nothing completed yet." : "All clear here."}
          </p>
        </div>
      ) : (
        <TodoListView
          todos={visible}
          listsById={listsById}
          subtasks={data.subtasks}
          today={today}
          showList={target?.kind !== "list"}
          reorderable={!isCompleted}
          onToggle={handleToggle}
          onOpen={openDetail}
          onPriority={handlePriority}
          onPin={handlePin}
          onReorder={handleReorder}
        />
      )}

      <ViewSwitcher
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        currentView={view}
        lists={lists}
        counts={data?.counts ?? EMPTY_COUNTS}
        onCreateList={() => {
          setEditingList(null);
          setSwitcherOpen(false);
          setListDialogOpen(true);
        }}
        onEditList={(l) => {
          setEditingList(l);
          setSwitcherOpen(false);
          setListDialogOpen(true);
        }}
      />

      <ListFormDialog open={listDialogOpen} onOpenChange={setListDialogOpen} editing={editingList} />

      <TaskDetailSheet
        todo={detailLive}
        lists={lists}
        today={today}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetail(null);
        }}
      />
    </div>
  );
}
