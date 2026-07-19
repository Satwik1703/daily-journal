"use server";

import { requireUser } from "@/lib/auth/context";
import { getFoodMonthStatus, type FoodDayStatus } from "@/db/queries/food";
import { addDays, firstOfMonth, shiftMonth } from "@/lib/dates";

/**
 * Server action for the food date-stepper's calendar popover. Loads
 * kcal-vs-target status for the whole month (widened ±7d so the 6-row
 * grid's leading/trailing days spill into adjacent months still color).
 */
export async function fetchFoodMonthStatus(
  monthAnchor: string,
): Promise<Record<string, FoodDayStatus>> {
  const { user } = await requireUser();
  const monthStart = firstOfMonth(monthAnchor);
  const nextMonth = shiftMonth(monthAnchor, 1);
  const end = addDays(firstOfMonth(nextMonth), -1);
  const widenedStart = addDays(monthStart, -7);
  const widenedEnd = addDays(end, 7);
  return getFoodMonthStatus(user.id, widenedStart, widenedEnd);
}
