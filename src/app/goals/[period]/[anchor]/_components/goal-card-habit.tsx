import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PACE_PILL_LABELS,
  computeGoalPace,
  type GoalStatus,
} from "@/lib/goal-meta";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import { todayLocal, type DateString } from "@/lib/dates";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { Habit } from "@/db/queries/habits";

/**
 * Habit-linked goal card. Read-only display — count is derived live from
 * habit_logs in the period. Tap "View habit →" jumps to the habits tab so the
 * user can check off today's log there.
 */
export function GoalCardHabit({
  goal,
  habit,
  periodStart,
  periodEnd,
  today,
}: {
  goal: GoalWithDerived;
  habit: Habit | null;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
}) {
  const target = goal.targetValue ?? 0;
  const pace = computeGoalPace({
    status: goal.status as GoalStatus,
    current: goal.currentValue,
    target,
    periodStart,
    periodEnd,
    today,
  });
  const filled = Math.min(100, Math.round(pace.progress * 100));
  const pillStatus = paceToStatus(pace.pill);

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg" style={{ color: goal.color }}>
              {goal.emoji ?? habit?.emoji ?? "🎯"}
            </span>
            <span className="font-medium">{goal.title}</span>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 border-transparent text-[10px] uppercase tracking-wide"
            style={{ background: statusBg(pillStatus), color: "var(--background)" }}
          >
            {PACE_PILL_LABELS[pace.pill]}
          </Badge>
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${filled}%`, background: habit?.color ?? goal.color }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {Math.round(goal.currentValue)} / {target}
              {goal.unit ? ` ${goal.unit}` : " days"}
            </span>
            <span>{filled}%</span>
          </div>
        </div>

        {habit ? (
          <Link
            href={`/habits/${todayLocal()}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LinkIcon className="size-3" />
            Linked to habit: {habit.name} →
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <LinkIcon className="size-3" />
            Linked habit was removed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function paceToStatus(pill: ReturnType<typeof computeGoalPace>["pill"]): JournalStatus {
  if (pill === "achieved") return "crazy";
  if (pill === "ahead") return "great";
  if (pill === "on-track") return "good";
  if (pill === "behind") return "avg";
  if (pill === "at-risk" || pill === "missed") return "bad";
  return "empty";
}
