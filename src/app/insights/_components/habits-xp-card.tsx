import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  hexToRgba,
  LEVEL_THRESHOLDS,
  levelFor,
  levelProgress,
  MAX_LEVEL,
  nextLevelAt,
} from "@/lib/habit-meta";
import type { Habit } from "@/db/queries/habits";

/**
 * Compact "where are my habits levelled up?" dashboard. One row per habit
 * with emoji + name + Lv chip + horizontal XP progress bar + XP-to-next.
 * Sorted by XP desc so the strongest habits surface first.
 */
export function HabitsXpCard({
  habits,
  xpByHabit,
}: {
  habits: Habit[];
  xpByHabit: Record<string, number>;
}) {
  if (habits.length === 0) return null;
  const rows = habits
    .map((h) => ({
      habit: h,
      xp: xpByHabit[h.id] ?? 0,
    }))
    .sort((a, b) => b.xp - a.xp);

  const totalXp = rows.reduce((sum, r) => sum + r.xp, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Levels</span>
          <span className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {totalXp.toLocaleString()} XP total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ habit, xp }) => {
          const lvl = levelFor(xp);
          const next = nextLevelAt(xp);
          const pct = Math.round(levelProgress(xp) * 100);
          const xpInLvl = Math.max(0, xp - LEVEL_THRESHOLDS[lvl - 1]);
          const lvlSpan = next == null ? 0 : next - LEVEL_THRESHOLDS[lvl - 1];
          return (
            <div key={habit.id} className="flex items-center gap-3 rounded-md px-1 py-1">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: habit.color, color: "#fff" }}
              >
                {habit.emoji ?? "•"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{habit.name}</span>
                  <span
                    className="shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium tabular-nums"
                    style={{
                      background: hexToRgba(habit.color, 0.18),
                      borderColor: hexToRgba(habit.color, 0.5),
                    }}
                  >
                    Lv {lvl}
                    {lvl === MAX_LEVEL ? " · max" : ""}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: habit.color,
                    }}
                  />
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                  <span>
                    {next == null ? "Max level" : `${xpInLvl} / ${lvlSpan} XP`}
                  </span>
                  <span>{xp.toLocaleString()} XP total</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
