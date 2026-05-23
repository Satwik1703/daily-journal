"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function PomodoroIndex() {
  const router = useRouter();
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/pomodoro/${todayLocal()}${search}`);
  }, [router]);
  return null;
}
