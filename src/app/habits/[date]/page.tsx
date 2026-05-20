import { notFound, redirect } from "next/navigation";
import { getHabitsSnapshot } from "@/db/queries/habits";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
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

  const [snapshot, pomoCategories] = await Promise.all([
    getHabitsSnapshot({ anchor: date, windowDays: 15 }),
    getActiveCategories(),
  ]);

  // Hide habits from dates before they were created — they didn't exist yet.
  const activeForAnchor = snapshot.active.filter(
    (h) => formatLocalYMD(h.createdAt) <= date,
  );

  const isToday = date === snapshot.today;
  const hasHabits = activeForAnchor.length > 0 || snapshot.archived.length > 0;

  // Flatten the two Map<Map> shapes into plain Records keyed by habit id —
  // RSC can't serialize Maps across the server/client boundary (rule #8).
  const valueAtAnchor: Record<string, number> = {};
  const pomoCountAtAnchor: Record<string, number> = {};
  for (const h of activeForAnchor) {
    if (h.trackingKind === "number") {
      valueAtAnchor[h.id] = snapshot.windowValuesByHabit.get(h.id)?.get(date) ?? 0;
    } else if (h.trackingKind === "pomodoro") {
      pomoCountAtAnchor[h.id] = snapshot.windowPomoByHabit.get(h.id)?.get(date) ?? 0;
    }
  }

  // Map<Map> → Record<Record> for habit-grid client subtree.
  const windowValuesRecord: Record<string, Record<string, number>> = {};
  for (const [hid, dayMap] of snapshot.windowValuesByHabit) {
    windowValuesRecord[hid] = Object.fromEntries(dayMap);
  }
  const windowPomoRecord: Record<string, Record<string, number>> = {};
  for (const [hid, dayMap] of snapshot.windowPomoByHabit) {
    windowPomoRecord[hid] = Object.fromEntries(dayMap);
  }
  // Pre-flatten binary windowLogs too — same RSC reason.
  const windowLogsRecord: Record<string, string[]> = {};
  for (const [hid, dateSet] of snapshot.windowLogs) {
    windowLogsRecord[hid] = Array.from(dateSet);
  }

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
        <AddHabitButton disabled={!isToday} categories={pomoCategories} />
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
            valueAtAnchor={valueAtAnchor}
            pomoCountAtAnchor={pomoCountAtAnchor}
          />
          <HabitGrid
            habits={activeForAnchor}
            windowDates={snapshot.windowDates}
            windowLogs={windowLogsRecord}
            windowValuesByHabit={windowValuesRecord}
            windowPomoByHabit={windowPomoRecord}
            today={snapshot.today}
            anchor={date}
          />
          <HabitList
            active={activeForAnchor}
            archived={snapshot.archived}
            categories={pomoCategories}
          />
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
