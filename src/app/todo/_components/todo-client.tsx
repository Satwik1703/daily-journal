"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, ClipboardList, Search, CheckSquare } from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import { useCachedPage } from "@/lib/sync/cache";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import { parseQuickAdd } from "@/lib/todo/quick-parse";
import { addDays, todayLocal, type DateString } from "@/lib/dates";
import {
  parseViewParam,
  sortTodos,
  SMART_VIEWS,
  type Todo,
  type TodoList,
  type TodoTag,
  type TodoFilter,
  type TodoPageData,
  type TodoSort,
} from "@/lib/todo/todo-meta";
import { QuickAdd } from "./quick-add";
import { TodoListView } from "./todo-list";
import { SectionList } from "./section-list";
import { TaskDetailSheet } from "./task-detail-sheet";
import { ViewSwitcher } from "./view-switcher";
import { ListFormDialog } from "./list-form-dialog";
import { TagFormDialog } from "./tag-form-dialog";
import { FilterBuilderDialog } from "./filter-builder-dialog";
import { SortMenu } from "./sort-menu";
import { SearchSheet } from "./search-sheet";
import { ViewModeMenu, type RenderMode } from "./view-mode-menu";
import { BulkBar } from "./bulk-bar";
import { CalendarView } from "./calendar-view";
import { KanbanView } from "./kanban-view";
import { EisenhowerView } from "./eisenhower-view";
import { TimelineView } from "./timeline-view";

const EMPTY_COUNTS = { today: 0, tomorrow: 0, next7: 0, inbox: 0, all: 0, byList: {} };

