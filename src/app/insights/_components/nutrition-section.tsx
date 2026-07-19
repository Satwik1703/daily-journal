import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";
import { NutritionInRangeChart } from "./nutrition-in-range-chart";

export function NutritionSection({
  daily,
  target,
  water,
  waterTarget,
}: {
  daily: Array<{ date: string; kcal: number; proteinG: number; carbsG: number; fatG: number }>;
  target: number | null;
  water: Array<{ date: string; amountMl: number }>;
  waterTarget: number;
}) {
  const totalKcal = daily.reduce((a, d) => a + d.kcal, 0);
  const avgKcal = daily.length > 0 ? Math.round(totalKcal / daily.length) : 0;
  const streak = target != null && target > 0
    ? countUnderTargetStreak(daily.slice().reverse(), target)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 font-serif text-lg font-normal">
          <Utensils className="size-4" /> Nutrition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Avg kcal / day" value={avgKcal} />
          <Stat label="Target" value={target ? Math.round(target) : "—"} />
          <Stat label="Days at/under budget" value={streak} />
        </div>
        <NutritionInRangeChart daily={daily} target={target} />
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
          Water — total{" "}
          <strong className="tabular-nums">
            {(water.reduce((a, w) => a + w.amountMl, 0) / 1000).toFixed(1)} L
          </strong>{" "}
          over {daily.length || water.length || 0} days · target{" "}
          {(waterTarget / 1000).toFixed(1)} L / day
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-2">
      <p className="text-lg font-medium tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function countUnderTargetStreak(
  daily: Array<{ kcal: number }>,
  target: number,
): number {
  let n = 0;
  for (const d of daily) {
    if (d.kcal > 0 && d.kcal <= target) n++;
    else if (d.kcal === 0) continue;
    else break;
  }
  return n;
}
