import { getHabitsSnapshot } from "@/db/queries/habits";

export const dynamic = "force-dynamic";

import { TodayToggles } from "./_components/today-toggles";
import { HabitGrid } from "./_components/habit-grid";
import { HabitList } from "./_components/habit-list";
import { AddHabitButton } from "./_components/add-habit-button";
import { formatHumanDate } from "@/lib/dates";

export default async function HabitsPage() {
  const snapshot = await getHabitsSnapshot(30);
  const hasHabits = snapshot.active.length > 0 || snapshot.archived.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Habits</h1>
          <p className="text-xs text-muted-foreground">{formatHumanDate(snapshot.today)}</p>
        </div>
        <AddHabitButton />
      </div>

      {!hasHabits ? (
        <EmptyState />
      ) : (
        <>
          <TodayToggles
            today={snapshot.today}
            habits={snapshot.active}
            doneTodayIds={Array.from(snapshot.doneTodayIds)}
          />
          <HabitGrid
            habits={snapshot.active}
            windowDates={snapshot.windowDates}
            windowLogs={snapshot.windowLogs}
            today={snapshot.today}
          />
          <HabitList active={snapshot.active} archived={snapshot.archived} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="font-serif text-lg">No habits yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first habit using the “New” button above.
      </p>
    </div>
  );
}
