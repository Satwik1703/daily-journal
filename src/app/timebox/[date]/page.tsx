import { notFound, redirect } from "next/navigation";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { TimeboxPageClient } from "./_components/timebox-page-client";

export const dynamic = "force-dynamic";

export default async function TimeboxDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/timebox/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();
  return <TimeboxPageClient date={date} />;
}
