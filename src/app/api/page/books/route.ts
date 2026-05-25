import { NextResponse } from "next/server";
import {
  getAllBooks,
  getProgressByBook,
  getActiveBookId,
} from "@/db/queries/books";

export const dynamic = "force-dynamic";

export async function GET() {
  const [books, progress, activeBookId] = await Promise.all([
    getAllBooks(),
    getProgressByBook(),
    getActiveBookId(),
  ]);
  return NextResponse.json({
    books,
    progress,
    activeBookId,
  });
}
