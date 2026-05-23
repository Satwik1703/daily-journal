"use client";

import { useCachedPage } from "@/lib/sync/cache";
import { JournalForm } from "./journal-form";
import { TasksBlock } from "./tasks-block";
import { DateStepper } from "./date-stepper";
import type { JournalQuestion } from "@/db/queries/journal-questions";
import type { JournalTask } from "@/db/queries/journal-tasks";

type Entry = {
  gratitude1: string;
  gratitude2: string;
  gratitude3: string;
  identity1: string;
  identity2: string;
  identity3: string;
  identity4: string;
  identity5: string;
  energy: number;
  mood: number;
  sleepQuality: number;
  tomorrowPlan: string;
  answers: Record<string, unknown>;
};

type PageData = {
  entry: Entry | null;
  questions: JournalQuestion[];
  tasks: JournalTask[];
};

export function JournalPageClient({ date }: { date: string }) {
  const data = useCachedPage<PageData | null>(
    `journal:${date}`,
    null,
    async () => {
      const res = await fetch(`/api/page/journal/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8">
      <DateStepper date={date} />
      {data == null ? (
        <PageSkeleton />
      ) : (
        <JournalForm
          date={date}
          questions={data.questions}
          initial={
            data.entry ?? {
              gratitude1: "",
              gratitude2: "",
              gratitude3: "",
              identity1: "",
              identity2: "",
              identity3: "",
              identity4: "",
              identity5: "",
              energy: 5,
              mood: 5,
              sleepQuality: 5,
              tomorrowPlan: "",
              answers: {},
            }
          }
          tasksBlock={<TasksBlock date={date} tasks={data.tasks} />}
        />
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-48 animate-pulse rounded-md bg-muted/40" />
      <div className="h-48 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}
