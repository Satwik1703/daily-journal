"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TodoIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/todo/today");
  }, [router]);
  return null;
}
