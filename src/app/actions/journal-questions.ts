"use server";

import { db } from "@/db/client";
import { journalQuestions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { nextQuestionPosition } from "@/db/queries/journal-questions";

const MAX_LABEL_LEN = 140;
const TYPES = ["text", "scale", "boolean"] as const;
type QType = (typeof TYPES)[number];

function sanitizeLabel(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("label must be a string");
  const s = raw.trim();
  if (!s) throw new Error("label is required");
  if (s.length > MAX_LABEL_LEN) throw new Error(`label must be ≤ ${MAX_LABEL_LEN} chars`);
  return s;
}

function sanitizeType(raw: unknown): QType {
  if (typeof raw !== "string" || !TYPES.includes(raw as QType)) {
    throw new Error(`type must be one of: ${TYPES.join(", ")}`);
  }
  return raw as QType;
}

export async function createQuestion(input: { id?: string; label: string; type: string }): Promise<{ id: string }> {
  const label = sanitizeLabel(input.label);
  const type = sanitizeType(input.type);
  const id = input.id ?? nanoid(12);
  const position = await nextQuestionPosition();
  await db.insert(journalQuestions).values({ id, label, type, position });
  revalidatePath("/settings");
  revalidatePath("/journal", "layout");
  return { id };
}

export async function updateQuestion(input: {
  id: string;
  label?: string;
  type?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = sanitizeLabel(input.label);
  if (input.type !== undefined) patch.type = sanitizeType(input.type);
  if (Object.keys(patch).length === 0) return;
  await db.update(journalQuestions).set(patch).where(eq(journalQuestions.id, input.id));
  revalidatePath("/settings");
  revalidatePath("/journal", "layout");
}

export async function archiveQuestion(id: string): Promise<void> {
  await db
    .update(journalQuestions)
    .set({ archivedAt: new Date() })
    .where(eq(journalQuestions.id, id));
  revalidatePath("/settings");
  revalidatePath("/journal", "layout");
}

export async function unarchiveQuestion(id: string): Promise<void> {
  await db.update(journalQuestions).set({ archivedAt: null }).where(eq(journalQuestions.id, id));
  revalidatePath("/settings");
  revalidatePath("/journal", "layout");
}

/**
 * Persist a new ordering for active daily questions. The array index becomes
 * the `position` value. Validates that every id is a non-empty string but
 * does not assert membership in the active set — orphaned ids no-op.
 */
export async function reorderQuestions(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds)) throw new Error("orderedIds must be an array");
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (typeof id !== "string" || !id) throw new Error("invalid id in orderedIds");
    if (seen.has(id)) throw new Error("duplicate id in orderedIds");
    seen.add(id);
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(journalQuestions)
        .set({ position: i })
        .where(eq(journalQuestions.id, orderedIds[i]));
    }
  });
  revalidatePath("/settings");
  revalidatePath("/journal", "layout");
}
