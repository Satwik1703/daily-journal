import { Card, CardContent } from "@/components/ui/card";
import { LinkIcon } from "lucide-react";
import { GoalCardNumber } from "./goal-card-number";
import { GoalCardMilestone } from "./goal-card-milestone";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";

/**
 * Type-dispatching shell. Number / milestone get their own interactive
 * client components; habit / pomodoro are placeholders in Day B.
 */
export function GoalCard({
  goal,
  periodStart,
  periodEnd,
  today,
}: {
  goal: GoalWithDerived;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
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
  // habit / pomodoro — placeholder for Day C
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center gap-2">
          <span style={{ color: goal.color }}>{goal.emoji ?? "🎯"}</span>
          <span className="text-sm font-medium">{goal.title}</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LinkIcon className="size-3" />
          {goal.type === "habit" ? "Habit-linked goal" : "Pomodoro-linked goal"} — lands in the next slice.
        </p>
      </CardContent>
    </Card>
  );
}
