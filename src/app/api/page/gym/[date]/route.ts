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

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [library, todayData, latestBW, last7BW, allWorkouts] = await Promise.all([
    getAllSplitsWithExercises(),
    getWorkoutForDate(date),
    getLatestBodyWeightAsOf(date),
    getBodyWeightForRange(addDays(date, -6), date),
    getAllWorkoutsLight(),
  ]);

  const splitExerciseIds = todayData.workout?.splitId
    ? library.joins
        .filter((j) => j.splitId === todayData.workout!.splitId)
        .map((j) => j.exerciseId)
    : [];
  const usedTodayIds = Array.from(new Set(todayData.sets.map((s) => s.exerciseId)));
  const prefillIds = Array.from(new Set([...splitExerciseIds, ...usedTodayIds]));

  // Prefill (single most recent set) + last-session (all sets that day) per ex.
  const [prefill, lastSession] = await Promise.all([
    getLastSetPerExerciseBefore(date, prefillIds),
    getLastSessionSetsPerExercise(date, prefillIds),
  ]);

  // Progression suggestion per exercise.
  const progressionSuggestions: Record<string, ProgressionSuggestion> = {};
  for (const id of prefillIds) {
    const session = lastSession[id];
    progressionSuggestions[id] = session
      ? computeProgressionSuggestion(session.sets)
      : { kind: "none" };
  }

  // Split suggestion (only when no split picked for today).
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
