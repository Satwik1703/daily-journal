"use server";

import { fetchGymMonthStatus } from "./gym";
import { getMaxDailyVolumeInRange } from "@/db/queries/gym";
import { addDays, todayLocal } from "@/lib/dates";
import { computeGymDayStatus } from "@/lib/gym-meta";
import type { JournalStatus } from "@/lib/journal-status";
import { requireUser } from "@/lib/auth/context";

/**
 * Returns a JournalStatus map for the calendar popover used in the gym date
 * stepper. Days are bucketed into the 5-color palette by their volume relative
 * to the user's max single-day volume over the trailing 90 days. Empty days
 * stay blank. Lazy days (sets logged with no weight) bucket by set count.
 */
export async function fetchGymMonthStatusForPopover(
  monthAnchor: string,
): Promise<Record<string, JournalStatus>> {
  const { user } = await requireUser();
  // Window stats for the visible month (padded ±7 in fetchGymMonthStatus).
  const monthStats = await fetchGymMonthStatus(monthAnchor);

  // Compute reference max-daily-volume over the last 90 days so the calendar
  // palette stays stable across months. Recomputed per call — cheap.
  const today = todayLocal();
  const ninetyStart = addDays(today, -89);
  const refMaxVolume = await getMaxDailyVolumeInRange(user.id, ninetyStart, today);

  const out: Record<string, JournalStatus> = {};
  for (const [date, info] of Object.entries(monthStats)) {
    const status = computeGymDayStatus(info.volume, info.setCount, refMaxVolume);
    if (status !== "empty") out[date] = status;
  }
  return out;
}
