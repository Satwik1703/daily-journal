import { db } from "@/db/client";
import { books, habitValueLogs, settings } from "@/db/schema";
import { asc, eq, inArray, sql, sum } from "drizzle-orm";

export type Book = typeof books.$inferSelect;

export type BookStatus = "reading" | "finished" | "dnf" | "wishlist";

export async function getAllBooks(): Promise<Book[]> {
  return db
    .select()
    .from(books)
    .orderBy(asc(books.position), asc(books.createdAt));
}

export async function getActiveBooks(): Promise<Book[]> {
  return db
    .select()
    .from(books)
    .where(eq(books.status, "reading"))
    .orderBy(asc(books.position), asc(books.createdAt));
}

export async function findBookById(id: string): Promise<Book | null> {
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function nextBookPosition(): Promise<number> {
  const rows = await db.select({ p: books.position }).from(books);
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.p)) + 1;
}

/**
 * Map of bookId -> SUM(habit_value_logs.value) — the derived "pages read"
 * progress. Returns 0 (or omits the key) for books with no logs.
 */
export async function getProgressByBook(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      bookId: habitValueLogs.bookId,
      total: sum(habitValueLogs.value).mapWith(Number),
    })
    .from(habitValueLogs)
    .where(sql`${habitValueLogs.bookId} IS NOT NULL`)
    .groupBy(habitValueLogs.bookId);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.bookId) out[r.bookId] = r.total ?? 0;
  }
  return out;
}

export async function getProgressForBooks(
  bookIds: string[],
): Promise<Record<string, number>> {
  if (bookIds.length === 0) return {};
  const rows = await db
    .select({
      bookId: habitValueLogs.bookId,
      total: sum(habitValueLogs.value).mapWith(Number),
    })
    .from(habitValueLogs)
    .where(inArray(habitValueLogs.bookId, bookIds))
    .groupBy(habitValueLogs.bookId);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.bookId) out[r.bookId] = r.total ?? 0;
  }
  return out;
}

const ACTIVE_BOOK_KEY = "active_book_id";

/**
 * Active book id pulled from the settings KV. Falls back to null when unset
 * or when the referenced book has since been deleted/archived.
 */
export async function getActiveBookId(): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, ACTIVE_BOOK_KEY))
    .limit(1);
  const raw = rows[0]?.value;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const exists = await findBookById(raw);
  if (!exists || exists.status !== "reading") return null;
  return raw;
}
