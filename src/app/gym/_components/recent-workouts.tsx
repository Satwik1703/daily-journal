"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mutate } from "@/lib/sync/mutate";
import { toast } from "sonner";
import {
  INTENSITY_LABEL,
  MUSCLE_LABELS,
  PICKER_COLOR_BY_INTENSITY,
  type Intensity,
  type MuscleGroup,
} from "@/lib/muscle-groups";
import { formatHumanDate } from "@/lib/dates";
import type { WorkoutWithMuscles } from "@/db/queries/gym";

export function RecentWorkouts({ workouts }: { workouts: WorkoutWithMuscles[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visible = workouts.filter((w) => !hiddenIds.has(w.id));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">Recent workouts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
            No workouts yet — tap “Log workout” above.
          </p>
        ) : null}
        {visible.map((w) => (
          <div key={w.id} className="rounded-lg border border-border/70 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{formatHumanDate(w.date)}</div>
              <div className="flex items-center gap-2">
                {w.durationMin ? (
                  <span className="text-[11px] text-muted-foreground">{w.durationMin} min</span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete workout"
                  onClick={() => {
                    setHiddenIds((s) => new Set(s).add(w.id));
                    void mutate("delete_workout", { id: w.id });
                    toast.success("Workout deleted");
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            {w.notes ? (
              <p className="mt-1 text-xs text-muted-foreground">{w.notes}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1">
              {w.muscles.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                  style={{
                    borderColor: PICKER_COLOR_BY_INTENSITY[m.intensity as Intensity],
                    color: PICKER_COLOR_BY_INTENSITY[m.intensity as Intensity],
                  }}
                >
                  {MUSCLE_LABELS[m.muscle as MuscleGroup]} · {INTENSITY_LABEL[m.intensity as Intensity]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
