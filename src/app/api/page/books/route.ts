import { NextResponse } from "next/server";
import {
  getAllBooks,
  getProgressByBook,
  getActiveBookId,
} from "@/db/queries/books";
import { getCurrentUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const [books, progress, activeBookId] = await Promise.all([
    getAllBooks(userId),
    getProgressByBook(userId),
    getActiveBookId(userId),
  ]);
  return NextResponse.json({
    books,
    progress,
    activeBookId,
  });
}
