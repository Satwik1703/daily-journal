"use client";

import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeboxStackedChart } from "./timebox-stacked-chart";
import type { TimeboxCategory } from "@/lib/timebox-meta";

const UNCAT = "__uncat__";
const UNCAT_COLOR = "#9ca3af";

export function TimeboxSection({
  categories,
  byDay,
  totalsPerCategory,
  totalMinutes,
}: {
  categories: TimeboxCategory[];
  byDay: Array<{ date: string; totals: Record<string, number> }>;
  totalsPerCategory: Record<string, number>;
  totalMinutes: number;
}) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const ranked = Object.entries(totalsPerCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([id, minutes]) => {
      const cat = id === UNCAT ? null : catById.get(id);
      return {
        id,
        name: cat?.name ?? "Uncategorized",
        emoji: cat?.emoji ?? null,
        color: cat?.color ?? UNCAT_COLOR,
        minutes,
      };
    });
  const totalHrs = (totalMinutes / 60).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 font-serif text-lg font-normal">
          <CalendarClock className="size-4" /> Where your time goes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalMinutes === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
            No timebox entries yet in this range.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <strong className="tabular-nums">{totalHrs} hrs</strong> logged
              across {byDay.length} {byDay.length === 1 ? "day" : "days"}
            </p>
            <TimeboxStackedChart
              byDay={byDay}
              categories={ranked.map((r) => ({ id: r.id, color: r.color, name: r.name }))}
            />
            <ul className="space-y-1.5">
              {ranked.slice(0, 8).map((r) => {
                const pct = totalMinutes > 0 ? (r.minutes / totalMinutes) * 100 : 0;
                return (
                  <li key={r.id} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: r.color }}
                    />
                    <span className="flex-1 truncate text-sm">
                      {r.emoji ? <span className="mr-1">{r.emoji}</span> : null}
                      {r.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {(r.minutes / 60).toFixed(1)} hrs · {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
