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
import {
  getChildrenOfGoal,
  getGoalsForPeriod,
  getGoalsHistory,
  getGoalsYearHeatmap,
} from "@/db/queries/goals";
import { getActiveHabits } from "@/db/queries/habits";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { PeriodToggle } from "./_components/period-toggle";
import { GoalPeriodStepper } from "./_components/goal-period-stepper";
import { PeriodSummaryCard } from "./_components/period-summary-card";
import { GoalCard } from "./_components/goal-card";
import { AddGoalButton } from "./_components/add-goal-button";
import { GoalsEmptyState } from "./_components/goals-empty-state";
import { ReflectionBanner } from "./_components/reflection-banner";
import { ReflectionPrompt } from "./_components/reflection-prompt";
import { HistoryStrip } from "./_components/history-strip";
import { YearHeatmap } from "./_components/year-heatmap";
import { CascadeChildren } from "./_components/cascade-children";

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

  const [goalsForPeriod, habitOptions, pomoCategories, history] = await Promise.all([
    getGoalsForPeriod(period, anchor),
    getActiveHabits(),
    getActiveCategories(),
    getGoalsHistory(period, anchor, 5),
  ]);

  // Year-only: pull the weekly heatmap aggregated for this year.
  const yearHeatmap =
    period === "year"
      ? await getGoalsYearHeatmap(Number(anchor))
      : null;

  // Cascade children: fetch only for parents on year/month views.
  const childrenByParent =
    period !== "week"
      ? Object.fromEntries(
          await Promise.all(
            goalsForPeriod.map(async (g) => [g.id, await getChildrenOfGoal(g.id)] as const),
          ),
        )
      : {};

  const goalsNeedingReflection = goalsForPeriod.filter(
    (g) => g.finalizedAt != null && g.reflectionSavedAt == null && g.status !== "archived",
  );

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
          habits={habitOptions.map((h) => ({ id: h.id, name: h.name, emoji: h.emoji, color: h.color }))}
          categories={pomoCategories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color }))}
        />
      </div>

      <PeriodToggle current={period} anchor={anchor} todayWeekKey={todayWeekKey} />

      <ReflectionBanner
        count={goalsNeedingReflection.length}
      />

      <PeriodSummaryCard
        goals={goalsForPeriod}
        period={period}
        periodKey={anchor}
      />

      {goalsForPeriod.length === 0 ? (
        <GoalsEmptyState period={period} isPast={isPast} isFuture={isFuture} />
      ) : (
        <div className="space-y-3">
          {goalsForPeriod.map((goal) => {
            const needsReflection =
              goal.finalizedAt != null &&
              goal.reflectionSavedAt == null &&
              goal.status !== "archived";
            const isFirstReflect =
              needsReflection && goal.id === goalsNeedingReflection[0]?.id;
            const children = childrenByParent[goal.id] ?? [];
            return (
              <div key={goal.id} className="space-y-0">
                <GoalCard
                  goal={goal}
                  periodStart={start}
                  periodEnd={end}
                  today={today}
                  habits={habitOptions}
                  categories={pomoCategories}
                />
                {children.length > 0 ? (
                  <CascadeChildren items={children} today={today} />
                ) : null}
                {needsReflection ? (
                  <ReflectionPrompt
                    goal={goal}
                    periodEnd={end}
                    anchorId={isFirstReflect ? "first-reflect" : undefined}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {yearHeatmap ? (
        <YearHeatmap year={Number(anchor)} byWeek={yearHeatmap.byWeek} />
      ) : null}

      <HistoryStrip period={period} history={history} today={today} />
    </div>
  );
}
