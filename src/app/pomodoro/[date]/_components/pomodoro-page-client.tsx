"use client";

import { useCachedPage } from "@/lib/sync/cache";
import { Card, CardContent } from "@/components/ui/card";
import { formatHumanDate } from "@/lib/dates";
import { PomodoroDateStepper } from "./pomodoro-date-stepper";
import { TimerPanel } from "./timer-panel";
import { DayStatsCard } from "./day-stats-card";
import { SessionList } from "./session-list";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import type { PomodoroDay } from "@/db/queries/pomodoro";

type PageData = {
  categories: PomoCategory[];
  day: PomodoroDay;
  prevDay: PomodoroDay;
  soundId: string;
  isToday: boolean;
  yesterdayDate: string;
};

export function PomodoroPageClient({
  date,
  initialCategoryId,
  initialAutostart,
}: {
  date: string;
  initialCategoryId: string | null;
  initialAutostart: boolean;
}) {
  const data = useCachedPage<PageData | null>(
    `pomodoro:${date}`,
    null,
    async () => {
      const res = await fetch(`/api/page/pomodoro/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <PomodoroDateStepper date={date} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Pomodoro</h1>
          <p className="text-xs text-muted-foreground">
            {formatHumanDate(date)}
            {data && !data.isToday ? " · history" : null}
          </p>
        </div>
      </div>

      {data == null ? (
        <PageSkeleton />
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <TimerPanel
                categories={data.categories}
                soundId={data.soundId}
                isToday={data.isToday}
                pageDate={date}
                initialCategoryId={
                  initialCategoryId &&
                  data.categories.some((c) => c.id === initialCategoryId)
                    ? initialCategoryId
                    : null
                }
                initialAutostart={initialAutostart}
              />
            </CardContent>
          </Card>

          <DayStatsCard
            today={data.day}
            prev={data.prevDay}
            prevLabel={data.isToday ? "Yesterday" : "Day before"}
          />

          <SessionList sessions={data.day.sessions} />
        </>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-72 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}
