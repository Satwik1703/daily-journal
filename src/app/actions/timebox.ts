"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { timeboxCategories, timeboxSlots } from "@/db/schema";
import { requireUser } from "@/lib/auth/context";
import { isValidDateString } from "@/lib/dates";
import { SLOTS_PER_DAY } from "@/lib/timebox-meta";

function validSlot(i: unknown): number | null {
  const n = typeof i === "number" ? i : Number(i);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0 || rounded >= SLOTS_PER_DAY) return null;
  return rounded;
}

/**
 * Upsert one slot. Passing label=null AND categoryId=null AND note=null
 * effectively empties the slot (we still keep the row so history / stats
 * aren't lost). Use `clearSlot` to hard-delete.
 */
export async function upsertTimeboxSlot(input: {
  date: string;
  slotIndex: number;
  categoryId?: string | null;
  label?: string | null;
  note?: string | null;
  source?: "manual" | "auto-pomo";
}): Promise<void> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const idx = validSlot(input.slotIndex);
  if (idx == null) throw new Error("bad slotIndex");
  const label =
    input.label == null ? null : String(input.label).trim().slice(0, 200) || null;
  const note =
    input.note == null ? null : String(input.note).trim().slice(0, 400) || null;
  const now = new Date();

  await db
    .insert(timeboxSlots)
    .values({
      userId: user.id,
      date: input.date,
      slotIndex: idx,
      categoryId: input.categoryId ?? null,
      label,
      note,
      source: input.source ?? "manual",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [timeboxSlots.userId, timeboxSlots.date, timeboxSlots.slotIndex],
      set: {
        categoryId: input.categoryId ?? null,
        label,
        note,
        source: input.source ?? "manual",
        updatedAt: now,
      },
    });
  revalidatePath("/timebox", "layout");
}

/** Bulk-apply the same category+label to N slots on one date. */
export async function upsertTimeboxSlotsBulk(input: {
  date: string;
  slotIndices: number[];
  categoryId?: string | null;
  label?: string | null;
  note?: string | null;
}): Promise<void> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const idxs = (input.slotIndices ?? [])
    .map(validSlot)
    .filter((n): n is number => n != null);
  if (idxs.length === 0) return;
  const label =
    input.label == null ? null : String(input.label).trim().slice(0, 200) || null;
  const note =
    input.note == null ? null : String(input.note).trim().slice(0, 400) || null;
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const i of idxs) {
      await tx
        .insert(timeboxSlots)
        .values({
          userId: user.id,
          date: input.date,
          slotIndex: i,
          categoryId: input.categoryId ?? null,
          label,
          note,
          source: "manual",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            timeboxSlots.userId,
            timeboxSlots.date,
            timeboxSlots.slotIndex,
          ],
          set: {
            categoryId: input.categoryId ?? null,
            label,
            note,
            source: "manual",
            updatedAt: now,
          },
        });
    }
  });
  revalidatePath("/timebox", "layout");
}

export async function clearTimeboxSlot(input: {
  date: string;
  slotIndex: number;
}): Promise<void> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const idx = validSlot(input.slotIndex);
  if (idx == null) throw new Error("bad slotIndex");
  await db
    .delete(timeboxSlots)
    .where(
      and(
        eq(timeboxSlots.userId, user.id),
        eq(timeboxSlots.date, input.date),
        eq(timeboxSlots.slotIndex, idx),
      ),
    );
  revalidatePath("/timebox", "layout");
}

export async function clearTimeboxSlotsBulk(input: {
  date: string;
  slotIndices: number[];
}): Promise<void> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const idxs = (input.slotIndices ?? [])
    .map(validSlot)
    .filter((n): n is number => n != null);
  if (idxs.length === 0) return;
  await db
    .delete(timeboxSlots)
    .where(
      and(
        eq(timeboxSlots.userId, user.id),
        eq(timeboxSlots.date, input.date),
        inArray(timeboxSlots.slotIndex, idxs),
      ),
    );
  revalidatePath("/timebox", "layout");
}

// ---------- Categories CRUD ----------

export async function createTimeboxCategory(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  color: string;
  pomoCategoryId?: string | null;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("name required");
  // Compute next position.
  const existing = await db
    .select({ position: timeboxCategories.position })
    .from(timeboxCategories)
    .where(eq(timeboxCategories.userId, user.id));
  const nextPos =
    existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;
  const id = input.id ?? nanoid(12);
  await db.insert(timeboxCategories).values({
    id,
    userId: user.id,
    name,
    emoji: input.emoji?.trim() || null,
    color: input.color || "#8b5cf6",
    position: nextPos,
    pomoCategoryId: input.pomoCategoryId ?? null,
  });
  revalidatePath("/timebox", "layout");
  revalidatePath("/settings", "layout");
  return { id };
}

export async function updateTimeboxCategory(input: {
  id: string;
  name?: string;
  emoji?: string | null;
  color?: string;
  pomoCategoryId?: string | null;
}): Promise<void> {
  const { user } = await requireUser();
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof timeboxCategories.$inferInsert> = {};
  if (input.name !== undefined) patch.name = String(input.name).trim();
  if (input.emoji !== undefined) patch.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) patch.color = input.color;
  if (input.pomoCategoryId !== undefined) patch.pomoCategoryId = input.pomoCategoryId;
  if (Object.keys(patch).length > 0) {
    await db
      .update(timeboxCategories)
      .set(patch)
      .where(
        and(
          eq(timeboxCategories.id, input.id),
          eq(timeboxCategories.userId, user.id),
        ),
      );
  }
  revalidatePath("/timebox", "layout");
  revalidatePath("/settings", "layout");
}

export async function deleteTimeboxCategory(id: string): Promise<void> {
  const { user } = await requireUser();
  if (!id) throw new Error("id required");
  await db
    .delete(timeboxCategories)
    .where(
      and(
        eq(timeboxCategories.id, id),
        eq(timeboxCategories.userId, user.id),
      ),
    );
  revalidatePath("/timebox", "layout");
  revalidatePath("/settings", "layout");
}

export async function reorderTimeboxCategories(input: {
  orderedIds: string[];
}): Promise<void> {
  const { user } = await requireUser();
  const ids = input.orderedIds ?? [];
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(timeboxCategories)
        .set({ position: i })
        .where(
          and(
            eq(timeboxCategories.id, ids[i]),
            eq(timeboxCategories.userId, user.id),
          ),
        );
    }
  });
  revalidatePath("/timebox", "layout");
  revalidatePath("/settings", "layout");
}
