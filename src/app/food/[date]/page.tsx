import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { FoodPageClient } from "./_components/food-page-client";

export const dynamic = "force-dynamic";

export default async function FoodDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/food/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();
  return <FoodPageClient date={date} />;
}
