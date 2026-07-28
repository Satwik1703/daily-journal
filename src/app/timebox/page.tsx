"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function TimeboxIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/timebox/${todayLocal()}`);
  }, [router]);
  return null;
}
