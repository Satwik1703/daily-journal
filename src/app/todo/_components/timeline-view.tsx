"use client";

import { addDays, parseDate, type DateString } from "@/lib/dates";
import { type Todo } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_AHEAD = 14;

function priColor(p: number) {
  return p === 3 ? "#ef4444" : p === 2 ? "#f59e0b" : p === 1 ? "#3b82f6" : "#94a3b8";
}

/**
 * Lightweight timeline: a horizontally-scrolling strip of day columns
 * (overdue + today..+14), each listing its due tasks. Todos are points (no
 * duration field yet), so this reads as a horizontal agenda rather than a Gantt.
 */
export function TimelineView({
  todos,
  today,
  onOpen,
}: {
  todos: Todo[];
  today: DateString;
  onOpen: (t: Todo) => void;
}) {
  const byDate = new Map<DateString, Todo[]>();
  const overdue: Todo[] = [];
  const undated: Todo[] = [];
  for (const t of todos) {
    if (!t.dueDate) undated.push(t);
    else if (t.dueDate < today) overdue.push(t);
    else (byDate.get(t.dueDate) ?? byDate.set(t.dueDate, []).get(t.dueDate)!).push(t);
  }

  const columns: { key: string; label: string; sub: string; items: Todo[]; tone?: string }[] = [];
  if (overdue.length) columns.push({ key: "overdue", label: "Overdue", sub: `${overdue.length}`, items: overdue, tone: "text-red-500" });
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = addDays(today, i);
    const dt = parseDate(d);
    columns.push({
      key: d,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : WD[dt.getDay()],
      sub: `${dt.getDate()}/${dt.getMonth() + 1}`,
      items: byDate.get(d) ?? [],
    });
  }
  if (undated.length) columns.push({ key: "undated", label: "No date", sub: `${undated.length}`, items: undated });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="flex w-44 shrink-0 flex-col gap-1.5">
          <div className="sticky top-0 px-1">
            <div className={cn("text-xs font-medium", col.tone)}>{col.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{col.sub}</div>
          </div>
          <div className="min-h-16 space-y-1 rounded-lg border border-border/60 bg-muted/15 p-1.5">
            {col.items.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground/40">—</p>
            ) : (
              col.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpen(t)}
                  className="flex w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs hover:bg-muted/40"
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: priColor(t.priority) }} />
                  <span className={cn("min-w-0 flex-1 truncate", t.status !== "active" && "text-muted-foreground line-through")}>
                    {t.title}
                  </span>
                  {t.dueTime ? <span className="shrink-0 text-[10px] text-muted-foreground">{t.dueTime}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