export function TodoClient({ view }: { view: string }) {
  // `v2` namespace bump flushes any stale-shaped cache from earlier builds.
  const data = useCachedPage<TodoPageData | null>(`todo:v2:${view}`, null, async () => {
    const res = await authAwareFetch(`/api/page/todo/${view}`, { cache: "no-store" });
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
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TodoTag | null>(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<TodoFilter | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<TodoSort>("manual");
  const [mode, setMode] = useState<RenderMode>("list");

  // Per-view render mode, persisted in localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`todo-mode:${view}`);
      setMode(saved ? (saved as RenderMode) : "list");
    } catch {
      setMode("list");
    }
  }, [view]);
  const changeMode = (m: RenderMode) => {
    setMode(m);
    try {
      localStorage.setItem(`todo-mode:${view}`, m);
    } catch {
      /* ignore */
    }
  };

  // Per-view sort, persisted in localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`todo-sort:${view}`);
      setSort(saved && saved.length ? (saved as TodoSort) : "manual");
    } catch {
      setSort("manual");
    }
  }, [view]);
  const changeSort = (s: TodoSort) => {
    setSort(s);
    try {
      localStorage.setItem(`todo-sort:${view}`, s);
    } catch {
      /* ignore */
    }
  };

  // Reset overlays whenever the view changes.
  useEffect(() => {
    setAdded([]);
    setHidden(new Set());
    setStatusOverride(new Map());
    setReorderIds(null);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [view]);

  // Desktop keyboard shortcuts. Ignored while typing in a field (Esc still blurs).
  const quickAddRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "Escape" && typing) {
        (el as HTMLElement).blur();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "n") {
        e.preventDefault();
        quickAddRef.current?.focus();
      } else if (e.key >= "1" && e.key <= "5") {
        const modes = ["list", "calendar", "kanban", "eisenhower", "timeline"] as const;
        changeMode(modes[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Defensive defaults — a stale IndexedDB cache from an earlier build may lack
  // newer payload fields (tagsByTodo/subtasks), and indexing undefined[id] crashes.
  const tagsByTodo = useMemo(() => data?.tagsByTodo ?? {}, [data]);
  const subtasksMap = useMemo(() => data?.subtasks ?? {}, [data]);
  const listsById = useMemo(() => {
    const m = new Map<string, TodoList>();
    for (const l of lists) m.set(l.id, l);
    return m;
  }, [lists]);

  const isCompleted = target?.kind === "smart" && target.view === "completed";
  const isList = target?.kind === "list";
  const sections = data?.sections ?? [];
  const effectiveMode: RenderMode = isCompleted ? "list" : mode;

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

    if (sort === "manual" && reorderIds) {
      const order = new Map(reorderIds.map((id, i) => [id, i]));
      rows = [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (sort !== "manual") {
      rows = sortTodos(rows, sort);
    }
    // Pinned float to top (stable otherwise).
    rows = [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return rows;
  }, [data, added, hidden, statusOverride, reorderIds, isCompleted, sort]);

  // ----- view meta -----
  const list = target?.kind === "list" ? listsById.get(target.listId) : undefined;
  const tag = target?.kind === "tag" ? (data?.tags ?? []).find((t) => t.id === target.tagId) : undefined;
  const filter = target?.kind === "filter" ? (data?.filters ?? []).find((f) => f.id === target.filterId) : undefined;
  const title =
    target?.kind === "list"
      ? (list?.name ?? "List")
      : target?.kind === "tag"
        ? `#${tag?.name ?? "tag"}`
        : target?.kind === "filter"
          ? (filter?.name ?? "Filter")
          : (SMART_VIEWS.find((v) => v.key === (target?.kind === "smart" ? target.view : ""))?.label ?? "Todo");
  const hint =
    target?.kind === "smart"
      ? SMART_VIEWS.find((v) => v.key === target.view)?.hint
      : list?.emoji
        ? list.emoji
        : undefined;

  // ----- handlers -----
  const handleAdd = (text: string, extra?: { dueDate?: DateString | null; dueTime?: string | null; repeat?: string | null }) => {
    const parsed = parseQuickAdd(text, today);
    // Chip overrides win over parsed values.
    const dueTime = extra && "dueTime" in extra ? extra.dueTime ?? null : parsed.dueTime;
    const repeat = extra && "repeat" in extra ? extra.repeat ?? null : parsed.repeat;
    // Defaults from the active view.
    let dueDate = extra && "dueDate" in extra ? extra.dueDate ?? null : parsed.dueDate;
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
    const title = parsed.title;
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
      dueTime,
      isAllDay: !dueTime,
      repeatJson: repeat ?? null,
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
      dueTime,
      tagNames: parsed.tags.length ? parsed.tags : undefined,
      repeatJson: repeat ?? undefined,
    });
  };

  const handleToggle = (t: Todo) => {
    // Recurring tasks roll forward server-side instead of disappearing, so we
    // don't optimistically hide them — let the refetch re-render the next
    // occurrence (with its new due date).
    if (t.repeatJson && t.status === "active") {
      void mutate("toggle_todo", { id: t.id });
      return;
    }
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

  const handleDelete = (t: Todo) => {
    setHidden((h) => new Set(h).add(t.id));
    void mutate("delete_todo", { id: t.id });
  };

  // Swipe-left reschedule: no due → tomorrow; has due → +1 day.
  const handleReschedule = (t: Todo) => {
    const next = t.dueDate ? addDays(t.dueDate, 1) : addDays(today, 1);
    void mutate("update_todo", { id: t.id, dueDate: next });
  };

  const openDetail = (t: Todo) => {
    setDetail(t);
    setDetailOpen(true);
  };

  // ----- bulk -----
  const toggleSelect = (id: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const selectedTodos = () => visible.filter((t) => selectedIds.has(t.id));
  const bulkComplete = () => {
    setStatusOverride((m) => {
      const next = new Map(m);
      for (const t of selectedTodos()) if (t.status === "active") next.set(t.id, "done");
      return next;
    });
    for (const t of selectedTodos()) if (t.status === "active") void mutate("toggle_todo", { id: t.id });
    exitSelect();
  };
  const bulkDelete = () => {
    const ids = [...selectedIds];
    setHidden((h) => {
      const next = new Set(h);
      for (const id of ids) next.add(id);
      return next;
    });
    for (const id of ids) void mutate("delete_todo", { id });
    exitSelect();
  };
  const bulkPriority = (p: number) => {
    for (const id of selectedIds) void mutate("update_todo", { id, priority: p });
    exitSelect();
  };
  const bulkDue = (d: DateString | null) => {
    for (const id of selectedIds) void mutate("update_todo", { id, dueDate: d });
    exitSelect();
  };
  const bulkMove = (listId: string | null) => {
    for (const id of selectedIds) void mutate("move_todo_to_list", { id, listId });
    exitSelect();
  };

  // Keep the open detail sheet in sync with refreshed data.
  const detailLive = detail ? (data?.todos.find((t) => t.id === detail.id) ?? detail) : null;

  const count =
    target?.kind === "list"
      ? (data?.counts.byList[target.listId] ?? visible.length)
      : target?.kind === "tag" || target?.kind === "filter"
        ? visible.length
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
          <span className="mr-1 text-sm tabular-nums text-muted-foreground">{count}</span>
        ) : null}
        <Button size="icon-sm" variant="ghost" aria-label="Search" onClick={() => setSearchOpen(true)}>
          <Search />
        </Button>
        {!isCompleted ? <ViewModeMenu value={mode} onChange={changeMode} /> : null}
        {effectiveMode === "list" ? <SortMenu value={sort} onChange={changeSort} /> : null}
        {effectiveMode === "list" ? (
          <Button
            size="icon-sm"
            variant={selectMode ? "secondary" : "ghost"}
            aria-label={selectMode ? "Exit selection" : "Select tasks"}
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          >
            <CheckSquare />
          </Button>
        ) : null}
      </div>

      {!isCompleted ? (
        <QuickAdd today={today} lists={lists} tags={data?.tags ?? []} onSubmit={handleAdd} inputRef={quickAddRef} />
      ) : null}

      {data == null ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-14 animate-pulse rounded-lg bg-muted/40" />
        </div>
      ) : effectiveMode === "calendar" ? (
        <CalendarView todos={visible} today={today} onOpen={openDetail} />
      ) : effectiveMode === "kanban" ? (
        <KanbanView todos={visible} today={today} onOpen={openDetail} onSetPriority={handlePriority} />
      ) : effectiveMode === "eisenhower" ? (
        <EisenhowerView todos={visible} today={today} onOpen={openDetail} />
      ) : effectiveMode === "timeline" ? (
        <TimelineView todos={visible} today={today} onOpen={openDetail} />
      ) : isList ? (
        visible.length === 0 && sections.length === 0 ? (
          <>
            <EmptyState isCompleted={false} />
            <SectionList
              listId={(target as { listId: string }).listId}
              sections={sections}
              todos={visible}
              listsById={listsById}
              subtasks={subtasksMap}
              tagsByTodo={tagsByTodo}
              today={today}
              reorderable={sort === "manual"}
              onToggle={handleToggle}
              onOpen={openDetail}
              onPriority={handlePriority}
              onPin={handlePin}
              onDelete={handleDelete}
              onReschedule={handleReschedule}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onReorder={handleReorder}
            />
          </>
        ) : (
          <SectionList
            listId={(target as { listId: string }).listId}
            sections={sections}
            todos={visible}
            listsById={listsById}
            subtasks={subtasksMap}
            tagsByTodo={tagsByTodo}
            today={today}
            reorderable={sort === "manual"}
            onToggle={handleToggle}
            onOpen={openDetail}
            onPriority={handlePriority}
            onPin={handlePin}
            onDelete={handleDelete}
            onReschedule={handleReschedule}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onReorder={handleReorder}
          />
        )
      ) : visible.length === 0 ? (
        <EmptyState isCompleted={isCompleted} />
      ) : (
        <TodoListView
          todos={visible}
          listsById={listsById}
          subtasks={subtasksMap}
          tagsByTodo={tagsByTodo}
          today={today}
          showList
          reorderable={!isCompleted && sort === "manual"}
          onToggle={handleToggle}
          onOpen={openDetail}
          onPriority={handlePriority}
          onPin={handlePin}
          onDelete={handleDelete}
          onReschedule={handleReschedule}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onReorder={handleReorder}
        />
      )}

      {selectMode && selectedIds.size > 0 ? (
        <BulkBar
          count={selectedIds.size}
          lists={lists}
          onComplete={bulkComplete}
          onPriority={bulkPriority}
          onDue={bulkDue}
          onMove={bulkMove}
          onDelete={bulkDelete}
          onClose={exitSelect}
        />
      ) : null}

      <ViewSwitcher
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        currentView={view}
        lists={lists}
        tags={data?.tags ?? []}
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
        onCreateTag={() => {
          setEditingTag(null);
          setSwitcherOpen(false);
          setTagDialogOpen(true);
        }}
        onEditTag={(t) => {
          setEditingTag(t);
          setSwitcherOpen(false);
          setTagDialogOpen(true);
        }}
        filters={data?.filters ?? []}
        onCreateFilter={() => {
          setEditingFilter(null);
          setSwitcherOpen(false);
          setFilterDialogOpen(true);
        }}
        onEditFilter={(f) => {
          setEditingFilter(f);
          setSwitcherOpen(false);
          setFilterDialogOpen(true);
        }}
      />

      <ListFormDialog
        open={listDialogOpen}
        onOpenChange={setListDialogOpen}
        editing={editingList}
        folders={lists.filter((l) => l.kind === "folder")}
      />
      <TagFormDialog open={tagDialogOpen} onOpenChange={setTagDialogOpen} editing={editingTag} />
      <FilterBuilderDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        editing={editingFilter}
        lists={lists}
        tags={data?.tags ?? []}
      />
      <SearchSheet open={searchOpen} onOpenChange={setSearchOpen} onPick={openDetail} />

      <TaskDetailSheet
        todo={detailLive}
        lists={lists}
        allTags={data?.tags ?? []}
        initialTags={detail ? (tagsByTodo[detail.id] ?? []) : []}
        sections={sections}
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

function EmptyState({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      <ClipboardList className="size-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">
        {isCompleted ? "Nothing completed yet." : "All clear here."}
      </p>
    </div>
  );
}
