import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { journalQuestions, pomodoroCategories } from "@/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/pomodoro-meta";

const DEFAULT_JOURNAL_QUESTIONS: { label: string; type: "text" | "scale" | "boolean" }[] = [
  { label: "What went well today?", type: "text" },
  { label: "What could have gone better?", type: "text" },
  { label: "Learning of the day", type: "text" },
  { label: "Notes", type: "text" },
];

export async function seedNewUser(userId: string): Promise<void> {
  const catRows = DEFAULT_CATEGORIES.map((c, i) => ({
    id: nanoid(12),
    userId,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    position: i,
  }));
  await db.insert(pomodoroCategories).values(catRows);

  const qRows = DEFAULT_JOURNAL_QUESTIONS.map((q, i) => ({
    id: nanoid(12),
    userId,
    label: q.label,
    type: q.type,
    position: i,
  }));
  await db.insert(journalQuestions).values(qRows);
}
