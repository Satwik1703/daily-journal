"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { periodKeyFor, todayLocal, type GoalPeriod } from "@/lib/dates";
import { GOAL_PERIODS } from "@/lib/goal-meta";

// `/goals/week` → `/goals/week/{currentKey}` (and same for month/year).
// Client redirect so the period key is computed in the user's local timezone.
export default function GoalsPeriodIndexPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const router = useRouter();
  const { period } = use(params);
  useEffect(() => {
    if (!(GOAL_PERIODS as readonly string[]).includes(period)) {
      router.replace("/goals");
      return;
    }
    router.replace(`/goals/${period}/${periodKeyFor(todayLocal(), period as GoalPeriod)}`);
  }, [router, period]);
  return null;
}
