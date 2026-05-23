import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { JournalPageClient } from "./_components/journal-page-client";

export default async function JournalDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/journal/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();
  return <JournalPageClient date={date} />;
}
