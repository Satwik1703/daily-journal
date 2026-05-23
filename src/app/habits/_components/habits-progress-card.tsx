import { Card, CardContent } from "@/components/ui/card";
import { ProgressDonut } from "@/components/ui/progress-donut";

/**
 * Compact "how done am I today" card with a donut + count. Sibling to
 * TodayToggles. Uses the same primitive as the goals page summary card.
 */
export function HabitsProgressCard({
  completed,
  total,
  isToday,
}: {
  completed: number;
  total: number;
  isToday: boolean;
}) {
  const percent = total === 0 ? 0 : (completed / total) * 100;
  const label = isToday ? "today" : "that day";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <ProgressDonut percent={percent} />
        <div className="min-w-0 flex-1 space-y-1">
          {total === 0 ? (
            <>
              <p className="text-sm font-medium">No habits yet</p>
              <p className="text-xs text-muted-foreground">
                Add one to start tracking.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {completed}/{total} habits done {label}
              </p>
              <p className="text-xs text-muted-foreground">
                {completed === total
                  ? "All done — nice."
                  : `${total - completed} left to tick.`}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
