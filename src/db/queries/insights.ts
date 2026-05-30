import { db } from "@/db/client";
import { habits, habitLogs, journalEntries } from "@/db/schema";
import { and, between, eq, isNull } from "drizzle-orm";
import { addDays, todayLocal, type DateString } from "@/lib/dates";

export type DailyMetric = {
  date: DateString;
  energy: number | null;
  mood: number | null;
  sleepQuality: number | null;
};

export type HabitCompletionRow = {
  date: DateString;
  done: number;
  active: number;
  pct: number;
};

export type RangeData = {
  range: number;
  start: DateString;
  end: DateString;
  dates: DateString[];
  metrics: DailyMetric[];
  completion: HabitCompletionRow[];
  perHabit: { id: string; name: string; emoji: string | null; color: string; done: number }[];
  topWords: { word: string; count: number }[];
};

export async function getRangeData(
  userId: string,
  rangeDays: number,
): Promise<RangeData> {
  const end = todayLocal();
  const start = addDays(end, -(rangeDays - 1));
  const dates: DateString[] = [];
  for (let i = 0; i < rangeDays; i++) dates.push(addDays(start, i));

  const [entries, activeHabits, logs] = await Promise.all([
    db
      .select({
        date: journalEntries.date,
        energy: journalEntries.energy,
        mood: journalEntries.mood,
        sleepQuality: journalEntries.sleepQuality,
        gratitude1: journalEntries.gratitude1,
        gratitude2: journalEntries.gratitude2,
        gratitude3: journalEntries.gratitude3,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          between(journalEntries.date, start, end),
        ),
      ),
    db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), isNull(habits.archivedAt))),
    db
      .select()
      .from(habitLogs)
      .where(
        and(eq(habitLogs.userId, userId), between(habitLogs.date, start, end)),
      ),
  ]);

  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const metrics: DailyMetric[] = dates.map((d) => {
    const e = entryByDate.get(d);
    return {
      date: d,
      energy: e?.energy ?? null,
      mood: e?.mood ?? null,
      sleepQuality: e?.sleepQuality ?? null,
    };
  });

  const logsByDate = new Map<DateString, Set<string>>();
  for (const l of logs) {
    let set = logsByDate.get(l.date);
    if (!set) {
      set = new Set();
      logsByDate.set(l.date, set);
    }
    set.add(l.habitId);
  }

  const activeCount = activeHabits.length;
  const completion: HabitCompletionRow[] = dates.map((d) => {
    const done = logsByDate.get(d)?.size ?? 0;
    return {
      date: d,
      done,
      active: activeCount,
      pct: activeCount === 0 ? 0 : done / activeCount,
    };
  });

  const perHabitMap = new Map<string, number>();
  for (const l of logs) {
    perHabitMap.set(l.habitId, (perHabitMap.get(l.habitId) ?? 0) + 1);
  }
  const perHabit = activeHabits
    .map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      done: perHabitMap.get(h.id) ?? 0,
    }))
    .sort((a, b) => b.done - a.done);

  const topWords = computeTopWords(entries.flatMap((e) => [e.gratitude1, e.gratitude2, e.gratitude3]));

  return { range: rangeDays, start, end, dates, metrics, completion, perHabit, topWords };
}

const STOPLIST = new Set([
  "the","a","an","and","or","but","of","to","for","in","on","at","by","with","from","as","is","are","was","were","be","been","being","i","my","me","mine","you","your","yours","we","us","our","ours","they","them","their","theirs","this","that","these","those","it","its","he","she","his","her","hers","do","did","does","doing","done","have","has","had","having","not","no","yes","so","if","than","then","there","here","up","down","out","off","very","just","more","most","much","some","any","all","each","every","other","another","such","what","when","where","who","why","how","can","could","should","would","will","also","because","still","yet","ever","always","never","get","got","getting","go","going","went","gone","make","made","making","like","really","one","two","three","first","new","good","great","today","day","time","one","things","thing","them","being","feel","felt","feeling","much","lot","bit",
]);

function computeTopWords(strings: (string | null)[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of strings) {
    if (!s) continue;
    const tokens = s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .split(/\s+/);
    for (const raw of tokens) {
      const w = raw.replace(/^[-']+|[-']+$/g, "");
      if (w.length < 3) continue;
      if (STOPLIST.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}
