import { Card, CardContent } from "@/components/ui/card";
import { PERIOD_LABELS } from "@/lib/goal-meta";
import type { GoalPeriod } from "@/lib/dates";

export function GoalsEmptyState({
  period,
  isPast,
  isFuture,
}: {
  period: GoalPeriod;
  isPast: boolean;
  isFuture: boolean;
}) {
  let title = `No goals for this ${PERIOD_LABELS[period].toLowerCase()}`;
  let body = "Tap “Add goal” to start tracking something this week.";
  if (isPast) {
    title = "No goals existed for this period";
    body = "You can still browse, but adding new goals to closed periods is locked.";
  } else if (isFuture) {
    title = "Plan ahead";
    body = "Add the first goal for this upcoming period.";
  } else if (period !== "week") {
    body = `Tap “Add goal” to start tracking something this ${PERIOD_LABELS[
      period
    ].toLowerCase()}.`;
  }
  return (
    <Card>
      <CardContent className="space-y-1 py-8 text-center">
        <div className="text-base font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
