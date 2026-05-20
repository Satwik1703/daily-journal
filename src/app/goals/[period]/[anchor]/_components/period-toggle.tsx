"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  isoWeekKey,
  monthKeyOf,
  parseDate,
  periodRangeFor,
  type GoalPeriod,
} from "@/lib/dates";
import { GOAL_PERIODS, PERIOD_LABELS } from "@/lib/goal-meta";

/**
 * Pill row to switch between week / month / year. Keeps the user pointing at
 * the same calendar moment when switching — e.g. switching from "Week 21 of
 * 2026" to month picks the month containing that week's Thursday.
 */
export function PeriodToggle({
  current,
  anchor,
  todayWeekKey,
}: {
  current: GoalPeriod;
  anchor: string;
  todayWeekKey: string;
}) {
  const hrefFor = useMemo(
    () => makeHrefBuilder(current, anchor, todayWeekKey),
    [current, anchor, todayWeekKey],
  );
  return (
    <div className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted/40 p-1">
      {GOAL_PERIODS.map((p) => {
        const active = p === current;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            scroll={false}
            className={cn(
              "flex-1 rounded-sm px-3 py-1.5 text-center text-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {PERIOD_LABELS[p]}
          </Link>
        );
      })}
    </div>
  );
}

function makeHrefBuilder(current: GoalPeriod, anchor: string, todayWeekKey: string) {
  // Use the period's middle date as a canonical anchor moment.
  const { start } = periodRangeFor(anchor, current);
  // For week → use the Thursday so ISO weeks map cleanly to a month.
  const d = parseDate(start);
  if (current === "week") d.setDate(d.getDate() + 3);
  if (current === "month") d.setDate(15);
  // year: use mid-year
  if (current === "year") {
    d.setMonth(6);
    d.setDate(1);
  }
  const isoStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (next: GoalPeriod): string => {
    if (next === current) return `/goals/${current}/${anchor}`;
    if (next === "week") return `/goals/week/${isoWeekKey(isoStr)}`;
    if (next === "month") return `/goals/month/${monthKeyOf(isoStr)}`;
    return `/goals/year/${isoStr.slice(0, 4)}`;
    // Note: todayWeekKey kept as a future hook for "snap to today" affordance.
    void todayWeekKey;
  };
}
