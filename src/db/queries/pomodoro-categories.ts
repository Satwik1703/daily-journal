import { db } from "@/db/client";
import { pomodoroCategories } from "@/db/schema";
import { asc, isNotNull, isNull, eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DEFAULT_CATEGORIES } from "@/lib/pomodoro-meta";

export type PomoCategory = typeof pomodoroCategories.$inferSelect;

let didSeedCheck = false;

/** Seeds the default categories on first read if the table is empty. */
async function ensureSeeded(): Promise<void> {
  if (didSeedCheck) return;
  const rows = await db
    .select({ id: pomodoroCategories.id })
    .from(pomodoroCategories)
    .limit(1);
  if (rows.length === 0) {
    const values = DEFAULT_CATEGORIES.map((c, i) => ({
      id: nanoid(12),
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      position: i,
    }));
    await db.insert(pomodoroCategories).values(values);
  }
  didSeedCheck = true;
}

export async function getActiveCategories(): Promise<PomoCategory[]> {
  await ensureSeeded();
  return db
    .select()
    .from(pomodoroCategories)
    .where(isNull(pomodoroCategories.archivedAt))
    .orderBy(asc(pomodoroCategories.position), asc(pomodoroCategories.createdAt));
}

export async function getArchivedCategories(): Promise<PomoCategory[]> {
  await ensureSeeded();
  return db
    .select()
    .from(pomodoroCategories)
    .where(isNotNull(pomodoroCategories.archivedAt))
    .orderBy(asc(pomodoroCategories.archivedAt));
}

export async function getAllCategories(): Promise<PomoCategory[]> {
  await ensureSeeded();
  return db
    .select()
    .from(pomodoroCategories)
    .orderBy(asc(pomodoroCategories.position), asc(pomodoroCategories.createdAt));
}

export async function findCategoryById(id: string): Promise<PomoCategory | null> {
  const rows = await db
    .select()
    .from(pomodoroCategories)
    .where(eq(pomodoroCategories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function isActiveCategory(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: pomodoroCategories.id })
    .from(pomodoroCategories)
    .where(and(eq(pomodoroCategories.id, id), isNull(pomodoroCategories.archivedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function nextCategoryPosition(): Promise<number> {
  const all = await db
    .select({ position: pomodoroCategories.position })
    .from(pomodoroCategories);
  if (all.length === 0) return 0;
  return Math.max(...all.map((r) => r.position)) + 1;
}
