"use client";

import { Flag, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { PRIORITY_META, priorityMeta } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

export function PriorityMenu({
  value,
  onChange,
  children,
}: {
  value: number;
  onChange: (p: number) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<span className="inline-flex outline-none" />}
        aria-label="Set priority"
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {[3, 2, 1, 0].map((p) => {
          const meta = priorityMeta(p);
          return (
            <DropdownMenuItem key={p} onClick={() => onChange(p)} className="gap-2">
              <Flag
                className="size-4"
                style={{ color: p === 0 ? "var(--muted-foreground)" : meta.color }}
                fill={p === 0 ? "none" : meta.color}
              />
              <span className="flex-1">{meta.label}</span>
              {value === p ? <Check className="size-3.5 text-muted-foreground" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small priority flag glyph. Hidden when priority 0 unless `showNone`. */
export function PriorityFlag({
  priority,
  className,
  showNone = false,
}: {
  priority: number;
  className?: string;
  showNone?: boolean;
}) {
  if (priority === 0 && !showNone) return null;
  const meta = PRIORITY_META[priority] ?? PRIORITY_META[0];
  return (
    <Flag
      className={cn("size-3.5", className)}
      style={{ color: priority === 0 ? "var(--muted-foreground)" : meta.color }}
      fill={priority === 0 ? "none" : meta.color}
    />
  );
}
