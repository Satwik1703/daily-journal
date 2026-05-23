import { db } from "@/db/client";
import {
  splits,
  exercises,
  splitExercises,
  workouts,
  workoutSets,
} from "@/db/schema";
import {
  and,
  asc,
  between,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import {
  addDays,
  isoWeekKey,
  periodRangeFor,
  todayLocal,
  type DateString,
} from "@/lib/dates";
import type { MuscleGroup } from "@/lib/muscle-groups";
import {
  est1RM,
  setVolume,
  sortByPosition,
  type Exercise,
  type Split,
  type Workout,
  type WorkoutSet,
  type SplitExercise,
  type GymRange,
} from "@/lib/gym-meta";

// ---------- Row-shape adapters (DB row -> client-safe plain object) ----------

function rowSplit(r: typeof splits.$inferSelect): Split {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    position: r.position,
    archivedAt: r.archivedAt ? r.archivedAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
  };
}

function rowExercise(r: typeof exercises.$inferSelect): Exercise {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    muscleGroups: (r.muscleGroups ?? []) as MuscleGroup[],
    notes: r.notes,
    perHand: r.perHand,
    position: r.position,
    archivedAt: r.archivedAt ? r.archivedAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
  };
}

function rowWorkout(r: typeof workouts.$inferSelect): Workout {
  return {
    id: r.id,
    date: r.date,
    splitId: r.splitId,
    notes: r.notes,
    durationMin: r.durationMin,
    createdAt: r.createdAt.getTime(),
  };
}

function rowSet(r: typeof workoutSets.$inferSelect): WorkoutSet {
  return {
    id: r.id,
    workoutId: r.workoutId,
    exerciseId: r.exerciseId,
    setNumber: r.setNumber,
    reps: r.reps,
    weightKg: r.weightKg,
    rpe: r.rpe,
    isWarmup: r.isWarmup,
    note: r.note,
    createdAt: r.createdAt.getTime(),
  };
}

// ---------- Splits + exercises library ----------

export async function getSplits(includeArchived = false): Promise<Split[]> {
  const rows = await db
    .select()
    .from(splits)
    .where(includeArchived ? sql`1=1` : isNull(splits.archivedAt))
    .orderBy(asc(splits.position));
  return rows.map(rowSplit);
}

export async function getExercises(includeArchived = false): Promise<Exercise[]> {
  const rows = await db
    .select()
    .from(exercises)
    .where(includeArchived ? sql`1=1` : isNull(exercises.archivedAt))
    .orderBy(asc(exercises.position));
  return rows.map(rowExercise);
}

export async function getSplitExercises(): Promise<SplitExercise[]> {
  const rows = await db.select().from(splitExercises).orderBy(asc(splitExercises.position));
  return rows.map((r) => ({
    splitId: r.splitId,
    exerciseId: r.exerciseId,
    position: r.position,
  }));
}

export async function getAllSplitsWithExercises(): Promise<{
  splits: Split[];
  exercises: Exercise[];
  joins: SplitExercise[];
}> {
  const [s, e, j] = await Promise.all([
    getSplits(false),
    getExercises(false),
    getSplitExercises(),
  ]);
  return { splits: s, exercises: e, joins: j };
}

// ---------- Workout for date ----------

export type WorkoutForDate = {
  workout: Workout | null;
  sets: WorkoutSet[];
};

export async function getWorkoutForDate(date: DateString): Promise<WorkoutForDate> {
  const wRows = await db
    .select()
    .from(workouts)
    .where(eq(workouts.date, date))
    .orderBy(desc(workouts.createdAt))
    .limit(1);
  if (wRows.length === 0) return { workout: null, sets: [] };
  const workout = rowWorkout(wRows[0]);
  const setRows = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.workoutId, workout.id))
    .orderBy(asc(workoutSets.createdAt));
  return { workout, sets: setRows.map(rowSet) };
}

// ---------- Smart prefill (last set per exercise before a date) ----------

