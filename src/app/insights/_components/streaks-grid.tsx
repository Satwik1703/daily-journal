import { Flame } from "lucide-react";

export function StreaksGrid({
  streaks,
}: {
  streaks: { id: string; name: string; emoji: string | null; color: string; current: number; longest: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {streaks.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-3"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-base text-white"
            style={{ backgroundColor: s.color }}
          >
            {s.emoji ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{s.name}</p>
            <p className="text-[11px] text-muted-foreground">
              best <span className="font-mono tabular-nums">{s.longest}</span>
            </p>
          </div>
          <div
            className="flex items-baseline gap-0.5 text-base font-semibold tabular-nums"
            style={{ color: s.current > 0 ? s.color : "var(--muted-foreground)" }}
            title="current streak"
          >
            <Flame className="size-3.5" />
            <span>{s.current}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
