import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PACE_PILL_LABELS,
  POMO_METRIC_LABELS,
  computeGoalPace,
  type GoalStatus,
  type PomoMetric,
} from "@/lib/goal-meta";
import { fmtMinutes, fmtPomos } from "@/lib/pomodoro-meta";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import { todayLocal, type DateString } from "@/lib/dates";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";

/**
 * Pomodoro-linked goal card. Auto-derives currentValue from
 * pomodoro_sessions in the period, optionally filtered by category. Tap
 * jumps to the pomodoro tab.
 */
export function GoalCardPomodoro({
  goal,
  category,
  periodStart,
  periodEnd,
  today,
}: {
  goal: GoalWithDerived;
  category: PomoCategory | null;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
}) {
  const target = goal.targetValue ?? 0;
  const metric = (goal.pomoMetric ?? "minutes") as PomoMetric;
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

  const currentDisplay = formatMetric(metric, goal.currentValue);
  const targetDisplay = formatMetric(metric, target);

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg" style={{ color: goal.color }}>
              {goal.emoji ?? category?.emoji ?? "🎯"}
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
              style={{ width: `${filled}%`, background: category?.color ?? goal.color }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {currentDisplay} / {targetDisplay} {POMO_METRIC_LABELS[metric].toLowerCase()}
            </span>
            <span>{filled}%</span>
          </div>
        </div>

        <Link
          href={`/pomodoro/${todayLocal()}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LinkIcon className="size-3" />
          {category ? `Linked to Pomodoro · ${category.name}` : "Linked to Pomodoro · all categories"} →
        </Link>
      </CardContent>
    </Card>
  );
}

function formatMetric(metric: PomoMetric, n: number): string {
  if (metric === "minutes") return fmtMinutes(n);
  if (metric === "pomos") return fmtPomos(n);
  return String(Math.round(n));
}

function paceToStatus(pill: ReturnType<typeof computeGoalPace>["pill"]): JournalStatus {
  if (pill === "achieved") return "crazy";
  if (pill === "ahead") return "great";
  if (pill === "on-track") return "good";
  if (pill === "behind") return "avg";
  if (pill === "at-risk" || pill === "missed") return "bad";
  return "empty";
}
