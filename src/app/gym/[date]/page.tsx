import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { GymPageClient } from "./_components/gym-page-client";

export default async function GymDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/gym/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();
  return <GymPageClient date={date} />;
}
