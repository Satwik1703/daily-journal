import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { isValidDateString } from "@/lib/dates";
import {
  getLabelStats,
  getPomoSessionsForDate,
  getTimeboxCategories,
  getTimeboxSlotsForDate,
} from "@/db/queries/timebox";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [slots, categories, labelStats, pomoSessions] = await Promise.all([
    getTimeboxSlotsForDate(userId, date),
    getTimeboxCategories(userId),
    getLabelStats(userId),
    getPomoSessionsForDate(userId, date),
  ]);

  return NextResponse.json({
    date,
    slots,
    categories,
    labelStats,
    pomoSessions,
  });
}
