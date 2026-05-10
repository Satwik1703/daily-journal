"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/journal/${todayLocal()}`);
  }, [router]);
  return null;
}
