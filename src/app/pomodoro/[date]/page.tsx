import { notFound, redirect } from "next/navigation";
import { formatHumanDate, isValidDateString, todayLocal, addDays } from "@/lib/dates";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { getPomodoroDay } from "@/db/queries/pomodoro";
import { getPomodoroSoundId } from "@/db/queries/settings";
import { PomodoroDateStepper } from "./_components/pomodoro-date-stepper";
import { TimerPanel } from "./_components/timer-panel";
import { DayStatsCard } from "./_components/day-stats-card";
import { SessionList } from "./_components/session-list";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PomodoroDatePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { date } = await params;
  const { categoryId: requestedCategoryId } = await searchParams;
  if (date === "today") redirect(`/pomodoro/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();

  const today = todayLocal();
  const isToday = date === today;
  const yesterday = addDays(date, -1);

  const [categories, day, prevDay, soundId] = await Promise.all([
    getActiveCategories(),
    getPomodoroDay(date),
    getPomodoroDay(yesterday),
    getPomodoroSoundId(),
  ]);

  // Only pass through if the param matches a real active category.
  const initialCategoryId =
    requestedCategoryId && categories.some((c) => c.id === requestedCategoryId)
      ? requestedCategoryId
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <PomodoroDateStepper date={date} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Pomodoro</h1>
          <p className="text-xs text-muted-foreground">
            {formatHumanDate(date)}
            {!isToday ? " · history" : null}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <TimerPanel
            categories={categories}
            soundId={soundId}
            isToday={isToday}
            pageDate={date}
            initialCategoryId={initialCategoryId}
          />
        </CardContent>
      </Card>

      <DayStatsCard
        today={day}
        prev={prevDay}
        prevLabel={isToday ? "Yesterday" : "Day before"}
      />

      <SessionList sessions={day.sessions} />
    </div>
  );
}
