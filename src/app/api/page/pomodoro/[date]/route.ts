import { NextResponse } from "next/server";
import { addDays, isValidDateString, todayLocal } from "@/lib/dates";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { getPomodoroDay } from "@/db/queries/pomodoro";
import { getPomodoroSoundId } from "@/db/queries/settings";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ date: string }> },
) {
  const { date } = await ctx.params;
  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const yesterday = addDays(date, -1);
  const today = todayLocal();
  const isToday = date === today;

  const [categories, day, prevDay, soundId] = await Promise.all([
    getActiveCategories(),
    getPomodoroDay(date),
    getPomodoroDay(yesterday),
    getPomodoroSoundId(),
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
