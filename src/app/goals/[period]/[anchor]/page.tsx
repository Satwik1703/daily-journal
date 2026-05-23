import { notFound } from "next/navigation";
import { type GoalPeriod } from "@/lib/dates";
import { GOAL_PERIODS } from "@/lib/goal-meta";
import { GoalsPageClient } from "./_components/goals-page-client";

const PERIOD_VALUES = new Set<string>(GOAL_PERIODS);

function isValidPeriodKey(key: string, period: GoalPeriod): boolean {
  if (period === "year") return /^\d{4}$/.test(key);
  if (period === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key);
}

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ period: string; anchor: string }>;
}) {
  const { period: periodRaw, anchor } = await params;
  if (!PERIOD_VALUES.has(periodRaw)) notFound();
  const period = periodRaw as GoalPeriod;
  if (anchor === "current") notFound();
  if (!isValidPeriodKey(anchor, period)) notFound();
  return <GoalsPageClient period={period} anchor={anchor} />;
}