export async function getLastSetPerExerciseBefore(
  beforeDate: DateString,
  exerciseIds: string[],
): Promise<Record<string, { reps: number | null; weightKg: number | null }>> {
  if (exerciseIds.length === 0) return {};
  const wRows = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(sql`${workouts.date} < ${beforeDate}`)
    .orderBy(desc(workouts.date), desc(workouts.createdAt));
  if (wRows.length === 0) return {};
  const wIdToDate = new Map(wRows.map((r) => [r.id, r.date]));
  const wIds = wRows.map((r) => r.id);
  const setRows = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        inArray(workoutSets.exerciseId, exerciseIds),
        inArray(workoutSets.workoutId, wIds),
      ),
    );
  const best: Record<string, { date: string; createdAt: Date; reps: number | null; weightKg: number | null }> = {};
  for (const s of setRows) {
    const d = wIdToDate.get(s.workoutId);
    if (!d) continue;
    const cur = best[s.exerciseId];
    if (!cur || d > cur.date || (d === cur.date && s.createdAt > cur.createdAt)) {
      best[s.exerciseId] = { date: d, createdAt: s.createdAt, reps: s.reps, weightKg: s.weightKg };
    }
  }
  const out: Record<string, { reps: number | null; weightKg: number | null }> = {};
  for (const [k, v] of Object.entries(best)) {
    out[k] = { reps: v.reps, weightKg: v.weightKg };
  }
  return out;
}

// ---------- Last session per exercise (for progression suggestion) ----------

/**
 * Per exercise: the most recent workout where the exercise had sets, and all
 * the sets from that single workout. Empty entry if never logged.
 */
export async function getLastSessionSetsPerExercise(
  beforeDate: DateString,
  exerciseIds: string[],
): Promise<
  Record<string, { date: DateString; sets: Pick<WorkoutSet, "reps" | "weightKg">[] }>
