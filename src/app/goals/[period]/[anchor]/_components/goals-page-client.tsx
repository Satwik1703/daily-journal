"use client";

import { useCachedPage } from "@/lib/sync/cache";
import {
  formatPeriodRange,
  isoWeekKey,
  periodKeyFor,
  todayLocal,
  type GoalPeriod,
} from "@/lib/dates";
import { PeriodToggle } from "./period-toggle";
import { GoalPeriodStepper } from "./goal-period-stepper";
import { PeriodSummaryCard } from "./period-summary-card";
import { GoalCard } from "./goal-card";
import { AddGoalButton } from "./add-goal-button";
import { GoalsEmptyState } from "./goals-empty-state";
import { ReflectionBanner } from "./reflection-banner";
import { ReflectionPrompt } from "./reflection-prompt";
import { HistoryStrip } from "./history-strip";
import { YearHeatmap } from "./year-heatmap";
import { CascadeChildren } from "./cascade-children";
import { ArchivedGoalsCard } from "./archived-goals-card";
import { GroupBreak } from "@/components/ui/group-break";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { Habit } from "@/db/queries/habits";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import type { goals } from "@/db/schema";

type ArchivedGoalRow = typeof goals.$inferSelect;
type HistoryEntry = { periodKey: string; goals: GoalWithDerived[] };

type PageData = {
  period: GoalPeriod;
  anchor: string;
  start: string;
  end: string;
  goalsForPeriod: GoalWithDerived[];
  habitOptions: Habit[];
  pomoCategories: PomoCategory[];
  history: HistoryEntry[];
  archivedGoals: ArchivedGoalRow[];
  yearHeatmap: { byWeek: Record<string, "crazy" | "great" | "good" | "avg" | "bad" | "empty"> } | null;
  childrenByParent: Record<string, GoalWithDerived[]>;
};

export function GoalsPageClient({ period, anchor }: { period: GoalPeriod; anchor: string }) {
  const data = useCachedPage<PageData | null>(
    `goals:${period}:${anchor}`,
    null,
    async () => {
      const res = await fetch(`/api/page/goals/${period}/${anchor}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  const today = todayLocal();
  const todayPeriodKey = periodKeyFor(today, period);
  const isCurrent = anchor === todayPeriodKey;
  const todayWeekKey = isoWeekKey(today);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-24 space-y-5">
      <GoalPeriodStepper period={period} periodKey={anchor} todayPeriodKey={todayPeriodKey} />

      {data == null ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-normal leading-tight">Goals</h1>
              <p className="text-xs text-muted-foreground">{formatPeriodRange(anchor, period)}</p>
            </div>
          </div>
          <PageSkeleton />
        </>
      ) : (
        <GoalsBody data={data} isCurrent={isCurrent} todayWeekKey={todayWeekKey} today={today} />
      )}
    </div>
  );
}

function GoalsBody({
  data,
  isCurrent,
  todayWeekKey,
  today,
}: {
  data: PageData;
  isCurrent: boolean;
  todayWeekKey: string;
  today: string;
}) {
  const { period, anchor, start, end, goalsForPeriod, habitOptions, pomoCategories, history, archivedGoals, yearHeatmap, childrenByParent } = data;
  const isPast = end < today;
  const isFuture = start > today;

  const mappedHabitOptions = habitOptions.map((h) => ({
    id: h.id,
    name: h.name,
    emoji: h.emoji,
    color: h.color,
  }));
  const mappedCategoryOptions = pomoCategories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  const goalsNeedingReflection = goalsForPeriod.filter(
    (g) => g.finalizedAt != null && g.reflectionSavedAt == null && g.status !== "archived",
  );

  const pinnedGoals = goalsForPeriod.filter((g) => g.pinned);
  const restGoals = goalsForPeriod.filter((g) => !g.pinned);
  const hasPinned = pinnedGoals.length > 0;

  const renderGoal = (goal: GoalWithDerived) => {
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
          period={period}
          periodKey={anchor}
          periodStart={start}
          periodEnd={end}
          today={today}
          habits={habitOptions}
          categories={pomoCategories}
          habitOptions={mappedHabitOptions}
          categoryOptions={mappedCategoryOptions}
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
  };

  return (
    <>
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
          habits={mappedHabitOptions}
          categories={mappedCategoryOptions}
        />
      </div>

      <PeriodToggle current={period} anchor={anchor} todayWeekKey={todayWeekKey} />

      <ReflectionBanner count={goalsNeedingReflection.length} />

      {hasPinned ? (
        <>
          <PeriodSummaryCard
            goals={pinnedGoals}
            period={period}
            periodKey={anchor}
            title="Important"
          />
          <div className="space-y-3">{pinnedGoals.map(renderGoal)}</div>
          <GroupBreak label="All goals" />
        </>
      ) : null}

      <PeriodSummaryCard
        goals={hasPinned ? restGoals : goalsForPeriod}
        period={period}
        periodKey={anchor}
        title={hasPinned ? "Other goals" : undefined}
      />

      {goalsForPeriod.length === 0 ? (
        <GoalsEmptyState period={period} isPast={isPast} isFuture={isFuture} />
      ) : restGoals.length === 0 && hasPinned ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Everything else is pinned. Untick &ldquo;Pin to top&rdquo; on a goal to surface it here.
        </p>
      ) : (
        <div className="space-y-3">{restGoals.map(renderGoal)}</div>
      )}

      {yearHeatmap ? (
        <YearHeatmap year={Number(anchor)} byWeek={yearHeatmap.byWeek} />
      ) : null}

      {archivedGoals.length > 0 ? (
        <ArchivedGoalsCard goals={archivedGoals} />
      ) : null}

      <HistoryStrip period={period} history={history} today={today} />
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-24 animate-pulse rounded-md bg-muted/40" />
      <div className="h-24 animate-pulse rounded-md bg-muted/40" />
      <div className="h-24 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}
