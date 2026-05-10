"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function JournalIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/journal/${todayLocal()}`);
  }, [router]);
  return null;
}
