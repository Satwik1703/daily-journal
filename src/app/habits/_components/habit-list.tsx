"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Archive, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { HabitFormDialog, type CategoryOption } from "./habit-form-dialog";
import { archiveHabit, unarchiveHabit } from "@/app/actions/habits";
import type { Habit } from "@/db/queries/habits";
import { TRACKING_KIND_LABELS, type HabitTrackingKind } from "@/lib/habit-meta";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function HabitList({
  active,
  archived,
  categories,
}: {
  active: Habit[];
  archived: Habit[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Manage</span>
          {archived.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs font-sans text-muted-foreground hover:text-foreground"
            >
              {showArchived ? "Hide" : "Show"} archived ({archived.length})
            </button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {active.map((h) => (
          <Row
            key={h.id}
            habit={h}
            subtitle={trackingSummary(h, categories)}
            onEdit={() => setEditing(h)}
            onArchive={() => {
              startTransition(async () => {
                await archiveHabit(h.id);
                toast.success(`Archived “${h.name}”`);
              });
            }}
          />
        ))}
        {showArchived
          ? archived.map((h) => (
              <Row
                key={h.id}
                habit={h}
                subtitle={trackingSummary(h, categories)}
                muted
                onEdit={() => setEditing(h)}
                onArchive={() => {
                  startTransition(async () => {
                    await unarchiveHabit(h.id);
                    toast.success(`Restored “${h.name}”`);
                  });
                }}
                archiveLabel="Unarchive"
                ArchiveIcon={RotateCcw}
              />
            ))
          : null}
      </CardContent>

      <HabitFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        habit={editing}
        categories={categories}
      />
    </Card>
  );
}

function trackingSummary(habit: Habit, categories: CategoryOption[]): string {
  const kind = habit.trackingKind as HabitTrackingKind;
  if (kind === "binary") return TRACKING_KIND_LABELS.binary;
  if (kind === "number") {
    return `${habit.dailyTarget ?? "?"} ${habit.unit ?? ""}/day`.trim();
  }
  const cat = categories.find((c) => c.id === habit.pomoCategoryId);
  return `${habit.dailyTarget ?? "?"} ${cat?.name ?? "?"} sessions/day`;
}

function Row({
  habit,
  subtitle,
  onEdit,
  onArchive,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
}: {
  habit: Habit;
  subtitle?: string;
  onEdit: () => void;
  onArchive: () => void;
  muted?: boolean;
  archiveLabel?: string;
  ArchiveIcon?: typeof Archive;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2",
        muted && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: habit.color, color: "#fff" }}
      >
        {habit.emoji ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{habit.name}</div>
        {subtitle ? (
          <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${habit.name}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>
            <ArchiveIcon />
            {archiveLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
