"use client";

import { useCachedPage } from "@/lib/sync/cache";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import { formatHumanDate } from "@/lib/dates";
import { TodayToggles } from "./today-toggles";
import { HabitGrid } from "./habit-grid";
import { HabitList } from "./habit-list";
import { AddHabitButton } from "./add-habit-button";
import { HabitsProgressCard } from "./habits-progress-card";
import { HabitsDateStepper } from "../[date]/_components/habits-date-stepper";
import type { Habit, HabitValueLogRow } from "@/db/queries/habits";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import type { Book } from "@/db/queries/books";

type PageData = {
  snapshot: {
    /** Weekday-mask-filtered list for the anchor day's toggles. */
    active: Habit[];
    /** Full (mask-unfiltered) list for the multi-day grid. */
    activeAll?: Habit[];
    archived: Habit[];
    today: string;
    doneOnAnchorIds: string[];
    windowDates: string[];
  };
  pomoCategories: PomoCategory[];
  valueAtAnchor: Record<string, number>;
  pomoCountAtAnchor: Record<string, number>;
  windowValuesRecord: Record<string, Record<string, number>>;
  windowPomoRecord: Record<string, Record<string, number>>;
  windowLogsRecord: Record<string, string[]>;
  valueLogsByHabit: Record<string, HabitValueLogRow[]>;
  xpByHabit: Record<string, number>;
  readingBooks: Book[];
  activeBookId: string | null;
};

export function HabitsPageClient({ date }: { date: string }) {
  const data = useCachedPage<PageData | null>(
    `habits:${date}`,
    null,
    async () => {
      const res = await authAwareFetch(`/api/page/habits/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  const isToday = data ? date === data.snapshot.today : false;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <HabitsDateStepper date={date} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Habits</h1>
          <p className="text-xs text-muted-foreground">
            {formatHumanDate(date)}
            {data && !isToday ? " · backfilling" : null}
          </p>
        </div>
        {data ? (
          <AddHabitButton disabled={!isToday} categories={data.pomoCategories} />
        ) : null}
      </div>

      {data == null ? (
        <PageSkeleton />
      ) : (data.snapshot.activeAll ?? data.snapshot.active).length === 0 &&
        data.snapshot.archived.length === 0 ? (
        <EmptyState isToday={isToday} />
      ) : (
        <>
          <HabitsProgressCard
            completed={data.snapshot.doneOnAnchorIds.length}
            total={data.snapshot.active.length}
            isToday={isToday}
          />
          <TodayToggles
            anchor={date}
            isToday={isToday}
            habits={data.snapshot.active}
            doneIds={data.snapshot.doneOnAnchorIds}
            valueAtAnchor={data.valueAtAnchor}
            pomoCountAtAnchor={data.pomoCountAtAnchor}
            valueLogsByHabit={data.valueLogsByHabit}
            xpByHabit={data.xpByHabit}
            readingBooks={data.readingBooks}
            activeBookId={data.activeBookId}
          />
          <HabitGrid
            habits={data.snapshot.activeAll ?? data.snapshot.active}
            windowDates={data.snapshot.windowDates}
            windowLogs={data.windowLogsRecord}
            windowValuesByHabit={data.windowValuesRecord}
            windowPomoByHabit={data.windowPomoRecord}
            today={data.snapshot.today}
            anchor={date}
          />
          <HabitList
            active={data.snapshot.activeAll ?? data.snapshot.active}
            archived={data.snapshot.archived}
            categories={data.pomoCategories}
            xpByHabit={data.xpByHabit}
          />
        </>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-20 animate-pulse rounded-md bg-muted/40" />
      <div className="h-60 animate-pulse rounded-md bg-muted/40" />
      <div className="h-44 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}

function EmptyState({ isToday }: { isToday: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="font-serif text-lg">
        {isToday ? "No habits yet." : "No habits existed on this date."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {isToday
          ? 'Add your first habit using the "New" button above.'
          : "Jump back to today to add new habits."}
      </p>
    </div>
  );
}
