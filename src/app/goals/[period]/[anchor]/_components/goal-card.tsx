import { GoalCardNumber } from "./goal-card-number";
import { GoalCardMilestone } from "./goal-card-milestone";
import { GoalCardHabit } from "./goal-card-habit";
import { GoalCardPomodoro } from "./goal-card-pomodoro";
import { PinToggleButton } from "./pin-toggle-button";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";
import type { Habit } from "@/db/queries/habits";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";

/**
 * Type-dispatching shell. Each card variant is responsible for its own UI;
 * habit/pomo cards display only (read-only), number/milestone are
 * interactive. Wrapped in a relative container so the pin/unpin button can
 * float in the top-right corner without bloating each variant.
 */
export function GoalCard({
  goal,
  periodStart,
  periodEnd,
  today,
  habits,
  categories,
}: {
  goal: GoalWithDerived;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
  habits: Habit[];
  categories: PomoCategory[];
}) {
  let inner: React.ReactNode;
  if (goal.type === "number") {
    inner = (
      <GoalCardNumber goal={goal} periodStart={periodStart} periodEnd={periodEnd} today={today} />
    );
  } else if (goal.type === "milestone") {
    inner = (
      <GoalCardMilestone goal={goal} periodStart={periodStart} periodEnd={periodEnd} today={today} />
    );
  } else if (goal.type === "habit") {
    const habit = habits.find((h) => h.id === goal.habitId) ?? null;
    inner = (
      <GoalCardHabit
        goal={goal}
        habit={habit}
        periodStart={periodStart}
        periodEnd={periodEnd}
        today={today}
      />
    );
  } else {
    const category = categories.find((c) => c.id === goal.pomoCategoryId) ?? null;
    inner = (
      <GoalCardPomodoro
        goal={goal}
        category={category}
        periodStart={periodStart}
        periodEnd={periodEnd}
        today={today}
      />
    );
  }
  return (
    <div className="relative">
      {inner}
      <div className="absolute right-2 top-2">
        <PinToggleButton goalId={goal.id} pinned={goal.pinned} />
      </div>
    </div>
  );
}
