import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/context";
import { isValidDateString } from "@/lib/dates";
import {
  getFavoriteFoods,
  getFoodLogsForDate,
  getNutritionProfile,
  getRecentFoods,
  getWaterLogsForDate,
} from "@/db/queries/food";

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

  const [foodLogs, waterLogs, profile, recentFoods, favoriteFoods] = await Promise.all([
    getFoodLogsForDate(userId, date),
    getWaterLogsForDate(userId, date),
    getNutritionProfile(userId),
    getRecentFoods(userId, 12),
    getFavoriteFoods(userId),
  ]);

  return NextResponse.json({
    date,
    foodLogs,
    waterLogs,
    profile,
    recentFoods,
    favoriteFoods,
  });
}
