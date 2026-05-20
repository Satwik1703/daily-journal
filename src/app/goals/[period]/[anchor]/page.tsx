import { notFound } from "next/navigation";
import {
  formatPeriodRange,
  isoWeekKey,
  periodKeyFor,
  periodRangeFor,
  todayLocal,
  type GoalPeriod,
} from "@/lib/dates";
import { GOAL_PERIODS } from "@/lib/goal-meta";
import { getGoalsForPeriod } from "@/db/queries/goals";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodToggle } from "./_components/period-toggle";
import { GoalPeriodStepper } from "./_components/goal-period-stepper";
import { PeriodSummaryCard } from "./_components/period-summary-card";
import { GoalCard } from "./_components/goal-card";
import { AddGoalButton } from "./_components/add-goal-button";
import { GoalsEmptyState } from "./_components/goals-empty-state";

export const dynamic = "force-dynamic";

const PERIOD_VALUES = new Set<string>(GOAL_PERIODS);

function isValidPeriodKey(key: string, period: GoalPeriod): boolean {
  if (period === "year") return /^\d{4}$/.test(key);
  if (period === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key);
}

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ period: string; anchor: string }>;
}) {
  const { period: periodRaw, anchor } = await params;
  if (!PERIOD_VALUES.has(periodRaw)) notFound();
  const period = periodRaw as GoalPeriod;

  // "current" alias → today's period key.
  if (anchor === "current") {
    // Server-side redirect not possible without next/navigation -- but we hit this only via
    // a typed URL; the index pages handle the common case. notFound() keeps things tidy.
    notFound();
  }
  if (!isValidPeriodKey(anchor, period)) notFound();

  const today = todayLocal();
  const todayPeriodKey = periodKeyFor(today, period);
  const isCurrent = anchor === todayPeriodKey;
  const { start, end } = periodRangeFor(anchor, period);
  const isPast = end < today;
  const isFuture = start > today;

  const goalsForPeriod = await getGoalsForPeriod(period, anchor);

  // ISO week sanity check: caller may pass a future week key that lexicographically
  // exceeds today's. We allow browsing future periods (just like /habits/[date] does
  // for today only); for goals, future periods are fine to view but can't add goals.
  const todayWeekKey = isoWeekKey(today);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-24 space-y-5">
      <GoalPeriodStepper period={period} periodKey={anchor} todayPeriodKey={todayPeriodKey} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Goals</h1>
          <p className="text-xs text-muted-foreground">
            {formatPeriodRange(anchor, period)}
            {isPast ? " · closed" : isFuture ? " · upcoming" : isCurrent ? "" : null}
          </p>
        </div>
        <AddGoalButton
          period={period}
          periodKey={anchor}
          disabled={isPast}
        />
      </div>

      <PeriodToggle current={period} anchor={anchor} todayWeekKey={todayWeekKey} />

      <PeriodSummaryCard
        goals={goalsForPeriod}
        period={period}
        periodKey={anchor}
      />

      {goalsForPeriod.length === 0 ? (
        <GoalsEmptyState period={period} isPast={isPast} isFuture={isFuture} />
      ) : (
        <div className="space-y-3">
          {goalsForPeriod.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              periodStart={start}
              periodEnd={end}
              today={today}
            />
          ))}
        </div>
      )}

      {goalsForPeriod.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-3 text-center text-xs text-muted-foreground">
            More goal types — habit-linked, pomodoro-linked — landing in the next slice.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
