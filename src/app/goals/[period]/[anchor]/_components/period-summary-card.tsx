import { Card, CardContent } from "@/components/ui/card";
import { ProgressDonut } from "@/components/ui/progress-donut";
import {
  computeGoalPace,
  daysRemaining,
  type GoalStatus,
} from "@/lib/goal-meta";
import { periodRangeFor, todayLocal, type GoalPeriod } from "@/lib/dates";
import type { GoalWithDerived } from "@/db/queries/goals";

/**
 * Header card showing overall completion ring + per-period summary stats.
 * Server component — receives derived goals from page.tsx and computes pace
 * locally with no extra fetch.
 */
export function PeriodSummaryCard({
  goals,
  period,
  periodKey,
  title,
}: {
  goals: GoalWithDerived[];
  period: GoalPeriod;
  periodKey: string;
  title?: string;
}) {
  const today = todayLocal();
  const { start, end } = periodRangeFor(periodKey, period);
  const remaining = daysRemaining(periodKey, period, today);

  let onTrack = 0;
  let achieved = 0;
  let missed = 0;
  let progressSum = 0;
  let progressCount = 0;
  for (const g of goals) {
    const target = effectiveTarget(g);
    const pace = computeGoalPace({
      status: g.status as GoalStatus,
      current: g.currentValue,
      target,
      periodStart: start,
      periodEnd: end,
      today,
    });
    progressSum += pace.progress;
    progressCount++;
    if (pace.pill === "achieved") achieved++;
    else if (pace.pill === "missed") missed++;
    else if (pace.pill === "on-track" || pace.pill === "ahead") onTrack++;
  }

  const overall = progressCount === 0 ? 0 : Math.round((progressSum / progressCount) * 100);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <ProgressDonut percent={overall} />
        <div className="min-w-0 flex-1 space-y-1">
          {title ? (
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              {title}
            </p>
          ) : null}
          {goals.length === 0 ? (
            <>
              <p className="text-sm font-medium">No goals yet</p>
              <p className="text-xs text-muted-foreground">
                Add one to start tracking this {period}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {achieved + onTrack}/{goals.length} on track
                {achieved > 0 ? ` · ${achieved} achieved` : ""}
                {missed > 0 ? ` · ${missed} missed` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {remaining === 0
                  ? "Period closed"
                  : remaining === 1
                    ? "1 day left"
                    : `${remaining} days left`}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function effectiveTarget(g: GoalWithDerived): number | null {
  if (g.type === "milestone") {
    const total = (g.checklist?.length ?? 0) || 0;
    return total > 0 ? total : 1;
  }
  return g.targetValue ?? null;
}
