"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function FoodIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/food/${todayLocal()}`);
  }, [router]);
  return null;
}
