"use server";

import { db } from "@/db/client";
import { books, settings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { isValidDateString } from "@/lib/dates";
import { findBookById, nextBookPosition } from "@/db/queries/books";
import { requireUser } from "@/lib/auth/context";

const MAX_TITLE_LEN = 200;
const MAX_AUTHOR_LEN = 120;
const MAX_NOTES_LEN = 4_000;
const BOOK_STATUSES = ["reading", "finished", "dnf", "wishlist"] as const;
type BookStatus = (typeof BOOK_STATUSES)[number];

function sanitizeTitle(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("title must be a string");
  const s = raw.trim();
  if (!s) throw new Error("title is required");
  if (s.length > MAX_TITLE_LEN) throw new Error(`title must be ≤ ${MAX_TITLE_LEN} chars`);
  return s;
}

function sanitizeAuthor(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("author must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_AUTHOR_LEN) throw new Error(`author must be ≤ ${MAX_AUTHOR_LEN} chars`);
  return s;
}

function sanitizeNotes(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("notes must be a string");
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_NOTES_LEN) throw new Error(`notes must be ≤ ${MAX_NOTES_LEN} chars`);
  return s;
}

function sanitizeRating(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n)) throw new Error("rating must be an integer");
  if (n < 1 || n > 5) throw new Error("rating must be 1..5");
  return n;
}

function sanitizeStatus(raw: unknown): BookStatus {
  if (typeof raw !== "string" || !(BOOK_STATUSES as readonly string[]).includes(raw)) {
    throw new Error(`status must be one of: ${BOOK_STATUSES.join(", ")}`);
  }
  return raw as BookStatus;
}

function sanitizeColor(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("color must be a string");
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) throw new Error("color must be #rrggbb");
  return raw.toLowerCase();
}

function sanitizePages(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error("pages must be a non-negative integer");
  }
  return n;
}

function sanitizeDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("date must be a string");
  if (!isValidDateString(raw)) throw new Error(`Invalid date: ${raw}`);
  return raw;
}

export async function createBook(input: {
  id?: string;
  title: string;
  author?: string | null;
  totalPages?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  rating?: number | null;
  notes?: string | null;
  status?: string;
  color?: string;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const id = input.id ?? nanoid(12);
  const position = await nextBookPosition(user.id);
  await db.insert(books).values({
    id,
    userId: user.id,
    title: sanitizeTitle(input.title),
    author: sanitizeAuthor(input.author),
    totalPages: sanitizePages(input.totalPages),
    startedAt: sanitizeDate(input.startedAt),
    finishedAt: sanitizeDate(input.finishedAt),
    rating: sanitizeRating(input.rating),
    notes: sanitizeNotes(input.notes),
    status: input.status ? sanitizeStatus(input.status) : "reading",
    color: sanitizeColor(input.color ?? "#a89b6a"),
    position,
  });
  revalidatePath("/books");
  revalidatePath("/habits", "layout");
  return { id };
}

export async function updateBook(input: {
  id: string;
  title?: string;
  author?: string | null;
  totalPages?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  rating?: number | null;
  notes?: string | null;
  status?: string;
  color?: string;
}): Promise<void> {
  if (!input.id) throw new Error("id is required");
  const { user } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = sanitizeTitle(input.title);
  if (input.author !== undefined) patch.author = sanitizeAuthor(input.author);
  if (input.totalPages !== undefined) patch.totalPages = sanitizePages(input.totalPages);
  if (input.startedAt !== undefined) patch.startedAt = sanitizeDate(input.startedAt);
  if (input.finishedAt !== undefined) patch.finishedAt = sanitizeDate(input.finishedAt);
  if (input.rating !== undefined) patch.rating = sanitizeRating(input.rating);
  if (input.notes !== undefined) patch.notes = sanitizeNotes(input.notes);
  if (input.status !== undefined) patch.status = sanitizeStatus(input.status);
  if (input.color !== undefined) patch.color = sanitizeColor(input.color);
  if (Object.keys(patch).length === 0) return;
  await db
    .update(books)
    .set(patch)
    .where(and(eq(books.id, input.id), eq(books.userId, user.id)));
  revalidatePath("/books");
  revalidatePath("/habits", "layout");
}

export async function deleteBook(id: string): Promise<void> {
  if (!id) throw new Error("id is required");
  const { user } = await requireUser();
  await db
    .delete(books)
    .where(and(eq(books.id, id), eq(books.userId, user.id)));
  revalidatePath("/books");
  revalidatePath("/habits", "layout");
}

export async function reorderBooks(orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds)) throw new Error("orderedIds must be an array");
  const { user } = await requireUser();
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(books)
        .set({ position: i })
        .where(and(eq(books.id, orderedIds[i]), eq(books.userId, user.id)));
    }
  });
  revalidatePath("/books");
}

const ACTIVE_BOOK_KEY = "active_book_id";

export async function setActiveBook(bookId: string | null): Promise<void> {
  const { user } = await requireUser();
  if (bookId) {
    const exists = await findBookById(user.id, bookId);
    if (!exists) throw new Error("book not found");
  }
  await db
    .insert(settings)
    .values({ userId: user.id, key: ACTIVE_BOOK_KEY, value: bookId })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: bookId },
    });
  revalidatePath("/books");
  revalidatePath("/habits", "layout");
}
