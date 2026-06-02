"use client";

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
} from "lucide-react";
import {
  SMART_VIEWS,
  type SmartView,
  type TodoList,
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
  counts,
  onCreateList,
  onEditList,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentView: string;
  lists: TodoList[];
  counts: TodoViewCounts;
  onCreateList: () => void;
  onEditList: (l: TodoList) => void;
}) {
  const router = useRouter();
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
            {lists
              .filter((l) => l.kind === "list")
              .map((l) => (
                <Row
                  key={l.id}
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
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
