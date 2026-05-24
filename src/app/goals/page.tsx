"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal, weekKeyForDisplay } from "@/lib/dates";

// Match /journal and /habits and /pomodoro: a client redirect so the period
// route gets the user's local week, not the server's UTC week. Uses display-
// week semantics so a Sunday lands in the week that starts on it.
export default function GoalsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/goals/week/${weekKeyForDisplay(todayLocal())}`);
  }, [router]);
  return null;
}
