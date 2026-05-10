"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function HabitsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/habits/${todayLocal()}`);
  }, [router]);
  return null;
}
