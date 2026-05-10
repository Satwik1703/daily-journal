"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RangeToggle({ current }: { current: "week" | "month" }) {
  const pathname = usePathname();
  const opts: { value: "week" | "month"; label: string }[] = [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
      {opts.map(({ value, label }) => {
        const active = current === value;
        return (
          <Link
            key={value}
            href={`${pathname}?range=${value}`}
            scroll={false}
            className={cn(
              "rounded-sm px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
