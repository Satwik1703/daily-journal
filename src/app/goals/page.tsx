"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isoWeekKey, todayLocal } from "@/lib/dates";

// Match /journal and /habits and /pomodoro: a client redirect so the period
// route gets the user's local week, not the server's UTC week.
export default function GoalsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/goals/week/${isoWeekKey(todayLocal())}`);
  }, [router]);
  return null;
}
