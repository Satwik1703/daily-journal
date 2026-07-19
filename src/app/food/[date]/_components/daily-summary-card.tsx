"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressDonut } from "@/components/ui/progress-donut";
import type { FoodLog, NutritionProfile } from "@/lib/food-meta";

export function DailySummaryCard({
  logs,
  profile,
}: {
  logs: FoodLog[];
  profile: NutritionProfile;
}) {
  const totals = logs.reduce(
    (acc, l) => {
      acc.kcal += l.kcal;
      acc.protein += l.proteinG;
      acc.carbs += l.carbsG;
      acc.fat += l.fatG;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const kcalTarget = profile.dailyKcalTarget ?? 0;
  const kcalPct = kcalTarget > 0 ? Math.min(1, totals.kcal / kcalTarget) : 0;
  const remaining = Math.max(0, kcalTarget - totals.kcal);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg font-normal">Today&apos;s intake</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <ProgressDonut
              percent={kcalPct * 100}
              size={110}
              strokeWidth={11}
              label={
                <div className="flex flex-col items-center leading-none">
                  <span className="text-lg font-medium tabular-nums">
                    {Math.round(totals.kcal)}
                  </span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    kcal
                  </span>
                </div>
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            {kcalTarget > 0 ? (
              <p className="text-sm">
                <span className="tabular-nums font-medium">{remaining}</span>{" "}
                <span className="text-muted-foreground">kcal remaining</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set your daily target in{" "}
                <a href="/settings" className="underline">
                  Settings → Nutrition
                </a>{" "}
                for progress rings.
              </p>
            )}
            <div className="mt-3 space-y-1.5">
              <MacroBar
                label="Protein"
                value={totals.protein}
                target={profile.proteinTargetG ?? 0}
                color="var(--chart-1)"
              />
              <MacroBar
                label="Carbs"
                value={totals.carbs}
                target={profile.carbsTargetG ?? 0}
                color="var(--chart-2)"
              />
              <MacroBar
                label="Fat"
                value={totals.fat}
                target={profile.fatTargetG ?? 0}
                color="var(--chart-3)"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Math.round(value * 10) / 10}
          {target > 0 ? ` / ${Math.round(target)} g` : " g"}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div
          style={{ width: `${pct * 100}%`, background: color }}
          className="h-full transition-all"
        />
      </div>
    </div>
  );
}
