import { db } from "@/db/client";
import { pomodoroCategories } from "@/db/schema";
import { and, asc, isNotNull, isNull, eq } from "drizzle-orm";

export type PomoCategory = typeof pomodoroCategories.$inferSelect;

export async function getActiveCategories(userId: string): Promise<PomoCategory[]> {
  return db
    .select()
    .from(pomodoroCategories)
    .where(
      and(eq(pomodoroCategories.userId, userId), isNull(pomodoroCategories.archivedAt)),
    )
    .orderBy(asc(pomodoroCategories.position), asc(pomodoroCategories.createdAt));
}

export async function getArchivedCategories(userId: string): Promise<PomoCategory[]> {
  return db
    .select()
    .from(pomodoroCategories)
    .where(
      and(eq(pomodoroCategories.userId, userId), isNotNull(pomodoroCategories.archivedAt)),
    )
    .orderBy(asc(pomodoroCategories.archivedAt));
}

export async function getAllCategories(userId: string): Promise<PomoCategory[]> {
  return db
    .select()
    .from(pomodoroCategories)
    .where(eq(pomodoroCategories.userId, userId))
    .orderBy(asc(pomodoroCategories.position), asc(pomodoroCategories.createdAt));
}

export async function findCategoryById(
  userId: string,
  id: string,
): Promise<PomoCategory | null> {
  const rows = await db
    .select()
    .from(pomodoroCategories)
    .where(
      and(eq(pomodoroCategories.userId, userId), eq(pomodoroCategories.id, id)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function isActiveCategory(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: pomodoroCategories.id })
    .from(pomodoroCategories)
    .where(
      and(
        eq(pomodoroCategories.userId, userId),
        eq(pomodoroCategories.id, id),
        isNull(pomodoroCategories.archivedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function nextCategoryPosition(userId: string): Promise<number> {
  const all = await db
    .select({ position: pomodoroCategories.position })
    .from(pomodoroCategories)
    .where(eq(pomodoroCategories.userId, userId));
  if (all.length === 0) return 0;
  return Math.max(...all.map((r) => r.position)) + 1;
}
