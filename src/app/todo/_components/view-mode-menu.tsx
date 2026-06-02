"use client";

import { List, CalendarDays, Columns3, Grid2x2, GanttChart, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type RenderMode = "list" | "calendar" | "kanban" | "eisenhower" | "timeline";

const MODES: { key: RenderMode; label: string; Icon: typeof List }[] = [
  { key: "list", label: "List", Icon: List },
  { key: "calendar", label: "Calendar", Icon: CalendarDays },
  { key: "kanban", label: "Board", Icon: Columns3 },
  { key: "eisenhower", label: "Matrix", Icon: Grid2x2 },
  { key: "timeline", label: "Timeline", Icon: GanttChart },
];

export function ViewModeMenu({
  value,
  onChange,
}: {
  value: RenderMode;
  onChange: (m: RenderMode) => void;
}) {
  const Active = MODES.find((m) => m.key === value)?.Icon ?? List;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="View mode" />}>
        <Active />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {MODES.map(({ key, label, Icon }) => (
          <DropdownMenuItem key={key} onClick={() => onChange(key)} className="gap-2">
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {value === key ? <Check className="size-3.5 text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
