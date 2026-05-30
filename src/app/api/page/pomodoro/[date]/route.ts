import { NextResponse } from "next/server";
import { addDays, isValidDateString, todayLocal } from "@/lib/dates";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { getPomodoroDay } from "@/db/queries/pomodoro";
import { getPomodoroSoundId } from "@/db/queries/settings";
import { getCurrentUser } from "@/lib/auth/context";

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

  const yesterday = addDays(date, -1);
  const today = todayLocal();
  const isToday = date === today;

  const [categories, day, prevDay, soundId] = await Promise.all([
    getActiveCategories(userId),
    getPomodoroDay(userId, date),
    getPomodoroDay(userId, yesterday),
    getPomodoroSoundId(userId),
  ]);

  return NextResponse.json({
    categories,
    day,
    prevDay,
    soundId,
    isToday,
    yesterdayDate: yesterday,
  });
}
