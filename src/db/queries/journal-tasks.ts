import { db } from "@/db/client";
import { journalEntries, journalTasks } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { DateString } from "@/lib/dates";
import type { TaskKind } from "@/lib/task-meta";

export type JournalTask = typeof journalTasks.$inferSelect;
export type { TaskKind };

export async function getTasksForDate(date: DateString): Promise<JournalTask[]> {
  return db
    .select()
    .from(journalTasks)
    .where(eq(journalTasks.date, date))
    .orderBy(asc(journalTasks.kind), asc(journalTasks.position), asc(journalTasks.id));
}

export async function findTaskById(id: string): Promise<JournalTask | null> {
  const rows = await db.select().from(journalTasks).where(eq(journalTasks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Make sure a journal_entries row exists for the given date so FK-bound rows can be inserted. */
export async function ensureEntry(date: DateString): Promise<void> {
  await db
    .insert(journalEntries)
    .values({ date, updatedAt: new Date() })
    .onConflictDoNothing();
}

export async function nextTaskPosition(date: DateString, kind: TaskKind): Promise<number> {
  const rows = await db
    .select({ position: journalTasks.position })
    .from(journalTasks)
    .where(and(eq(journalTasks.date, date), eq(journalTasks.kind, kind)));
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.position)) + 1;
}
