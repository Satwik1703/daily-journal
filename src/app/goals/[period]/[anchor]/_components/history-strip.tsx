import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PERIOD_LABELS,
  PERIOD_PLURAL,
  computeGoalPace,
  computeGoalStatus,
  type GoalStatus,
} from "@/lib/goal-meta";
import { periodRangeFor, type GoalPeriod } from "@/lib/dates";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import type { GoalWithDerived } from "@/db/queries/goals";

export function HistoryStrip({
  period,
  history,
  today,
}: {
  period: GoalPeriod;
  /** Array of past periods, most-recent-first. */
  history: Array<{ periodKey: string; goals: GoalWithDerived[] }>;
  today: string;
}) {
  if (history.length === 0 || history.every((h) => h.goals.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Previous {PERIOD_PLURAL[period].toLowerCase()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {history.map((h) => {
            const status = aggregateStatus(h.goals, h.periodKey, period, today);
            const summary = aggregateSummary(h.goals);
            return (
              <Link
                key={h.periodKey}
                href={`/goals/${period}/${h.periodKey}`}
                className="group flex flex-col items-center gap-1 rounded-md border border-input p-2 text-center transition-colors hover:border-foreground/40"
                style={{ background: statusBg(status) + "33" /* 20% */ }}
              >
                <div className="text-[10px] font-medium tabular-nums">
                  {labelFor(h.periodKey, period)}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {summary}
                </div>
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ background: statusBg(status) }}
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function labelFor(periodKey: string, period: GoalPeriod): string {
  if (period === "year") return periodKey;
  if (period === "month") return periodKey.slice(5);
  // week: "W21"
  return periodKey.slice(5);
}

function aggregateStatus(
  goals: GoalWithDerived[],
  periodKey: string,
  period: GoalPeriod,
  today: string,
): JournalStatus {
  if (goals.length === 0) return "empty";
  const { start, end } = periodRangeFor(periodKey, period);
  let achieved = 0;
  for (const g of goals) {
    const target =
      g.type === "milestone" ? (g.checklist?.length ?? 0) || 1 : g.targetValue ?? null;
    const s = computeGoalStatus({
      status: g.status as GoalStatus,
      current: g.currentValue,
      target,
      periodStart: start,
      periodEnd: end,
      today,
    });
    void s;
    const pace = computeGoalPace({
      status: g.status as GoalStatus,
      current: g.currentValue,
      target,
      periodStart: start,
      periodEnd: end,
      today,
    });
    if (pace.pill === "achieved") achieved++;
  }
  const ratio = achieved / goals.length;
  if (ratio >= 1) return "crazy";
  if (ratio >= 0.66) return "great";
  if (ratio >= 0.33) return "good";
  if (ratio > 0) return "avg";
  return "bad";
}

function aggregateSummary(goals: GoalWithDerived[]): string {
  if (goals.length === 0) return "—";
  const achieved = goals.filter((g) => g.status === "achieved").length;
  return `${achieved}/${goals.length}`;
}

void PERIOD_LABELS;
