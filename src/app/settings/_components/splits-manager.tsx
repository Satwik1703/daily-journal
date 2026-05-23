"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  GripVertical,
  Trash2,
  ListPlus,
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
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PRESET_COLORS } from "@/lib/habit-meta";
import { cn } from "@/lib/utils";
import { mutate } from "@/lib/sync/mutate";
import { sortByPosition, type Exercise, type Split, type SplitExercise } from "@/lib/gym-meta";

const SUGGESTED_EMOJI = ["🔥", "💪", "🦵", "🦾", "⚡", "🏋️", "🎯", "🌪️"];

export function SplitsManager({
  splits,
  exercises,
  joins,
}: {
  splits: Split[];
  exercises: Exercise[];
  joins: SplitExercise[];
}) {
  const active = splits.filter((s) => !s.archivedAt);
  const archived = splits.filter((s) => s.archivedAt);

  const [orderedActive, setOrderedActive] = useState<Split[]>(active);
  const [editing, setEditing] = useState<Split | null>(null);
  const [adding, setAdding] = useState(false);
  const [managingExercises, setManagingExercises] = useState<Split | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setOrderedActive(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splits]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = orderedActive.findIndex((s) => s.id === a.id);
    const newIndex = orderedActive.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedActive, oldIndex, newIndex);
    setOrderedActive(next);
    void mutate("reorder_splits", { orderedIds: next.map((s) => s.id) });
  }

  function exerciseCountFor(splitId: string): number {
    return joins.filter((j) => j.splitId === splitId).length;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Gym splits</span>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="size-3.5" /> New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {orderedActive.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No splits yet. Add one above.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedActive.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedActive.map((s) => (
                <SortableRow
                  key={s.id}
                  split={s}
                  count={exerciseCountFor(s.id)}
                  onEdit={() => setEditing(s)}
                  onManageExercises={() => setManagingExercises(s)}
                  onArchive={() => {
                    void mutate("archive_split", { id: s.id });
                    toast.success(`Archived "${s.name}"`);
                  }}
                  onDelete={() => {
                    if (!confirm(`Delete split "${s.name}"? Workouts using it will lose the link.`)) return;
                    void mutate("delete_split", { id: s.id });
                    toast.success(`Deleted "${s.name}"`);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {archived.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="pt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
        ) : null}
        {showArchived
          ? archived.map((s) => (
              <Row
                key={s.id}
                split={s}
                count={exerciseCountFor(s.id)}
                muted
                onEdit={() => setEditing(s)}
                onManageExercises={() => setManagingExercises(s)}
                onArchive={() => {
                  void mutate("unarchive_split", { id: s.id });
                  toast.success(`Restored "${s.name}"`);
                }}
                onDelete={() => {
                  if (!confirm(`Delete split "${s.name}" permanently?`)) return;
                  void mutate("delete_split", { id: s.id });
                }}
                archiveLabel="Unarchive"
                ArchiveIcon={RotateCcw}
              />
            ))
          : null}
      </CardContent>

      <SplitFormDialog
        open={editing !== null || adding}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(false);
          }
        }}
        split={editing}
      />

      <ManageSplitExercisesDialog
        open={managingExercises !== null}
        onOpenChange={(o) => !o && setManagingExercises(null)}
        split={managingExercises}
        exercises={exercises}
        joins={joins}
      />
    </Card>
  );
}

function SortableRow(props: {
  split: Split;
  count: number;
  onEdit: () => void;
  onManageExercises: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.split.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Row {...props} dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} />
    </div>
  );
}

type DragHandleProps = React.HTMLAttributes<HTMLButtonElement>;

function Row({
  split,
  count,
  onEdit,
  onManageExercises,
  onArchive,
  onDelete,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
  dragHandleProps,
  isDragging = false,
}: {
  split: Split;
  count: number;
  onEdit: () => void;
  onManageExercises: () => void;
  onArchive: () => void;
  onDelete: () => void;
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
        style={{ backgroundColor: split.color, color: "#fff" }}
      >
        {split.emoji ?? "•"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {split.name}{" "}
        <span className="text-[10px] text-muted-foreground">
          · {count} exercise{count === 1 ? "" : "s"}
        </span>
      </span>
      <Button size="sm" variant="ghost" onClick={onManageExercises} className="gap-1 text-xs">
        <ListPlus className="size-3.5" /> Exercises
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Options for ${split.name}`} />}
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
          <DropdownMenuItem onClick={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SplitFormDialog({
  open,
  onOpenChange,
  split,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  split: Split | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);

  useEffect(() => {
    if (open) {
      setName(split?.name ?? "");
      setEmoji(split?.emoji ?? "");
      setColor(split?.color ?? PRESET_COLORS[0]);
    }
  }, [open, split]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    if (split) {
      void mutate("update_split", { id: split.id, name, emoji: emoji || null, color });
      toast.success(`Updated "${name}"`);
    } else {
      void mutate("create_split", { id: nanoid(12), name, emoji: emoji || null, color });
      toast.success(`Added "${name}"`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {split ? "Edit split" : "New split"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="split-name">Name</Label>
            <Input
              id="split-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push"
              maxLength={60}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="split-emoji">Emoji</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                id="split-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={8}
                className="w-14 text-center text-lg"
              />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "size-8 rounded-md border border-transparent text-base transition-colors hover:bg-muted",
                      emoji === e && "border-primary bg-primary/10",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "size-8 rounded-full ring-offset-2 ring-offset-popover transition-all",
                    color === c ? "ring-2 ring-foreground" : "ring-0",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              {split ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageSplitExercisesDialog({
  open,
  onOpenChange,
  split,
  exercises,
  joins,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  split: Split | null;
  exercises: Exercise[];
  joins: SplitExercise[];
}) {
  const inSplit = split
    ? sortByPosition(joins.filter((j) => j.splitId === split.id))
        .map((j) => exercises.find((e) => e.id === j.exerciseId))
        .filter((e): e is Exercise => e != null)
    : [];
  const inSplitIds = new Set(inSplit.map((e) => e.id));
  const available = exercises.filter((e) => !e.archivedAt && !inSplitIds.has(e.id));

  function add(exerciseId: string) {
    if (!split) return;
    void mutate("assign_exercise_to_split", { splitId: split.id, exerciseId });
  }
  function remove(exerciseId: string) {
    if (!split) return;
    void mutate("remove_exercise_from_split", { splitId: split.id, exerciseId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {split ? `Exercises in ${split.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              In this split ({inSplit.length})
            </p>
            {inSplit.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-1">
                {inSplit.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2 py-1.5 text-sm"
                  >
                    {e.emoji ? <span>{e.emoji}</span> : null}
                    <span className="flex-1 truncate">{e.name}</span>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="rounded p-1 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove from split"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Available ({available.length})
            </p>
            {available.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">All exercises are in this split.</p>
            ) : (
              <ul className="space-y-1">
                {available.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => add(e.id)}
                      className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-background px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {e.emoji ? <span>{e.emoji}</span> : null}
                      <span className="flex-1 truncate">{e.name}</span>
                      <Plus className="size-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
