import { NextResponse } from "next/server";
import { periodRangeFor, type GoalPeriod } from "@/lib/dates";
import { GOAL_PERIODS } from "@/lib/goal-meta";
import {
  getArchivedGoalsForPeriod,
  getChildrenOfGoal,
  getGoalsForPeriod,
  getGoalsHistory,
  getGoalsYearHeatmap,
} from "@/db/queries/goals";
import { getActiveHabits } from "@/db/queries/habits";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { getCurrentUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

const PERIOD_VALUES = new Set<string>(GOAL_PERIODS);

function isValidPeriodKey(key: string, period: GoalPeriod): boolean {
  if (period === "year") return /^\d{4}$/.test(key);
  if (period === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ period: string; anchor: string }> },
) {
  const { period: periodRaw, anchor } = await ctx.params;
  if (!PERIOD_VALUES.has(periodRaw)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const period = periodRaw as GoalPeriod;
  if (!isValidPeriodKey(anchor, period)) {
    return NextResponse.json({ error: "Invalid anchor" }, { status: 400 });
  }
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { start, end } = periodRangeFor(anchor, period);

  const [goalsForPeriod, habitOptions, pomoCategories, history, archivedGoals] = await Promise.all([
    getGoalsForPeriod(userId, period, anchor),
    getActiveHabits(userId),
    getActiveCategories(userId),
    getGoalsHistory(userId, period, anchor, 5),
    getArchivedGoalsForPeriod(userId, period, anchor),
  ]);

  const yearHeatmap =
    period === "year" ? await getGoalsYearHeatmap(userId, Number(anchor)) : null;

  const childrenByParent: Record<string, unknown> =
    period !== "week"
      ? Object.fromEntries(
          await Promise.all(
            goalsForPeriod.map(async (g) => [g.id, await getChildrenOfGoal(userId, g.id)] as const),
          ),
        )
      : {};

  return NextResponse.json({
    period,
    anchor,
    start,
    end,
    goalsForPeriod,
    habitOptions,
    pomoCategories,
    history,
    archivedGoals,
    yearHeatmap,
    childrenByParent,
  });
}
