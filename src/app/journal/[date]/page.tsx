import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidDateString, todayLocal } from "@/lib/dates";
import { getActiveQuestions } from "@/db/queries/journal-questions";
import { getTasksForDate } from "@/db/queries/journal-tasks";
import { JournalForm } from "./_components/journal-form";
import { TasksBlock } from "./_components/tasks-block";
import { DateStepper } from "./_components/date-stepper";

export default async function JournalDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (date === "today") redirect(`/journal/${todayLocal()}`);
  if (!isValidDateString(date)) notFound();

  const [rows, questions, tasks] = await Promise.all([
    db.select().from(journalEntries).where(eq(journalEntries.date, date)).limit(1),
    getActiveQuestions(),
    getTasksForDate(date),
  ]);
  const entry = rows[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8">
      <DateStepper date={date} />
      <JournalForm
        date={date}
        questions={questions}
        initial={{
          gratitude1: entry?.gratitude1 ?? "",
          gratitude2: entry?.gratitude2 ?? "",
          gratitude3: entry?.gratitude3 ?? "",
          energy: entry?.energy ?? 5,
          mood: entry?.mood ?? 5,
          sleepQuality: entry?.sleepQuality ?? 5,
          tomorrowPlan: entry?.tomorrowPlan ?? "",
          answers: (entry?.answers as Record<string, unknown>) ?? {},
        }}
        tasksBlock={<TasksBlock date={date} tasks={tasks} />}
      />
    </div>
  );
}
