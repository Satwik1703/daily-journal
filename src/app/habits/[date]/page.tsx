import { notFound, redirect } from "next/navigation";
import { getHabitsSnapshot } from "@/db/queries/habits";
import { formatHumanDate, formatLocalYMD, isValidDateString, todayLocal } from "@/lib/dates";
import { TodayToggles } from "../_components/today-toggles";
import { HabitGrid } from "../_components/habit-grid";
import { HabitList } from "../_components/habit-list";
import { AddHabitButton } from "../_components/add-habit-button";
import { HabitsDateStepper } from "./_components/habits-date-stepper";

export const dynamic = "force-dynamic";

export default async function HabitsDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/habits/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();

  const snapshot = await getHabitsSnapshot({ anchor: date, windowDays: 15 });

  // Hide habits from dates before they were created — they didn't exist yet.
  const activeForAnchor = snapshot.active.filter(
    (h) => formatLocalYMD(h.createdAt) <= date,
  );

  const isToday = date === snapshot.today;
  const hasHabits = activeForAnchor.length > 0 || snapshot.archived.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <HabitsDateStepper date={date} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Habits</h1>
          <p className="text-xs text-muted-foreground">
            {formatHumanDate(date)}
            {!isToday ? " · backfilling" : null}
          </p>
        </div>
        <AddHabitButton disabled={!isToday} />
      </div>

      {!hasHabits ? (
        <EmptyState isToday={isToday} />
      ) : (
        <>
          <TodayToggles
            anchor={date}
            isToday={isToday}
            habits={activeForAnchor}
            doneIds={Array.from(snapshot.doneOnAnchorIds)}
          />
          <HabitGrid
            habits={activeForAnchor}
            windowDates={snapshot.windowDates}
            windowLogs={snapshot.windowLogs}
            today={snapshot.today}
            anchor={date}
          />
          <HabitList active={activeForAnchor} archived={snapshot.archived} />
        </>
      )}
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
