"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function PomodoroIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/pomodoro/${todayLocal()}`);
  }, [router]);
  return null;
}
