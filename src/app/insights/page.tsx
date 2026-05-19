import { getRangeData } from "@/db/queries/insights";
import { db } from "@/db/client";
import { habitLogs, habits } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { computeStreaks } from "@/lib/streaks";
import { getHabitsSnapshot } from "@/db/queries/habits";
import { formatLocalYMD } from "@/lib/dates";
import { getPomodoroWindow, getAllSessionDates } from "@/db/queries/pomodoro";
import { getActiveCategories } from "@/db/queries/pomodoro-categories";
import { fmtMinutes, fmtPomos } from "@/lib/pomodoro-meta";
import { RangeToggle } from "./_components/range-toggle";
import { MoodEnergyChart } from "./_components/mood-energy-chart";
import { CompletionChart } from "./_components/completion-chart";
import { StreaksGrid } from "./_components/streaks-grid";
import { WordCloud } from "./_components/word-cloud";
import { FocusBarChart } from "./_components/focus-bar-chart";
import { FocusTrendChart } from "./_components/focus-trend-chart";
import { TopCategories } from "./_components/top-categories";
import { HourHistogram } from "./_components/hour-histogram";
import { FocusMonthGrid, buildPerDateMap } from "./_components/focus-month-grid";
import { HabitGrid } from "@/app/habits/_components/habit-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

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

  // Pomodoro window + streak (across all history) + active categories
  const [pomoWindow, allPomoDates, pomoCategories] = await Promise.all([
    getPomodoroWindow(range),
    getAllSessionDates(),
    getActiveCategories(),
  ]);
  const pomoStreak = computeStreaks(allPomoDates);
  const perDateMap = buildPerDateMap(pomoWindow.daily);
  // Serialize the Map<string, DayCategoryAgg> in each daily row so the
  // client trend chart can receive it (Maps don't survive RSC serialization).
  const pomoDailySerialized = pomoWindow.daily.map((d) => ({
    date: d.date,
    count: d.count,
    minutes: d.minutes,
    pomos: d.pomos,
    byCategory: Array.from(d.byCategory.values()),
  }));

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

      {/* ---------- Focus / Pomodoro ---------- */}

      <div className="pt-2">
        <div className="flex items-end justify-between gap-2 mb-1">
          <h2 className="font-serif text-xl font-normal leading-tight">Focus</h2>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Pomodoro · last {range}d
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Focus minutes per day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total pomos
              </span>
              <span className="font-serif text-3xl tabular-nums leading-none">
                {fmtPomos(pomoWindow.totals.pomos)}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {pomoWindow.totals.count} session
                {pomoWindow.totals.count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Focus time
              </span>
              <span className="font-serif text-3xl tabular-nums leading-none">
                {fmtMinutes(pomoWindow.totals.minutes)}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {pomoWindow.totals.minutes
                  ? `${Math.round((pomoWindow.totals.minutes / 60) * 10) / 10}h total`
                  : "—"}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Focus streak
              </span>
              <span className="inline-flex items-center gap-1 font-serif text-2xl tabular-nums leading-none">
                <Flame className="size-4 text-status-bad" />
                {pomoStreak.current}d
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                longest {pomoStreak.longest}d
              </span>
            </div>
          </div>
          <FocusBarChart daily={pomoWindow.daily} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Focus trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FocusTrendChart
            daily={pomoDailySerialized}
            categories={pomoCategories}
            rangeDays={range}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">Top categories</CardTitle>
        </CardHeader>
        <CardContent>
          <TopCategories categories={pomoWindow.topCategories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Best time of day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HourHistogram hourMinutes={pomoWindow.hourHistogram} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Focus heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FocusMonthGrid
            start={pomoWindow.start}
            end={pomoWindow.end}
            perDate={perDateMap}
          />
        </CardContent>
      </Card>
    </div>
  );
}
