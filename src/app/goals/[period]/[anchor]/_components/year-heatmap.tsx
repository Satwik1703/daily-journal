import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import { weeksInYear } from "@/lib/dates";

/**
 * 52- (or 53-) week grid for a calendar year. Each cell colored by the
 * pre-computed per-week status. Months bracket the weeks roughly via labels
 * on the side.
 */
export function YearHeatmap({
  year,
  byWeek,
}: {
  year: number;
  byWeek: Record<string, JournalStatus>;
}) {
  const total = weeksInYear(year);
  const weeks = Array.from({ length: total }, (_, i) => {
    const wk = String(i + 1).padStart(2, "0");
    return `${year}-W${wk}`;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{year} at a glance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-flow-col grid-rows-1 gap-1 overflow-x-auto pb-1">
          {weeks.map((key, i) => {
            const status = byWeek[key] ?? "empty";
            return (
              <Link
                key={key}
                href={`/goals/week/${key}`}
                title={`Week ${i + 1}`}
                className="size-5 rounded-sm transition-transform hover:scale-110"
                style={{ background: statusBg(status) }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Jan</span>
          <span>Apr</span>
          <span>Jul</span>
          <span>Oct</span>
          <span>Dec</span>
        </div>
      </CardContent>
    </Card>
  );
}
