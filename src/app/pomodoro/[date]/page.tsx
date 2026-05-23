import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { PomodoroPageClient } from "./_components/pomodoro-page-client";

export default async function PomodoroDatePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ categoryId?: string; autostart?: string }>;
}) {
  const { date } = await params;
  const { categoryId, autostart } = await searchParams;
  if (date === "today") redirect(`/pomodoro/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();

  return (
    <PomodoroPageClient
      date={date}
      initialCategoryId={categoryId ?? null}
      initialAutostart={autostart === "1"}
    />
  );
}
