"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ListTodo,
  CheckCircle2,
  Plus,
  Pencil,
  Hash,
  Folder,
  ChevronRight,
  Filter as FilterIcon,
} from "lucide-react";
import {
  SMART_VIEWS,
  type SmartView,
  type TodoList,
  type TodoTag,
  type TodoFilter,
  type TodoViewCounts,
} from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

const SMART_ICON: Record<SmartView, typeof Inbox> = {
  today: CalendarDays,
  tomorrow: CalendarClock,
  next7: CalendarRange,
  inbox: Inbox,
  all: ListTodo,
  completed: CheckCircle2,
};

export function ViewSwitcher({
  open,
  onOpenChange,
  currentView,
  lists,
  tags,
  filters,
  counts,
  onCreateList,
  onEditList,
  onCreateTag,
  onEditTag,
  onCreateFilter,
  onEditFilter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentView: string;
  lists: TodoList[];
  tags: TodoTag[];
  filters: TodoFilter[];
  counts: TodoViewCounts;
  onCreateList: () => void;
  onEditList: (l: TodoList) => void;
  onCreateTag: () => void;
  onEditTag: (t: TodoTag) => void;
  onCreateFilter: () => void;
  onEditFilter: (f: TodoFilter) => void;
}) {
  const router = useRouter();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("todo-collapsed-folders");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const toggleFolder = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("todo-collapsed-folders", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const go = (view: string) => {
    router.push(`/todo/${view}`);
    onOpenChange(false);
  };

  const smartCount = (key: SmartView) =>
    key === "completed" ? undefined : (counts[key] as number);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="font-serif text-lg">Todo</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <div className="space-y-0.5">
            {SMART_VIEWS.map(({ key, label }) => {
              const Icon = SMART_ICON[key];
              const c = smartCount(key);
              return (
                <Row
                  key={key}
                  active={currentView === key}
                  onClick={() => go(key)}
                  icon={<Icon className="size-4" />}
                  label={label}
                  count={c}
                />
              );
            })}
          </div>

          <div className="mt-4 mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Lists
            </span>
            <Button size="icon-xs" variant="ghost" aria-label="New list" onClick={onCreateList}>
              <Plus />
            </Button>
          </div>
          <div className="space-y-0.5">
            {lists.filter((l) => l.kind === "list").length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No lists yet.</p>
            ) : null}
            {/* Top-level lists: no folder, or a folder that no longer exists. */}
            {lists
              .filter(
                (l) =>
                  l.kind === "list" &&
                  (!l.parentId || !lists.some((f) => f.kind === "folder" && f.id === l.parentId)),
              )
              .map((l) => (
                <ListRow key={l.id} l={l} currentView={currentView} counts={counts} go={go} onEditList={onEditList} />
              ))}
            {/* Folders + their child lists. */}
            {lists
              .filter((l) => l.kind === "folder")
              .map((f) => {
                const children = lists.filter((l) => l.kind === "list" && l.parentId === f.id);
                const collapsed = collapsedFolders.has(f.id);
                return (
                  <div key={f.id}>
                    <div className="group flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/50">
                      <button
                        type="button"
                        onClick={() => toggleFolder(f.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
                      >
                        <ChevronRight
                          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !collapsed && "rotate-90")}
                        />
                        <Folder className="size-4 shrink-0" style={{ color: f.color }} />
                        <span className="flex-1 truncate font-medium">{f.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditList(f)}
                        aria-label={`Edit ${f.name}`}
                        className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                    {!collapsed ? (
                      <div className="ml-3 border-l border-border/60 pl-1.5">
                        {children.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-muted-foreground/70">Empty folder</p>
                        ) : (
                          children.map((l) => (
                            <ListRow key={l.id} l={l} currentView={currentView} counts={counts} go={go} onEditList={onEditList} />
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>

          <div className="mt-4 mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Tags
            </span>
            <Button size="icon-xs" variant="ghost" aria-label="New tag" onClick={onCreateTag}>
              <Plus />
            </Button>
          </div>
          <div className="space-y-0.5">
            {tags.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No tags yet.</p>
            ) : null}
            {tags.map((t) => (
              <Row
                key={t.id}
                active={currentView === `tag-${t.id}`}
                onClick={() => go(`tag-${t.id}`)}
                icon={<Hash className="size-4" style={{ color: t.color }} />}
                label={t.name}
                onEdit={() => onEditTag(t)}
              />
            ))}
          </div>

          <div className="mt-4 mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              Filters
            </span>
            <Button size="icon-xs" variant="ghost" aria-label="New filter" onClick={onCreateFilter}>
              <Plus />
            </Button>
          </div>
          <div className="space-y-0.5">
            {filters.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No filters yet.</p>
            ) : null}
            {filters.map((f) => (
              <Row
                key={f.id}
                active={currentView === `filter-${f.id}`}
                onClick={() => go(`filter-${f.id}`)}
                icon={<FilterIcon className="size-4" style={{ color: f.color }} />}
                label={f.name}
                onEdit={() => onEditFilter(f)}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ListRow({
  l,
  currentView,
  counts,
  go,
  onEditList,
}: {
  l: TodoList;
  currentView: string;
  counts: TodoViewCounts;
  go: (view: string) => void;
  onEditList: (l: TodoList) => void;
}) {
  return (
    <Row
      active={currentView === `list-${l.id}`}
      onClick={() => go(`list-${l.id}`)}
      icon={
        <span
          aria-hidden
          className="flex size-4 items-center justify-center text-[13px]"
          style={{ color: l.color }}
        >
          {l.emoji ?? "●"}
        </span>
      }
      label={l.name}
      count={counts.byList[l.id]}
      onEdit={() => onEditList(l)}
    />
  );
}

function Row({
  active,
  onClick,
  icon,
  label,
  count,
  onEdit,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onEdit?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active ? "bg-muted font-medium text-foreground" : "text-foreground/90 hover:bg-muted/50",
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
      </button>
      {count != null && count > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
