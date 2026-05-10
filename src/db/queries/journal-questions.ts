import { db } from "@/db/client";
import { journalQuestions } from "@/db/schema";
import { asc, eq, isNotNull, isNull } from "drizzle-orm";

export type JournalQuestion = typeof journalQuestions.$inferSelect;

export async function getActiveQuestions(): Promise<JournalQuestion[]> {
  return db
    .select()
    .from(journalQuestions)
    .where(isNull(journalQuestions.archivedAt))
    .orderBy(asc(journalQuestions.position), asc(journalQuestions.createdAt));
}

export async function getArchivedQuestions(): Promise<JournalQuestion[]> {
  return db
    .select()
    .from(journalQuestions)
    .where(isNotNull(journalQuestions.archivedAt))
    .orderBy(asc(journalQuestions.archivedAt));
}

export async function findQuestionById(id: string): Promise<JournalQuestion | null> {
  const rows = await db.select().from(journalQuestions).where(eq(journalQuestions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function nextQuestionPosition(): Promise<number> {
  const all = await db.select({ position: journalQuestions.position }).from(journalQuestions);
  if (all.length === 0) return 0;
  return Math.max(...all.map((r) => r.position)) + 1;
}
