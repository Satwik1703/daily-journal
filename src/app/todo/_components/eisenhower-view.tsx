"use client";

import { addDays, formatShortDate, type DateString } from "@/lib/dates";
import { type Todo } from "@/lib/todo/todo-meta";
import { PriorityFlag } from "./priority-menu";
import { cn } from "@/lib/utils";

// Urgent = due today / overdue / tomorrow. Important = priority medium or high.
function isUrgent(t: Todo, today: DateString): boolean {
  return !!t.dueDate && t.dueDate <= addDays(today, 1);
}
function isImportant(t: Todo): boolean {
  return t.priority >= 2;
}

const QUADRANTS = [
  { key: "do", title: "Do first", sub: "Urgent · Important", tone: "border-red-500/40" },
  { key: "schedule", title: "Schedule", sub: "Important · Not urgent", tone: "border-amber-500/40" },
  { key: "delegate", title: "Delegate", sub: "Urgent · Not important", tone: "border-blue-500/40" },
  { key: "later", title: "Later", sub: "Neither", tone: "border-border" },
] as const;

export function EisenhowerView({
  todos,
  today,
  onOpen,
}: {
  todos: Todo[];
  today: DateString;
  onOpen: (t: Todo) => void;
}) {
  const buckets: Record<string, Todo[]> = { do: [], schedule: [], delegate: [], later: [] };
  for (const t of todos) {
    const u = isUrgent(t, today);
    const i = isImportant(t);
    buckets[i && u ? "do" : i && !u ? "schedule" : !i && u ? "delegate" : "later"].push(t);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {QUADRANTS.map((q) => (
        <div key={q.key} className={cn("flex min-h-40 flex-col rounded-xl border bg-card p-2", q.tone)}>
          <div className="mb-1.5 px-1">
            <div className="text-xs font-medium">{q.title}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{q.sub}</div>
          </div>
          <div className="flex-1 space-y-1">
            {buckets[q.key].length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground/50">—</p>
            ) : (
              buckets[q.key].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpen(t)}
                  className="flex w-full items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5 text-left text-xs hover:bg-muted/40"
                >
                  <PriorityFlag priority={t.priority} />
                  <span className={cn("min-w-0 flex-1 truncate", t.status !== "active" && "text-muted-foreground line-through")}>
                    {t.title}
                  </span>
                  {t.dueDate ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatShortDate(t.dueDate)}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
