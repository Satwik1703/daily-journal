"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatPeriodRange,
  nextPeriodAnchor,
  prevPeriodAnchor,
  type GoalPeriod,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";

/**
 * Prev / current / next stepper for a goal period. Future periods past the
 * current one are disabled (you can't plan goals further than next period yet
 * — keep scope tight, can lift later).
 */
export function GoalPeriodStepper({
  period,
  periodKey,
  todayPeriodKey,
}: {
  period: GoalPeriod;
  periodKey: string;
  todayPeriodKey: string;
}) {
  const router = useRouter();
  const prev = prevPeriodAnchor(periodKey, period);
  const next = nextPeriodAnchor(periodKey, period);
  // Allow one period ahead of today (so user can plan next week/month).
  const nextOfToday = nextPeriodAnchor(todayPeriodKey, period);
  const canGoForward = periodKey < nextOfToday;

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Previous period"
        onClick={() => router.push(`/goals/${period}/${prev}`)}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="text-center">
        <div className="text-sm font-medium">{formatPeriodRange(periodKey, period)}</div>
        <div className="text-[11px] text-muted-foreground">
          {periodKey === todayPeriodKey ? "This period" : "Tap a date later"}
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Next period"
        disabled={!canGoForward}
        onClick={() => canGoForward && router.push(`/goals/${period}/${next}`)}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
