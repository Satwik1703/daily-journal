import { Card, CardContent } from "@/components/ui/card";
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
}: {
  goals: GoalWithDerived[];
  period: GoalPeriod;
  periodKey: string;
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
  const ringPath = describeRing(overall);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <svg viewBox="0 0 72 72" className="size-20 -rotate-90">
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
            />
            <path
              d={ringPath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-semibold tabular-nums">{overall}%</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
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

/** Build an SVG arc path describing N% of a circle, starting at top. */
function describeRing(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped === 0) return "M 36 6";
  if (clamped >= 100) {
    // Two-arc full circle (single arc up to 360° is ambiguous in SVG)
    return "M 36 6 A 30 30 0 1 1 36 66 A 30 30 0 1 1 36 6";
  }
  const angle = (clamped / 100) * 2 * Math.PI;
  const cx = 36;
  const cy = 36;
  const r = 30;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const largeArc = clamped > 50 ? 1 : 0;
  return `M 36 6 A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}
