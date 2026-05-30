"use server";

import { db } from "@/db/client";
import { bodyWeightLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { requireUser } from "@/lib/auth/context";

export async function logBodyWeight(input: {
  id?: string;
  date?: string;
  weightKg: number;
  note?: string | null;
}): Promise<{ id: string }> {
  const date = input.date ?? todayLocal();
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  const weightKg = Number(input.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Weight must be > 0");
  }
  const { user } = await requireUser();
  const id = input.id ?? nanoid(12);
  await db.insert(bodyWeightLogs).values({
    id,
    userId: user.id,
    date,
    weightKg,
    note: input.note?.trim() || null,
  });
  revalidatePath("/gym", "layout");
  return { id };
}

export async function updateBodyWeight(input: {
  id: string;
  weightKg?: number;
  note?: string | null;
}): Promise<void> {
  if (!input.id) throw new Error("id required");
  const { user } = await requireUser();
  const patch: Partial<typeof bodyWeightLogs.$inferInsert> = {};
  if (input.weightKg !== undefined) {
    const w = Number(input.weightKg);
    if (!Number.isFinite(w) || w <= 0) throw new Error("Weight must be > 0");
    patch.weightKg = w;
  }
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (Object.keys(patch).length > 0) {
    await db
      .update(bodyWeightLogs)
      .set(patch)
      .where(
        and(eq(bodyWeightLogs.id, input.id), eq(bodyWeightLogs.userId, user.id)),
      );
  }
  revalidatePath("/gym", "layout");
}

export async function deleteBodyWeight(id: string): Promise<void> {
  if (!id) throw new Error("id required");
  const { user } = await requireUser();
  await db
    .delete(bodyWeightLogs)
    .where(and(eq(bodyWeightLogs.id, id), eq(bodyWeightLogs.userId, user.id)));
  revalidatePath("/gym", "layout");
}
