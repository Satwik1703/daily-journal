import { db } from "@/db/client";
import { books, habitValueLogs, settings } from "@/db/schema";
import { and, asc, eq, inArray, sql, sum } from "drizzle-orm";

export type Book = typeof books.$inferSelect;

export type BookStatus = "reading" | "finished" | "dnf" | "wishlist";

export async function getAllBooks(userId: string): Promise<Book[]> {
  return db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(asc(books.position), asc(books.createdAt));
}

export async function getActiveBooks(userId: string): Promise<Book[]> {
  return db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.status, "reading")))
    .orderBy(asc(books.position), asc(books.createdAt));
}

export async function findBookById(userId: string, id: string): Promise<Book | null> {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function nextBookPosition(userId: string): Promise<number> {
  const rows = await db
    .select({ p: books.position })
    .from(books)
    .where(eq(books.userId, userId));
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.p)) + 1;
}

export async function getProgressByBook(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      bookId: habitValueLogs.bookId,
      total: sum(habitValueLogs.value).mapWith(Number),
    })
    .from(habitValueLogs)
    .where(
      and(eq(habitValueLogs.userId, userId), sql`${habitValueLogs.bookId} IS NOT NULL`),
    )
    .groupBy(habitValueLogs.bookId);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.bookId) out[r.bookId] = r.total ?? 0;
  }
  return out;
}

export async function getProgressForBooks(
  userId: string,
  bookIds: string[],
): Promise<Record<string, number>> {
  if (bookIds.length === 0) return {};
  const rows = await db
    .select({
      bookId: habitValueLogs.bookId,
      total: sum(habitValueLogs.value).mapWith(Number),
    })
    .from(habitValueLogs)
    .where(
      and(
        eq(habitValueLogs.userId, userId),
        inArray(habitValueLogs.bookId, bookIds),
      ),
    )
    .groupBy(habitValueLogs.bookId);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.bookId) out[r.bookId] = r.total ?? 0;
  }
  return out;
}

const ACTIVE_BOOK_KEY = "active_book_id";

export async function getActiveBookId(userId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, ACTIVE_BOOK_KEY)))
    .limit(1);
  const raw = rows[0]?.value;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const exists = await findBookById(userId, raw);
  if (!exists || exists.status !== "reading") return null;
  return raw;
}
