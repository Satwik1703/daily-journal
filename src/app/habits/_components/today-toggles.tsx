"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleHabitForDate } from "@/app/actions/habits";
import { cn } from "@/lib/utils";
import type { Habit } from "@/db/queries/habits";

export function TodayToggles({
  anchor,
  isToday,
  habits,
  doneIds,
}: {
  anchor: string;
  isToday: boolean;
  habits: Habit[];
  doneIds: string[];
}) {
  const initial = new Set(doneIds);
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    initial,
    (current: Set<string>, update: { id: string; done: boolean }) => {
      const next = new Set(current);
      if (update.done) next.add(update.id);
      else next.delete(update.id);
      return next;
    },
  );
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>{isToday ? "Today" : "That day"}</span>
          {!isToday ? (
            <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
              Backfilling
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {habits.map((h) => {
          const done = optimisticDone.has(h.id);
          return (
            <button
              key={h.id}
              type="button"
              aria-pressed={done}
              onClick={() => {
                startTransition(async () => {
                  setOptimisticDone({ id: h.id, done: !done });
                  await toggleHabitForDate(h.id, anchor);
                });
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all active:scale-[0.99]",
                done
                  ? "border-transparent text-foreground"
                  : "border-border hover:bg-muted/40",
              )}
              style={done ? { backgroundColor: hexToRgba(h.color, 0.18), borderColor: hexToRgba(h.color, 0.5) } : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-base transition-colors",
                  done ? "text-white" : "text-muted-foreground bg-muted",
                )}
                style={done ? { backgroundColor: h.color } : undefined}
              >
                {done ? <Check className="size-5" strokeWidth={3} /> : (h.emoji ?? "•")}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
              <span
                className={cn(
                  "text-xs uppercase tracking-wider",
                  done ? "text-foreground/70" : "text-muted-foreground/60",
                )}
              >
                {done ? "Done" : "Tap to log"}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
