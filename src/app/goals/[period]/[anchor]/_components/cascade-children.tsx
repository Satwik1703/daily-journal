import Link from "next/link";
import { Check, X } from "lucide-react";
import {
  computeGoalPace,
  type GoalStatus,
} from "@/lib/goal-meta";
import { periodRangeFor, type GoalPeriod, type DateString } from "@/lib/dates";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import type { GoalWithDerived } from "@/db/queries/goals";

/**
 * Renders a parent goal's cascade children inline (collapsed-by-default
 * grid). Each child cell is tappable and navigates to that period.
 */
export function CascadeChildren({
  items,
  today,
}: {
  items: GoalWithDerived[];
  today: DateString;
}) {
  if (items.length === 0) return null;
  // Sort by periodKey (lexicographic — works for ISO formats).
  const sorted = [...items].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  return (
    <div className="mt-2 rounded-md border border-dashed border-input bg-muted/20 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {items.length} cascade children
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {sorted.map((c) => {
          const target =
            c.type === "milestone"
              ? (c.checklist?.length ?? 0) || 1
              : c.targetValue ?? null;
          const { start, end } = periodRangeFor(c.periodKey, c.period as GoalPeriod);
          const pace = computeGoalPace({
            status: c.status as GoalStatus,
            current: c.currentValue,
            target,
            periodStart: start,
            periodEnd: end,
            today,
          });
          const fill = paceToStatus(pace.pill);
          return (
            <Link
              key={c.id}
              href={`/goals/${c.period}/${c.periodKey}`}
              className="flex items-center gap-1 rounded border border-input bg-background px-1.5 py-1 text-[11px] tabular-nums hover:border-foreground/30"
              style={{ background: statusBg(fill) + "22" }}
            >
              <span className="flex-1 truncate">{childLabel(c.period as GoalPeriod, c.periodKey)}</span>
              <span className="text-muted-foreground">
                {formatValue(c.currentValue)}/{target != null ? formatValue(target) : "?"}
              </span>
              {c.status === "achieved" ? (
                <Check className="size-3 text-emerald-500" />
              ) : c.status === "missed" ? (
                <X className="size-3 text-rose-500" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function childLabel(period: GoalPeriod, periodKey: string): string {
  if (period === "month") return periodKey.slice(5);
  if (period === "week") return periodKey.slice(5);
  return periodKey;
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function paceToStatus(pill: ReturnType<typeof computeGoalPace>["pill"]): JournalStatus {
  if (pill === "achieved") return "crazy";
  if (pill === "ahead") return "great";
  if (pill === "on-track") return "good";
  if (pill === "behind") return "avg";
  if (pill === "at-risk" || pill === "missed") return "bad";
  return "empty";
}
