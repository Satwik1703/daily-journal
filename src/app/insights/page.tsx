import { getRangeData } from "@/db/queries/insights";
import { db } from "@/db/client";
import { habitLogs, habits } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { computeStreaks } from "@/lib/streaks";
import { getHabitsSnapshot } from "@/db/queries/habits";
import { formatLocalYMD } from "@/lib/dates";
import { RangeToggle } from "./_components/range-toggle";
import { MoodEnergyChart } from "./_components/mood-energy-chart";
import { CompletionChart } from "./_components/completion-chart";
import { StreaksGrid } from "./_components/streaks-grid";
import { WordCloud } from "./_components/word-cloud";
import { HabitGrid } from "@/app/habits/_components/habit-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RANGES = [7, 15, 30, 90] as const;
type Range = (typeof RANGES)[number];

function clampRange(input: string | string[] | undefined): Range {
  const n = Number(Array.isArray(input) ? input[0] : input);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = clampRange(sp.range);

  // Range data
  const data = await getRangeData(range);

  // Snapshot for the configurable Habit Timeline section (filtered to habits
  // that existed on or before each day they're shown on — same rule as /habits/[date]).
  const habitsSnapshot = await getHabitsSnapshot({ windowDays: range });

  // Streaks (use ALL habit logs ever, not just window — streaks can extend beyond range)
  const [allActiveHabits, allLogs] = await Promise.all([
    db.select().from(habits).where(isNull(habits.archivedAt)),
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs),
  ]);
  const logsByHabit = new Map<string, string[]>();
  for (const l of allLogs) {
    let arr = logsByHabit.get(l.habitId);
    if (!arr) {
      arr = [];
      logsByHabit.set(l.habitId, arr);
    }
    arr.push(l.date);
  }
  const streaks = allActiveHabits.map((h) => ({
    id: h.id,
    name: h.name,
    emoji: h.emoji,
    color: h.color,
    ...computeStreaks(logsByHabit.get(h.id) ?? []),
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Insights</h1>
          <p className="text-xs text-muted-foreground">
            {data.start} → {data.end}
          </p>
        </div>
        <RangeToggle current={range} options={RANGES as unknown as number[]} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Energy, Mood, Sleep</CardTitle>
        </CardHeader>
        <CardContent>
          <MoodEnergyChart metrics={data.metrics} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Habit completion</CardTitle>
        </CardHeader>
        <CardContent>
          <CompletionChart completion={data.completion} perHabit={data.perHabit} range={range} />
        </CardContent>
      </Card>

      <HabitGrid
        habits={habitsSnapshot.active.filter(
          (h) => formatLocalYMD(h.createdAt) <= habitsSnapshot.anchor,
        )}
        windowDates={habitsSnapshot.windowDates}
        windowLogs={habitsSnapshot.windowLogs}
        today={habitsSnapshot.today}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Streaks</CardTitle>
        </CardHeader>
        <CardContent>
          {streaks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active habits yet.</p>
          ) : (
            <StreaksGrid streaks={streaks} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Gratitude themes</CardTitle>
        </CardHeader>
        <CardContent>
          <WordCloud words={data.topWords} />
        </CardContent>
      </Card>
    </div>
  );
}
