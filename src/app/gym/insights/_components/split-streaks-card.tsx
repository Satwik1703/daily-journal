"use client";

import { Flame } from "lucide-react";

export function SplitStreaksCard({
  streaks,
}: {
  streaks: {
    splitId: string;
    splitName: string;
    emoji: string | null;
    color: string;
    current: number;
    longest: number;
  }[];
}) {
  if (streaks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No streaks yet — pick a split each workout to build one.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {streaks.map((s) => (
        <li
          key={s.splitId}
          className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs"
              style={{ backgroundColor: s.color, color: "#fff" }}
            >
              {s.emoji ?? "•"}
            </span>
            <span className="truncate text-sm font-medium">{s.splitName}</span>
          </span>
          <span className="flex items-center gap-3 text-xs tabular-nums">
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: s.current > 0 ? "#f59e0b" : "var(--muted-foreground)" }}
            >
              <Flame className="size-3.5" />
              {s.current} wk
            </span>
            <span className="text-muted-foreground">longest {s.longest}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
