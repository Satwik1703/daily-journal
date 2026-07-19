"use client";

import { useMemo } from "react";
import { formatHumanDate } from "@/lib/dates";
import { useCachedPage } from "@/lib/sync/cache";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import type { FoodLog, NutritionProfile, WaterLog } from "@/lib/food-meta";
import { FoodDateStepper } from "./food-date-stepper";
import { DailySummaryCard } from "./daily-summary-card";
import { MealCard } from "./meal-card";
import { WaterCard } from "./water-card";

type PageData = {
  date: string;
  foodLogs: FoodLog[];
  waterLogs: WaterLog[];
  profile: NutritionProfile;
  recentFoods: unknown;
  favoriteFoods: unknown;
};

export function FoodPageClient({ date }: { date: string }) {
  const data = useCachedPage<PageData | null>(
    `food:${date}`,
    null,
    async () => {
      const res = await authAwareFetch(`/api/page/food/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  const logsByMeal = useMemo(() => {
    const m = new Map<string, FoodLog[]>();
    if (!data) return m;
    for (const l of data.foodLogs) {
      const arr = m.get(l.mealType) ?? [];
      arr.push(l);
      m.set(l.mealType, arr);
    }
    return m;
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <FoodDateStepper date={date} />

      <div>
        <h1 className="font-serif text-2xl font-normal leading-tight">Food</h1>
        <p className="text-xs text-muted-foreground">{formatHumanDate(date)}</p>
      </div>

      {data == null ? (
        <PageSkeleton />
      ) : (
        <>
          <DailySummaryCard logs={data.foodLogs} profile={data.profile} />
          {data.profile.mealCategories.map((cat) => (
            <MealCard
              key={cat}
              date={date}
              mealType={cat}
              logs={logsByMeal.get(cat) ?? []}
            />
          ))}
          <WaterCard
            date={date}
            logs={data.waterLogs}
            targetMl={data.profile.waterTargetMl}
          />
        </>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <>
      <div className="h-48 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 animate-pulse rounded-md bg-muted/40" />
    </>
  );
}
