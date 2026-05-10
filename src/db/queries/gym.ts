import { db } from "@/db/client";
import { workouts, muscleLogs } from "@/db/schema";
import { and, between, desc, eq } from "drizzle-orm";
import { addDays, todayLocal, type DateString } from "@/lib/dates";
import { INTENSITY_WEIGHT, type Intensity, type MuscleGroup } from "@/lib/muscle-groups";

export type Workout = typeof workouts.$inferSelect;
export type MuscleLog = typeof muscleLogs.$inferSelect;

export type WorkoutWithMuscles = Workout & { muscles: MuscleLog[] };

export async function getRecentWorkouts(limit = 10): Promise<WorkoutWithMuscles[]> {
  const ws = await db.select().from(workouts).orderBy(desc(workouts.date), desc(workouts.createdAt)).limit(limit);
  if (ws.length === 0) return [];
  // Single query for all muscle logs of these workouts.
  const ids = ws.map((w) => w.id);
  const ml: MuscleLog[] = [];
  for (const id of ids) {
    const rows = await db.select().from(muscleLogs).where(eq(muscleLogs.workoutId, id));
    ml.push(...rows);
  }
  const byWorkout = new Map<string, MuscleLog[]>();
  for (const m of ml) {
    let arr = byWorkout.get(m.workoutId);
    if (!arr) { arr = []; byWorkout.set(m.workoutId, arr); }
    arr.push(m);
  }
  return ws.map((w) => ({ ...w, muscles: byWorkout.get(w.id) ?? [] }));
}

export async function getMuscleIntensitiesInRange(
  start: DateString,
  end: DateString,
): Promise<Record<MuscleGroup, number>> {
  // Get all workouts in window then their muscle logs.
  const ws = await db.select({ id: workouts.id }).from(workouts).where(between(workouts.date, start, end));
  const accum: Partial<Record<MuscleGroup, number>> = {};
  if (ws.length === 0) return accum as Record<MuscleGroup, number>;
  for (const w of ws) {
    const rows = await db.select().from(muscleLogs).where(eq(muscleLogs.workoutId, w.id));
    for (const r of rows) {
      const m = r.muscle as MuscleGroup;
      const w = INTENSITY_WEIGHT[r.intensity as Intensity] ?? 0;
      accum[m] = (accum[m] ?? 0) + w;
    }
  }
  return accum as Record<MuscleGroup, number>;
}

export type GymRange = "week" | "month";

export async function getGymWindow(range: GymRange) {
  const end = todayLocal();
  const days = range === "week" ? 7 : 30;
  const start = addDays(end, -(days - 1));
  const accum = await getMuscleIntensitiesInRange(start, end);
  const recent = await getRecentWorkouts(8);
  return { range, start, end, days, accum, recent };
}

export async function workoutForDate(date: DateString): Promise<WorkoutWithMuscles[]> {
  const ws = await db.select().from(workouts).where(eq(workouts.date, date));
  const out: WorkoutWithMuscles[] = [];
  for (const w of ws) {
    const m = await db.select().from(muscleLogs).where(eq(muscleLogs.workoutId, w.id));
    out.push({ ...w, muscles: m });
  }
  return out;
}
