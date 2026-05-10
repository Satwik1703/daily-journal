"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RangeToggle({ current, options }: { current: number; options: number[] }) {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
      {options.map((opt) => {
        const active = opt === current;
        return (
          <Link
            key={opt}
            href={`${pathname}?range=${opt}`}
            scroll={false}
            className={cn(
              "rounded-sm px-2 py-1 font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt}d
          </Link>
        );
      })}
    </div>
  );
}
