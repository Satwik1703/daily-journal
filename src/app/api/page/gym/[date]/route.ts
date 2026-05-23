import { NextResponse } from "next/server";
import { isValidDateString } from "@/lib/dates";
import {
  getAllSplitsWithExercises,
  getWorkoutForDate,
  getLastSetPerExerciseBefore,
} from "@/db/queries/gym";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [library, todayData] = await Promise.all([
    getAllSplitsWithExercises(),
    getWorkoutForDate(date),
  ]);

  // Prefill — last set per exercise BEFORE today, scoped to:
  //   1. exercises in current split (if a split is set)
  //   2. exercises already used in today's workout (so off-split adds also prefill)
  const splitExerciseIds = todayData.workout?.splitId
    ? library.joins
        .filter((j) => j.splitId === todayData.workout!.splitId)
        .map((j) => j.exerciseId)
    : [];
  const usedTodayIds = Array.from(new Set(todayData.sets.map((s) => s.exerciseId)));
  const prefillIds = Array.from(new Set([...splitExerciseIds, ...usedTodayIds]));
  const prefill = await getLastSetPerExerciseBefore(date, prefillIds);

  return NextResponse.json({
    date,
    workout: todayData.workout,
    sets: todayData.sets,
    splits: library.splits,
    exercises: library.exercises,
    joins: library.joins,
    prefill,
  });
}
