import { GoalCardNumber } from "./goal-card-number";
import { GoalCardMilestone } from "./goal-card-milestone";
import { GoalCardHabit } from "./goal-card-habit";
import { GoalCardPomodoro } from "./goal-card-pomodoro";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";
import type { Habit } from "@/db/queries/habits";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";

/**
 * Type-dispatching shell. Each card variant is responsible for its own UI;
 * habit/pomo cards display only (read-only), number/milestone are
 * interactive.
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
  if (goal.type === "number") {
    return (
      <GoalCardNumber goal={goal} periodStart={periodStart} periodEnd={periodEnd} today={today} />
    );
  }
  if (goal.type === "milestone") {
    return (
      <GoalCardMilestone goal={goal} periodStart={periodStart} periodEnd={periodEnd} today={today} />
    );
  }
  if (goal.type === "habit") {
    const habit = habits.find((h) => h.id === goal.habitId) ?? null;
    return (
      <GoalCardHabit
        goal={goal}
        habit={habit}
        periodStart={periodStart}
        periodEnd={periodEnd}
        today={today}
      />
    );
  }
  // pomodoro
  const category = categories.find((c) => c.id === goal.pomoCategoryId) ?? null;
  return (
    <GoalCardPomodoro
      goal={goal}
      category={category}
      periodStart={periodStart}
      periodEnd={periodEnd}
      today={today}
    />
  );
}
