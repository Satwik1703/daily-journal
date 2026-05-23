"use client";

import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { mutate } from "@/lib/sync/mutate";
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
  const [orderedActive, setOrderedActive] = useState<Habit[]>(active);

  useEffect(() => {
    setOrderedActive(active);
  }, [active]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = orderedActive.findIndex((h) => h.id === a.id);
    const newIndex = orderedActive.findIndex((h) => h.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedActive, oldIndex, newIndex);
    const previous = orderedActive;
    setOrderedActive(next);
    void mutate("reorder_habits", { orderedIds: next.map((h) => h.id) });
    void previous;
  }

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
        {orderedActive.length === 0 ? null : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedActive.map((h) => h.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedActive.map((h) => (
                <SortableRow
                  key={h.id}
                  habit={h}
                  subtitle={trackingSummary(h, categories)}
                  onEdit={() => setEditing(h)}
                  onArchive={() => {
                    void mutate("archive_habit", { id: h.id });
                    toast.success(`Archived “${h.name}”`);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {showArchived
          ? archived.map((h) => (
              <Row
                key={h.id}
                habit={h}
                subtitle={trackingSummary(h, categories)}
                muted
                onEdit={() => setEditing(h)}
                onArchive={() => {
                  void mutate("unarchive_habit", { id: h.id });
                  toast.success(`Restored “${h.name}”`);
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

function SortableRow({
  habit,
  subtitle,
  onEdit,
  onArchive,
}: {
  habit: Habit;
  subtitle?: string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Row
        habit={habit}
        subtitle={subtitle}
        onEdit={onEdit}
        onArchive={onArchive}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

type DragHandleProps = React.HTMLAttributes<HTMLButtonElement>;

function Row({
  habit,
  subtitle,
  onEdit,
  onArchive,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
  dragHandleProps,
  isDragging = false,
}: {
  habit: Habit;
  subtitle?: string;
  onEdit: () => void;
  onArchive: () => void;
  muted?: boolean;
  archiveLabel?: string;
  ArchiveIcon?: typeof Archive;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2",
        muted && "opacity-60",
        isDragging && "bg-muted/40 shadow-sm",
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
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
