import { NextResponse } from "next/server";
import { addDays, isValidDateString } from "@/lib/dates";
import {
  getAllSplitsWithExercises,
  getWorkoutForDate,
  getLastSetPerExerciseBefore,
  getLastSessionSetsPerExercise,
  getAllWorkoutsLight,
} from "@/db/queries/gym";
import {
  getLatestBodyWeightAsOf,
  getBodyWeightForRange,
} from "@/db/queries/body-weight";
import {
  computeProgressionSuggestion,
  suggestNextSplit,
  type ProgressionSuggestion,
} from "@/lib/gym-meta";
import { getCurrentUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [library, todayData, latestBW, last7BW, allWorkouts] = await Promise.all([
    getAllSplitsWithExercises(userId),
    getWorkoutForDate(userId, date),
    getLatestBodyWeightAsOf(userId, date),
    getBodyWeightForRange(userId, addDays(date, -6), date),
    getAllWorkoutsLight(userId),
  ]);

  const splitExerciseIds = todayData.workout?.splitId
    ? library.joins
        .filter((j) => j.splitId === todayData.workout!.splitId)
        .map((j) => j.exerciseId)
    : [];
  const usedTodayIds = Array.from(new Set(todayData.sets.map((s) => s.exerciseId)));
  const prefillIds = Array.from(new Set([...splitExerciseIds, ...usedTodayIds]));

  const [prefill, lastSession] = await Promise.all([
    getLastSetPerExerciseBefore(userId, date, prefillIds),
    getLastSessionSetsPerExercise(userId, date, prefillIds),
  ]);

  const progressionSuggestions: Record<string, ProgressionSuggestion> = {};
  for (const id of prefillIds) {
    const lastSess = lastSession[id];
    progressionSuggestions[id] = lastSess
      ? computeProgressionSuggestion(lastSess.sets)
      : { kind: "none" };
  }

  let splitSuggestion: { splitId: string; splitName: string; daysSince: number } | null = null;
  if (!todayData.workout || todayData.workout.splitId == null) {
    const recent = allWorkouts.filter(
      (w) => w.date >= addDays(date, -89) && w.date <= date,
    );
    const s = suggestNextSplit(library.splits, recent, date, 3);
    if (s) {
      const split = library.splits.find((sp) => sp.id === s.splitId);
      if (split) splitSuggestion = { ...s, splitName: split.name };
    }
  }

  return NextResponse.json({
    date,
    workout: todayData.workout,
    sets: todayData.sets,
    splits: library.splits,
    exercises: library.exercises,
    joins: library.joins,
    prefill,
    progressionSuggestions,
    splitSuggestion,
    bodyWeight: {
      latest: latestBW,
      last7: last7BW,
    },
  });
}
