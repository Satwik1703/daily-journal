import { fmtPomos, fmtMinutes } from "@/lib/pomodoro-meta";
import type { DayCategoryAgg } from "@/db/queries/pomodoro";

export function TopCategories({ categories }: { categories: DayCategoryAgg[] }) {
  if (categories.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No category data yet.
      </p>
    );
  }
  const max = categories[0]?.minutes || 1;
  return (
    <div className="space-y-1.5">
      {categories.slice(0, 6).map((c) => {
        const widthPct = (c.minutes / max) * 100;
        return (
          <div key={c.categoryId ?? "_none"} className="flex items-center gap-2">
            <span aria-hidden className="w-5 text-center text-base leading-none">
              {c.emoji ?? "•"}
            </span>
            <div className="min-w-0 flex-1 truncate text-xs">{c.name}</div>
            <div className="flex w-1/2 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${widthPct}%`, backgroundColor: c.color }}
                />
              </div>
              <span className="w-20 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {fmtPomos(c.pomos)}p · {fmtMinutes(c.minutes)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
