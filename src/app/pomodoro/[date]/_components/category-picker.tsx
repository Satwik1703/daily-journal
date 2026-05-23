"use client";

import { cn } from "@/lib/utils";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  disabled,
}: {
  categories: PomoCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(c.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50",
                active
                  ? "border-transparent text-foreground shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
              )}
              style={
                active
                  ? { backgroundColor: `${c.color}22`, boxShadow: `inset 0 0 0 2px ${c.color}` }
                  : undefined
              }
            >
              {c.emoji ? <span>{c.emoji}</span> : null}
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
