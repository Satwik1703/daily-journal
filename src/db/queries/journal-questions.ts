import { db } from "@/db/client";
import { journalQuestions } from "@/db/schema";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

export type JournalQuestion = typeof journalQuestions.$inferSelect;

export async function getActiveQuestions(userId: string): Promise<JournalQuestion[]> {
  return db
    .select()
    .from(journalQuestions)
    .where(
      and(eq(journalQuestions.userId, userId), isNull(journalQuestions.archivedAt)),
    )
    .orderBy(asc(journalQuestions.position), asc(journalQuestions.createdAt));
}

export async function getArchivedQuestions(userId: string): Promise<JournalQuestion[]> {
  return db
    .select()
    .from(journalQuestions)
    .where(
      and(eq(journalQuestions.userId, userId), isNotNull(journalQuestions.archivedAt)),
    )
    .orderBy(asc(journalQuestions.archivedAt));
}

export async function findQuestionById(
  userId: string,
  id: string,
): Promise<JournalQuestion | null> {
  const rows = await db
    .select()
    .from(journalQuestions)
    .where(and(eq(journalQuestions.userId, userId), eq(journalQuestions.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function nextQuestionPosition(userId: string): Promise<number> {
  const all = await db
    .select({ position: journalQuestions.position })
    .from(journalQuestions)
    .where(eq(journalQuestions.userId, userId));
  if (all.length === 0) return 0;
  return Math.max(...all.map((r) => r.position)) + 1;
}
