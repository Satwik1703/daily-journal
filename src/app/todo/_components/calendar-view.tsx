"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  monthMatrix,
  monthKeyOf,
  shiftMonth,
  parseDate,
  firstOfMonth,
  formatHumanDate,
  type DateString,
} from "@/lib/dates";
import type { Todo } from "@/lib/todo/todo-meta";
import { PriorityFlag } from "./priority-menu";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["S", "M", "T", "W", "T", "F", "S"];

function priColor(p: number) {
  return p === 3 ? "#ef4444" : p === 2 ? "#f59e0b" : p === 1 ? "#3b82f6" : "#94a3b8";
}

export function CalendarView({
  todos,
  today,
  onOpen,
}: {
  todos: Todo[];
  today: DateString;
  onOpen: (t: Todo) => void;
}) {
  const [month, setMonth] = useState<DateString>(today);
  const [selected, setSelected] = useState<DateString>(today);

  const byDate = new Map<DateString, Todo[]>();
  const unscheduled: Todo[] = [];
  for (const t of todos) {
    if (t.dueDate) (byDate.get(t.dueDate) ?? byDate.set(t.dueDate, []).get(t.dueDate)!).push(t);
    else unscheduled.push(t);
  }

  const days = monthMatrix(month);
  const monthIdx = parseDate(firstOfMonth(month)).getMonth();
  const year = parseDate(firstOfMonth(month)).getFullYear();
  const selectedTasks = byDate.get(selected) ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <div className="font-serif text-sm font-medium">{MONTHS[monthIdx]} {year}</div>
          <button type="button" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 px-1 pb-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {WD.map((w, i) => <span key={i}>{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1 px-1">
          {days.map((d) => {
            const inMonth = d.slice(0, 7) === monthKeyOf(month);
            const isToday = d === today;
            const isSel = d === selected;
            const items = byDate.get(d) ?? [];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-start rounded-md p-1 text-[11px] outline-none transition-colors",
                  !inMonth && "opacity-30",
                  isSel ? "ring-2 ring-foreground/70" : isToday ? "ring-1 ring-primary/70" : "hover:bg-muted",
                )}
              >
                <span className="tabular-nums">{Number(d.slice(-2))}</span>
                {items.length ? (
                  <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {items.slice(0, 3).map((t) => (
                      <span key={t.id} className="size-1 rounded-full" style={{ backgroundColor: priColor(t.priority) }} />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{formatHumanDate(selected)}</div>
        {selectedTasks.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground/70">No tasks due.</p>
        ) : (
          <div className="space-y-1.5">
            {selectedTasks.map((t) => (
              <TaskMini key={t.id} t={t} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>

      {unscheduled.length ? (
        <div>
          <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Unscheduled</div>
          <div className="space-y-1.5">
            {unscheduled.map((t) => (
              <TaskMini key={t.id} t={t} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskMini({ t, onOpen }: { t: Todo; onOpen: (t: Todo) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/30"
    >
      <PriorityFlag priority={t.priority} showNone />
      <span className={cn("min-w-0 flex-1 truncate text-sm", t.status !== "active" && "text-muted-foreground line-through")}>
        {t.title}
      </span>
      {t.dueTime ? <span className="shrink-0 text-[11px] text-muted-foreground">{t.dueTime}</span> : null}
    </button>
  );
}
