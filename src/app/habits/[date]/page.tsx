import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { HabitsPageClient } from "../_components/habits-page-client";

export default async function HabitsDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/habits/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();
  return <HabitsPageClient date={date} />;
}