> {
  if (exerciseIds.length === 0) return {};
  const wRows = await db
    .select({ id: workouts.id, date: workouts.date })
    .from(workouts)
    .where(sql`${workouts.date} < ${beforeDate}`)
    .orderBy(desc(workouts.date), desc(workouts.createdAt));
  if (wRows.length === 0) return {};

  const wIdToDate = new Map(wRows.map((r) => [r.id, r.date]));
  const setRows = await db
    .select({
      workoutId: workoutSets.workoutId,
      exerciseId: workoutSets.exerciseId,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .where(
      and(
        inArray(workoutSets.exerciseId, exerciseIds),
        inArray(workoutSets.workoutId, wRows.map((r) => r.id)),
      ),
    );

  // For each exercise pick the most recent date that had sets, take all sets
  // from that date (could be multiple workouts on same date — combine).
  const byExercise = new Map<
    string,
    { date: DateString; sets: { reps: number | null; weightKg: number | null }[] }
  >();
  // Group: exerciseId -> date -> sets[]
  const buckets = new Map<string, Map<DateString, { reps: number | null; weightKg: number | null }[]>>();
  for (const s of setRows) {
    const d = wIdToDate.get(s.workoutId);
    if (!d) continue;
    let perEx = buckets.get(s.exerciseId);
    if (!perEx) {
      perEx = new Map();
      buckets.set(s.exerciseId, perEx);
    }
    let arr = perEx.get(d);
    if (!arr) {
      arr = [];
      perEx.set(d, arr);
    }
    arr.push({ reps: s.reps, weightKg: s.weightKg });
  }
  for (const [exerciseId, perEx] of buckets) {
    const dates = Array.from(perEx.keys()).sort();
    const latest = dates.at(-1)!;
    byExercise.set(exerciseId, { date: latest, sets: perEx.get(latest)! });
  }

  const out: Record<string, { date: DateString; sets: Pick<WorkoutSet, "reps" | "weightKg">[] }> = {};
  for (const [k, v] of byExercise) out[k] = v;
  return out;
}

// ---------- All workouts for streak / suggestion (lightweight) ----------

export async function getAllWorkoutsLight(): Promise<
  { date: DateString; splitId: string | null }[]
> {
  return db
    .select({ date: workouts.date, splitId: workouts.splitId })
    .from(workouts)
    .orderBy(asc(workouts.date));
}

// ---------- Compare this week vs last ----------

export type WeekAgg = {
  weekKey: string;
  start: DateString;
  end: DateString;
  workoutCount: number;
  totalVolume: number;
  totalSets: number;
  topExercises: { exerciseId: string; name: string; topWeightKg: number; topReps: number }[];
  setsPerMuscle: Record<MuscleGroup, number>;
};

async function aggregateWeek(
  weekKey: string,
  exercisesById: Map<string, Exercise>,
): Promise<WeekAgg> {
  const { start, end } = periodRangeFor(weekKey, "week");
  const wRows = await db
    .select()
    .from(workouts)
    .where(between(workouts.date, start, end));
  const workoutCount = wRows.length;
  let totalVolume = 0;
  let totalSets = 0;
  const setsPerMuscle: Partial<Record<MuscleGroup, number>> = {};
  const exTop = new Map<string, { topWeightKg: number; topReps: number }>();

  if (wRows.length > 0) {
    const setRows = await db
      .select()
      .from(workoutSets)
      .where(inArray(workoutSets.workoutId, wRows.map((r) => r.id)));
    for (const s of setRows.map(rowSet)) {
      totalSets += 1;
      totalVolume += setVolume(s);
      const ex = exercisesById.get(s.exerciseId);
      if (ex) {
        for (const m of ex.muscleGroups) {
          setsPerMuscle[m] = (setsPerMuscle[m] ?? 0) + 1;
        }
      }
      if ((s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0) {
        const cur = exTop.get(s.exerciseId);
        if (!cur || (s.weightKg ?? 0) > cur.topWeightKg) {
          exTop.set(s.exerciseId, { topWeightKg: s.weightKg!, topReps: s.reps! });
        }
      }
    }
  }

  const topExercises = Array.from(exTop.entries())
    .map(([exerciseId, v]) => ({
      exerciseId,
      name: exercisesById.get(exerciseId)?.name ?? "—",
      topWeightKg: v.topWeightKg,
      topReps: v.topReps,
    }))
    .sort((a, b) => b.topWeightKg - a.topWeightKg)
    .slice(0, 5);

  return {
    weekKey,
    start,
    end,
    workoutCount,
    totalVolume,
    totalSets,
    topExercises,
    setsPerMuscle: setsPerMuscle as Record<MuscleGroup, number>,
  };
}

export async function getGymWeekCompare(): Promise<{ thisWeek: WeekAgg; lastWeek: WeekAgg }> {
  const today = todayLocal();
  const thisKey = isoWeekKey(today);
  // Step back one week: use periodRangeFor previous week.
  const thisStart = periodRangeFor(thisKey, "week").start;
  const lastWeekDate = addDays(thisStart, -3); // any date inside last week
  const lastKey = isoWeekKey(lastWeekDate);

  const exRows = await db.select().from(exercises);
  const exById = new Map(exRows.map((r) => [r.id, rowExercise(r)]));

  const [thisWeek, lastWeek] = await Promise.all([
    aggregateWeek(thisKey, exById),
    aggregateWeek(lastKey, exById),
  ]);
  return { thisWeek, lastWeek };
}

// ---------- Split week streaks (computed against ALL workouts) ----------

export type SplitStreakEntry = {
  splitId: string;
  splitName: string;
  emoji: string | null;
  color: string;
  current: number;
  longest: number;
};

// ---------- Month status for date stepper ----------

export type GymDayStat = {
  hadWorkout: boolean;
  splitId: string | null;
  volume: number;
  setCount: number;
};

/**
 * Per-date stats for the window. Volume = SUM(reps × weight) across all sets
 * logged on that date. setCount = total number of sets logged.
 */
export async function getGymMonthStatus(
  start: DateString,
  end: DateString,
): Promise<Record<string, GymDayStat>> {
  const wRows = await db
    .select({ id: workouts.id, date: workouts.date, splitId: workouts.splitId })
    .from(workouts)
    .where(between(workouts.date, start, end));
  if (wRows.length === 0) return {};

  const wIdToDate = new Map(wRows.map((r) => [r.id, r.date]));
  const out: Record<string, GymDayStat> = {};
  for (const r of wRows) {
    out[r.date] = { hadWorkout: true, splitId: r.splitId, volume: 0, setCount: 0 };
  }

  const setRows = await db
    .select({
      workoutId: workoutSets.workoutId,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .where(inArray(workoutSets.workoutId, wRows.map((r) => r.id)));
  for (const s of setRows) {
    const d = wIdToDate.get(s.workoutId);
    if (!d) continue;
    const v = (s.reps ?? 1) * (s.weightKg ?? 0);
    out[d].volume += v;
    out[d].setCount += 1;
  }
  return out;
}

/**
 * Max single-day volume in trailing window. Used as the calendar's
 * normalization reference so coloring stays stable.
 */
export async function getMaxDailyVolumeInRange(
  start: DateString,
  end: DateString,
): Promise<number> {
  const stats = await getGymMonthStatus(start, end);
  let m = 0;
  for (const v of Object.values(stats)) {
    if (v.volume > m) m = v.volume;
  }
  return m;
}

// ---------- Insights window ----------

export type GymInsightsWindow = {
  range: GymRange;
  start: DateString;
  end: DateString;
  workoutsInRange: Workout[];
  setsInRange: WorkoutSet[];
  splits: Split[];
  exercises: Exercise[];
  volumePerMuscle: Record<MuscleGroup, number>;
  setsPerMuscle: Record<MuscleGroup, number>;
  workoutsPerDay: Record<string, number>;
  splitFrequency: Record<string, number>;
  topExercises: { exerciseId: string; name: string; volume: number; sets: number }[];
  personalRecords: {
    exerciseId: string;
    exerciseName: string;
    weightKg: number;
    reps: number;
    est1RM: number;
    date: string;
    kind: "weight" | "1rm";
  }[];
  hoursSinceLastHitByMuscle: Partial<Record<MuscleGroup, number | null>>;
};

export async function getGymInsightsWindow(range: GymRange): Promise<GymInsightsWindow> {
  const end = todayLocal();
  const start = addDays(end, -(range - 1));

  const [wRows, sRows, exRows, joinRows] = await Promise.all([
    db.select().from(workouts).where(between(workouts.date, start, end)).orderBy(asc(workouts.date)),
    db.select().from(splits).where(isNull(splits.archivedAt)).orderBy(asc(splits.position)),
    db.select().from(exercises).where(isNull(exercises.archivedAt)).orderBy(asc(exercises.position)),
    Promise.resolve([] as SplitExercise[]),
  ]);

  void joinRows;
  const workoutsInRange = wRows.map(rowWorkout);
  const splitsList = sRows.map(rowSplit);
  const exercisesList = exRows.map(rowExercise);

  let setsInRange: WorkoutSet[] = [];
  if (workoutsInRange.length > 0) {
    const setRows = await db
      .select()
      .from(workoutSets)
      .where(inArray(workoutSets.workoutId, workoutsInRange.map((w) => w.id)));
    setsInRange = setRows.map(rowSet);
  }

  // Per-muscle aggregations
  const exById = new Map(exercisesList.map((e) => [e.id, e]));
  const volumePerMuscle: Partial<Record<MuscleGroup, number>> = {};
  const setsPerMuscle: Partial<Record<MuscleGroup, number>> = {};
  for (const s of setsInRange) {
    const ex = exById.get(s.exerciseId);
    if (!ex) continue;
    const v = setVolume(s);
    for (const m of ex.muscleGroups) {
      volumePerMuscle[m] = (volumePerMuscle[m] ?? 0) + v;
      setsPerMuscle[m] = (setsPerMuscle[m] ?? 0) + 1;
    }
  }

  // Workouts per day
  const workoutsPerDay: Record<string, number> = {};
  for (const w of workoutsInRange) {
    workoutsPerDay[w.date] = (workoutsPerDay[w.date] ?? 0) + 1;
  }

  // Split frequency
  const splitFrequency: Record<string, number> = {};
  for (const w of workoutsInRange) {
    const key = w.splitId ?? "__free__";
    splitFrequency[key] = (splitFrequency[key] ?? 0) + 1;
  }

  // Top exercises by volume
  const exVolume = new Map<string, { volume: number; sets: number; name: string }>();
  for (const s of setsInRange) {
    const ex = exById.get(s.exerciseId);
    if (!ex) continue;
    const cur = exVolume.get(s.exerciseId) ?? { volume: 0, sets: 0, name: ex.name };
    cur.volume += setVolume(s);
    cur.sets += 1;
    exVolume.set(s.exerciseId, cur);
  }
  const topExercises = Array.from(exVolume.entries())
    .map(([exerciseId, v]) => ({ exerciseId, ...v }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  // Personal records (all-time, but only flag PRs achieved within window).
  // For each exercise touched in window, compute max weight + max 1RM across all history,
  // then find sets within window that match either max.
  const exerciseIdsInWindow = Array.from(new Set(setsInRange.map((s) => s.exerciseId)));
  const personalRecords: GymInsightsWindow["personalRecords"] = [];
  if (exerciseIdsInWindow.length > 0) {
    const allSetsRows = await db
      .select()
      .from(workoutSets)
      .where(inArray(workoutSets.exerciseId, exerciseIdsInWindow));
    const wDateById = new Map(
      (
        await db
          .select({ id: workouts.id, date: workouts.date })
          .from(workouts)
          .where(
            inArray(
              workouts.id,
              Array.from(new Set(allSetsRows.map((s) => s.workoutId))),
            ),
          )
      ).map((r) => [r.id, r.date]),
    );
    const allSets = allSetsRows.map(rowSet);
    const byEx = new Map<string, WorkoutSet[]>();
    for (const s of allSets) {
      const arr = byEx.get(s.exerciseId) ?? [];
      arr.push(s);
      byEx.set(s.exerciseId, arr);
    }
    for (const [exerciseId, all] of byEx) {
      const ex = exById.get(exerciseId);
      if (!ex) continue;
      const valid = all.filter((s) => (s.reps ?? 0) >= 1 && (s.weightKg ?? 0) > 0);
      if (valid.length === 0) continue;
      const maxWeight = Math.max(...valid.map((s) => s.weightKg!));
      const max1rm = Math.max(...valid.map((s) => est1RM(s.weightKg, s.reps)));
      for (const s of valid) {
        const d = wDateById.get(s.workoutId);
        if (!d || d < start || d > end) continue;
        const isWeight = s.weightKg === maxWeight;
        const is1rm = Math.abs(est1RM(s.weightKg, s.reps) - max1rm) < 0.01;
        if (isWeight) {
          personalRecords.push({
            exerciseId,
            exerciseName: ex.name,
            weightKg: s.weightKg!,
            reps: s.reps!,
            est1RM: est1RM(s.weightKg, s.reps),
            date: d,
            kind: "weight",
          });
        } else if (is1rm) {
          personalRecords.push({
            exerciseId,
            exerciseName: ex.name,
            weightKg: s.weightKg!,
            reps: s.reps!,
            est1RM: est1RM(s.weightKg, s.reps),
            date: d,
            kind: "1rm",
          });
        }
      }
    }
    personalRecords.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  // Hours since last hit per muscle (for recovery mode) — searches LAST 14 days only.
  const recoveryStart = addDays(end, -13);
  const recentWRows = await db
    .select()
    .from(workouts)
    .where(gte(workouts.date, recoveryStart))
    .orderBy(desc(workouts.date), desc(workouts.createdAt));
  const recentWorkouts = recentWRows.map(rowWorkout);
  const hoursSinceLastHitByMuscle: Partial<Record<MuscleGroup, number | null>> = {};
  if (recentWorkouts.length > 0) {
    const recentSetRows = await db
      .select()
      .from(workoutSets)
      .where(inArray(workoutSets.workoutId, recentWorkouts.map((w) => w.id)));
    const wMostRecentTs = new Map<string, number>();
    for (const w of recentWorkouts) {
      wMostRecentTs.set(w.id, w.createdAt);
    }
    const lastHitMs: Partial<Record<MuscleGroup, number>> = {};
    for (const s of recentSetRows.map(rowSet)) {
      const wTs = wMostRecentTs.get(s.workoutId);
      if (wTs == null) continue;
      const ex = exById.get(s.exerciseId);
      if (!ex) continue;
      const hitTs = Math.max(wTs, s.createdAt);
      for (const m of ex.muscleGroups) {
        if ((lastHitMs[m] ?? 0) < hitTs) lastHitMs[m] = hitTs;
      }
    }
    const now = Date.now();
    for (const m of Object.keys(lastHitMs) as MuscleGroup[]) {
      hoursSinceLastHitByMuscle[m] = (now - (lastHitMs[m] ?? 0)) / 3_600_000;
    }
  }

  return {
    range,
    start,
    end,
    workoutsInRange,
    setsInRange,
    splits: sortByPosition(splitsList),
    exercises: sortByPosition(exercisesList),
    volumePerMuscle: volumePerMuscle as Record<MuscleGroup, number>,
    setsPerMuscle: setsPerMuscle as Record<MuscleGroup, number>,
    workoutsPerDay,
    splitFrequency,
    topExercises,
    personalRecords,
    hoursSinceLastHitByMuscle,
  };
}
