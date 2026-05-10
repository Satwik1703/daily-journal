"use server";

import { db } from "@/db/client";
import { workouts, muscleLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { MUSCLE_GROUPS, type Intensity, type MuscleGroup } from "@/lib/muscle-groups";

const VALID_INTENSITIES = new Set<Intensity>(["light", "medium", "heavy"]);

export async function createWorkout(input: {
  date: string;
  notes?: string | null;
  durationMin?: number | null;
  muscles: { muscle: string; intensity: string }[];
}): Promise<{ id: string }> {
  if (!isValidDateString(input.date)) throw new Error(`Invalid date: ${input.date}`);
  if (!Array.isArray(input.muscles) || input.muscles.length === 0) {
    throw new Error("Pick at least one muscle group");
  }

  const validated: { muscle: MuscleGroup; intensity: Intensity }[] = [];
  for (const m of input.muscles) {
    if (!MUSCLE_GROUPS.includes(m.muscle as MuscleGroup)) {
      throw new Error(`Unknown muscle group: ${m.muscle}`);
    }
    if (!VALID_INTENSITIES.has(m.intensity as Intensity)) {
      throw new Error(`Bad intensity: ${m.intensity}`);
    }
    validated.push({ muscle: m.muscle as MuscleGroup, intensity: m.intensity as Intensity });
  }

  const notes = input.notes?.trim() || null;
  const durationMin = typeof input.durationMin === "number" && input.durationMin > 0 ? input.durationMin : null;

  const id = nanoid(12);
  await db.insert(workouts).values({ id, date: input.date, notes, durationMin });
  for (const m of validated) {
    await db.insert(muscleLogs).values({
      id: nanoid(12),
      workoutId: id,
      muscle: m.muscle,
      intensity: m.intensity,
    });
  }
  revalidatePath("/gym");
  return { id };
}

export async function deleteWorkout(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.delete(workouts).where(eq(workouts.id, id));
  revalidatePath("/gym");
}
