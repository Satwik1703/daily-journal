"use client";

import { useState } from "react";
import { BodySvg } from "@/components/body-svg/body";
import {
  intensityToColor,
  MUSCLE_LABELS,
  SATURATION_BY_RANGE,
  type MuscleGroup,
} from "@/lib/muscle-groups";
import { cn } from "@/lib/utils";

export function MuscleHeatmap({
  intensities,
  range,
}: {
  intensities: Record<MuscleGroup, number>;
  range: "week" | "month";
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const sat = SATURATION_BY_RANGE[range];

  function fillFor(m: MuscleGroup) {
    const raw = intensities[m] ?? 0;
    return intensityToColor(Math.min(1, raw / sat));
  }

  // Top trained muscles list
  const ranked = Object.entries(intensities)
    .filter(([, v]) => v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5) as [MuscleGroup, number][];

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3">
      <div className="relative">
        <BodySvg view={view} fillFor={fillFor} className="mx-auto block h-[60vh] max-h-[480px] w-auto" />
        <div className="absolute right-0 top-0 inline-flex items-center gap-0.5 rounded-md border border-border bg-background/85 p-0.5 text-[11px] shadow-sm backdrop-blur">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-sm px-2 py-0.5 font-medium transition-colors",
                view === v
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-1.5 text-xs sm:flex">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Top this {range}
        </div>
        {ranked.length === 0 ? (
          <div className="text-muted-foreground/70 italic">no workouts yet</div>
        ) : (
          ranked.map(([m, v]) => (
            <div key={m} className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: intensityToColor(Math.min(1, v / sat)) }} />
              <span className="truncate">{MUSCLE_LABELS[m]}</span>
              <span className="ml-auto font-mono tabular-nums text-[10px] text-muted-foreground">
                {Math.round((v / sat) * 100)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
