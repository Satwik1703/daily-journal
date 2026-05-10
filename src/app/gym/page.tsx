import { getGymWindow } from "@/db/queries/gym";
import type { MuscleGroup } from "@/lib/muscle-groups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangeToggle } from "./_components/range-toggle";
import { MuscleHeatmap } from "./_components/muscle-heatmap";
import { LogWorkoutSheet } from "./_components/log-workout-sheet";
import { RecentWorkouts } from "./_components/recent-workouts";

function clampRange(input: string | string[] | undefined): "week" | "month" {
  const v = Array.isArray(input) ? input[0] : input;
  return v === "month" ? "month" : "week";
}

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = clampRange(sp.range);
  const data = await getGymWindow(range);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Gym</h1>
          <p className="text-xs text-muted-foreground">
            {data.start} → {data.end}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeToggle current={range} />
          <LogWorkoutSheet />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg font-normal">
            Heatmap · this {range}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MuscleHeatmap
            intensities={data.accum as Record<MuscleGroup, number>}
            range={range}
          />
        </CardContent>
      </Card>

      <RecentWorkouts workouts={data.recent} />
    </div>
  );
}
