"use server";

import { addDays, monthKeyOf, shiftMonth } from "@/lib/dates";
import { getGymMonthStatus } from "@/db/queries/gym";
import { db } from "@/db/client";
import {
  splits,
  exercises,
  splitExercises,
  workouts,
  workoutSets,
} from "@/db/schema";
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/muscle-groups";
import { est1RM, isAllMuscleGroups } from "@/lib/gym-meta";

// ---------- Splits CRUD ----------

export async function createSplit(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  color?: string;
}): Promise<{ id: string }> {
  const name = input.name?.trim();
  if (!name) throw new Error("Split name required");
  const id = input.id ?? nanoid(12);
  const color = input.color ?? "#10b981";
  const maxRow = await db.select({ p: max(splits.position) }).from(splits);
  const position = (maxRow[0]?.p ?? -1) + 1;
  await db.insert(splits).values({
    id,
    name,
    emoji: input.emoji?.trim() || null,
    color,
    position,
  });
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
  return { id };
}

export async function updateSplit(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof splits.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("Split name required");
    patch.name = n;
  }
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) patch.color = input.color;
  if (Object.keys(patch).length > 0) {
    await db.update(splits).set(patch).where(eq(splits.id, input.id));
  }
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function archiveSplit(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.update(splits).set({ archivedAt: new Date() }).where(eq(splits.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function unarchiveSplit(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.update(splits).set({ archivedAt: null }).where(eq(splits.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function deleteSplit(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.delete(splits).where(eq(splits.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function reorderSplits(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(splits).set({ position: i }).where(eq(splits.id, orderedIds[i]));
    }
  });
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

// ---------- Exercises CRUD ----------

export async function createExercise(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  color?: string;
  muscleGroups: string[];
  notes?: string | null;
  perHand?: boolean;
}): Promise<{ id: string }> {
  const name = input.name?.trim();
  if (!name) throw new Error("Exercise name required");
  if (!Array.isArray(input.muscleGroups) || input.muscleGroups.length === 0) {
    throw new Error("Pick at least one muscle group");
  }
  for (const m of input.muscleGroups) {
    if (!(MUSCLE_GROUPS as readonly string[]).includes(m)) {
      throw new Error(`Unknown muscle group: ${m}`);
    }
  }
  const id = input.id ?? nanoid(12);
  const color = input.color ?? "#10b981";
  const maxRow = await db.select({ p: max(exercises.position) }).from(exercises);
  const position = (maxRow[0]?.p ?? -1) + 1;
  await db.insert(exercises).values({
    id,
    name,
    emoji: input.emoji?.trim() || null,
    color,
    muscleGroups: input.muscleGroups as MuscleGroup[],
    notes: input.notes?.trim() || null,
    perHand: input.perHand ?? false,
    position,
  });
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
  return { id };
}

export async function updateExercise(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
  muscleGroups?: string[];
  notes?: string | null;
  perHand?: boolean;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof exercises.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("Exercise name required");
    patch.name = n;
  }
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) patch.color = input.color;
  if (input.muscleGroups !== undefined) {
    if (!isAllMuscleGroups(input.muscleGroups) || input.muscleGroups.length === 0) {
      throw new Error("Pick at least one valid muscle group");
    }
    patch.muscleGroups = input.muscleGroups;
  }
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.perHand !== undefined) patch.perHand = input.perHand;
  if (Object.keys(patch).length > 0) {
    await db.update(exercises).set(patch).where(eq(exercises.id, input.id));
  }
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function archiveExercise(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.update(exercises).set({ archivedAt: new Date() }).where(eq(exercises.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function unarchiveExercise(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.update(exercises).set({ archivedAt: null }).where(eq(exercises.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function deleteExercise(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  // Will fail if used in any workout_sets (RESTRICT). Archive instead.
  await db.delete(exercises).where(eq(exercises.id, id));
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function reorderExercises(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(exercises).set({ position: i }).where(eq(exercises.id, orderedIds[i]));
    }
  });
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

// ---------- Split <-> exercise joins ----------

export async function assignExerciseToSplit(input: {
  splitId: string;
  exerciseId: string;
}): Promise<void> {
  const { splitId, exerciseId } = input;
  if (!splitId || !exerciseId) throw new Error("splitId + exerciseId required");
  const maxRow = await db
    .select({ p: max(splitExercises.position) })
    .from(splitExercises)
    .where(eq(splitExercises.splitId, splitId));
  const position = (maxRow[0]?.p ?? -1) + 1;
  await db
    .insert(splitExercises)
    .values({ splitId, exerciseId, position })
    .onConflictDoNothing();
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function removeExerciseFromSplit(input: {
  splitId: string;
  exerciseId: string;
}): Promise<void> {
  const { splitId, exerciseId } = input;
  if (!splitId || !exerciseId) throw new Error("splitId + exerciseId required");
  await db
    .delete(splitExercises)
    .where(
      and(
        eq(splitExercises.splitId, splitId),
        eq(splitExercises.exerciseId, exerciseId),
      ),
    );
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

export async function reorderSplitExercises(input: {
  splitId: string;
  orderedExerciseIds: string[];
}): Promise<void> {
  if (!input.splitId || !Array.isArray(input.orderedExerciseIds)) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedExerciseIds.length; i++) {
      await tx
        .update(splitExercises)
        .set({ position: i })
        .where(
          and(
            eq(splitExercises.splitId, input.splitId),
            eq(splitExercises.exerciseId, input.orderedExerciseIds[i]),
          ),
        );
    }
  });
  revalidatePath("/gym", "layout");
  revalidatePath("/settings");
}

// ---------- Workouts ----------

export async function startOrGetWorkout(input: {
  id?: string;
  date: string;
  splitId?: string | null;
}): Promise<{ id: string; created: boolean }> {
  if (!isValidDateString(input.date)) throw new Error(`Invalid date: ${input.date}`);
  // Idempotent: one workout per date. If exists, update splitId if changed and return.
  const existing = await db
    .select()
    .from(workouts)
    .where(eq(workouts.date, input.date))
    .limit(1);
  if (existing.length > 0) {
    const row = existing[0];
    if (input.splitId !== undefined && input.splitId !== row.splitId) {
      await db
        .update(workouts)
        .set({ splitId: input.splitId ?? null })
        .where(eq(workouts.id, row.id));
    }
    return { id: row.id, created: false };
  }
  const id = input.id ?? nanoid(12);
  await db.insert(workouts).values({
    id,
    date: input.date,
    splitId: input.splitId ?? null,
  });
  revalidatePath("/gym", "layout");
  return { id, created: true };
}

export async function updateWorkout(input: {
  id: string;
  notes?: string | null;
  durationMin?: number | null;
  splitId?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof workouts.$inferInsert> = {};
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.durationMin !== undefined) {
    patch.durationMin =
      typeof input.durationMin === "number" && input.durationMin > 0
        ? input.durationMin
        : null;
  }
  if (input.splitId !== undefined) patch.splitId = input.splitId;
  if (Object.keys(patch).length > 0) {
    await db.update(workouts).set(patch).where(eq(workouts.id, input.id));
  }
  revalidatePath("/gym", "layout");
}

export async function deleteWorkout(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.delete(workouts).where(eq(workouts.id, id));
  revalidatePath("/gym", "layout");
}

// ---------- Sets ----------

export async function logSet(input: {
  id?: string;
  workoutId: string;
  exerciseId: string;
  setNumber?: number;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  note?: string | null;
}): Promise<{ id: string; isPR: boolean; prKind?: "weight" | "1rm" }> {
  if (!input.workoutId || !input.exerciseId) {
    throw new Error("workoutId + exerciseId required");
  }
  const id = input.id ?? nanoid(12);
  const reps =
    input.reps == null || Number.isNaN(input.reps) ? null : Math.max(0, Math.round(input.reps));
  const weightKg =
    input.weightKg == null || Number.isNaN(input.weightKg)
      ? null
      : Math.max(0, input.weightKg);
  const rpe =
    input.rpe == null || Number.isNaN(input.rpe) ? null : Math.max(1, Math.min(10, input.rpe));

  // Auto set number: max+1 for (workoutId, exerciseId).
  let setNumber = input.setNumber;
  if (setNumber == null) {
    const m = await db
      .select({ p: max(workoutSets.setNumber) })
      .from(workoutSets)
      .where(
        and(
          eq(workoutSets.workoutId, input.workoutId),
          eq(workoutSets.exerciseId, input.exerciseId),
        ),
      );
    setNumber = (m[0]?.p ?? 0) + 1;
  }

  // PR detection: compare against all prior sets for this exercise.
  let isPR = false;
  let prKind: "weight" | "1rm" | undefined;
  if (reps != null && reps >= 1 && weightKg != null && weightKg > 0) {
    const priorRows = await db
      .select({ reps: workoutSets.reps, weightKg: workoutSets.weightKg })
      .from(workoutSets)
      .where(
        and(
          eq(workoutSets.exerciseId, input.exerciseId),
          sql`${workoutSets.weightKg} IS NOT NULL`,
          sql`${workoutSets.reps} IS NOT NULL`,
        ),
      );
    const priorMaxWeight = priorRows.reduce(
      (m, s) => Math.max(m, s.weightKg ?? 0),
      0,
    );
    const priorMax1rm = priorRows.reduce(
      (m, s) => Math.max(m, est1RM(s.weightKg, s.reps)),
      0,
    );
    if (weightKg > priorMaxWeight) {
      isPR = true;
      prKind = "weight";
    } else if (est1RM(weightKg, reps) > priorMax1rm + 0.01) {
      isPR = true;
      prKind = "1rm";
    }
  }

  await db.insert(workoutSets).values({
    id,
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    setNumber,
    reps,
    weightKg,
    rpe,
    isWarmup: input.isWarmup ?? false,
    note: input.note?.trim() || null,
  });
  revalidatePath("/gym", "layout");
  return { id, isPR, prKind };
}

export async function updateSet(input: {
  id: string;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  note?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof workoutSets.$inferInsert> = {};
  if (input.reps !== undefined) {
    patch.reps =
      input.reps == null || Number.isNaN(input.reps) ? null : Math.max(0, Math.round(input.reps));
  }
  if (input.weightKg !== undefined) {
    patch.weightKg =
      input.weightKg == null || Number.isNaN(input.weightKg)
        ? null
        : Math.max(0, input.weightKg);
  }
  if (input.rpe !== undefined) {
    patch.rpe = input.rpe == null || Number.isNaN(input.rpe) ? null : Math.max(1, Math.min(10, input.rpe));
  }
  if (input.isWarmup !== undefined) patch.isWarmup = input.isWarmup;
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (Object.keys(patch).length > 0) {
    await db.update(workoutSets).set(patch).where(eq(workoutSets.id, input.id));
  }
  revalidatePath("/gym", "layout");
}

export async function deleteSet(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  await db.delete(workoutSets).where(eq(workoutSets.id, id));
  revalidatePath("/gym", "layout");
}

// Silence unused imports
void inArray;
void isNull;

// ---------- Month status (for date stepper calendar) ----------

export async function fetchGymMonthStatus(
  monthAnchor: string,
): Promise<
  Record<
    string,
    { hadWorkout: boolean; splitId: string | null; volume: number; setCount: number }
  >
> {
  const startOfMonth = `${monthKeyOf(monthAnchor)}-01`;
  const start = addDays(startOfMonth, -7);
  const nextMonth = shiftMonth(startOfMonth, 1);
  const endOfMonth = addDays(nextMonth, -1);
  const end = addDays(endOfMonth, 7);
  return getGymMonthStatus(start, end);
}
