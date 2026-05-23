import { NextResponse } from "next/server";
import { clampGymRange, computeSplitWeekStreak } from "@/lib/gym-meta";
import {
  getGymInsightsWindow,
  getGymWeekCompare,
  getAllWorkoutsLight,
} from "@/db/queries/gym";
import { getBodyWeightForRange } from "@/db/queries/body-weight";
import { addDays, isoWeekKey, todayLocal } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ range: string }> },
) {
  const { range } = await ctx.params;
  const r = clampGymRange(range);
  const today = todayLocal();
  const start = addDays(today, -(r - 1));

  const [window, weekCompare, allWorkouts, bodyWeightSeries] = await Promise.all([
    getGymInsightsWindow(r),
    getGymWeekCompare(),
    getAllWorkoutsLight(),
    getBodyWeightForRange(start, today),
  ]);

  // Split streaks across full workout history.
  const todayWeekKey = isoWeekKey(today);
  const splitStreaks = window.splits
    .filter((s) => !s.archivedAt)
    .map((s) => {
      const { current, longest } = computeSplitWeekStreak(s.id, allWorkouts, todayWeekKey);
      return {
        splitId: s.id,
        splitName: s.name,
        emoji: s.emoji,
        color: s.color,
        current,
        longest,
      };
    })
    .filter((row) => row.longest > 0)
    .sort((a, b) => b.current - a.current || b.longest - a.longest);

  // Body weight delta over window.
  let bodyWeightDelta: { startKg: number; endKg: number; deltaKg: number } | null = null;
  if (bodyWeightSeries.length >= 2) {
    const first = bodyWeightSeries[0];
    const last = bodyWeightSeries[bodyWeightSeries.length - 1];
    bodyWeightDelta = {
      startKg: first.weightKg,
      endKg: last.weightKg,
      deltaKg: Number((last.weightKg - first.weightKg).toFixed(2)),
    };
  }

  return NextResponse.json({
    ...window,
    weekCompare,
    splitStreaks,
    bodyWeightSeries,
    bodyWeightDelta,
  });
}
