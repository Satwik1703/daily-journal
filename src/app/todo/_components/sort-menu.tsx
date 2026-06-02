"use client";

import { ArrowUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SORT_OPTIONS, type TodoSort } from "@/lib/todo/todo-meta";

export function SortMenu({
  value,
  onChange,
}: {
  value: TodoSort;
  onChange: (s: TodoSort) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Sort" />}>
        <ArrowUpDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {SORT_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.key} onClick={() => onChange(o.key)} className="gap-2">
            <span className="flex-1">{o.label}</span>
            {value === o.key ? <Check className="size-3.5 text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
