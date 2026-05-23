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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/lib/muscle-groups";
import type { Exercise } from "@/lib/gym-meta";

const SUGGESTED_EMOJI = ["🏋️", "💪", "🦵", "🦾", "🪽", "🎯", "🚣", "🦶", "🔨", "🧘"];

export function ExercisesManager({ exercises }: { exercises: Exercise[] }) {
  const active = exercises.filter((e) => !e.archivedAt);
  const archived = exercises.filter((e) => e.archivedAt);

  const [orderedActive, setOrderedActive] = useState<Exercise[]>(active);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setOrderedActive(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

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
    void mutate("reorder_exercises", { orderedIds: next.map((s) => s.id) });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Gym exercises</span>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="size-3.5" /> New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {orderedActive.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No exercises yet. Add one above.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedActive.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedActive.map((e) => (
                <SortableRow
                  key={e.id}
                  exercise={e}
                  onEdit={() => setEditing(e)}
                  onArchive={() => {
                    void mutate("archive_exercise", { id: e.id });
                    toast.success(`Archived "${e.name}"`);
                  }}
                  onDelete={() => {
                    if (
                      !confirm(
                        `Delete exercise "${e.name}" permanently? (Fails if it's been used in any workout — archive instead.)`,
                      )
                    )
                      return;
                    void mutate("delete_exercise", { id: e.id });
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
          ? archived.map((e) => (
              <Row
                key={e.id}
                exercise={e}
                muted
                onEdit={() => setEditing(e)}
                onArchive={() => {
                  void mutate("unarchive_exercise", { id: e.id });
                  toast.success(`Restored "${e.name}"`);
                }}
                onDelete={() => {
                  if (!confirm(`Delete exercise "${e.name}" permanently?`)) return;
                  void mutate("delete_exercise", { id: e.id });
                }}
                archiveLabel="Unarchive"
                ArchiveIcon={RotateCcw}
              />
            ))
          : null}
      </CardContent>

      <ExerciseFormDialog
        open={editing !== null || adding}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(false);
          }
        }}
        exercise={editing}
      />
    </Card>
  );
}

function SortableRow(props: {
  exercise: Exercise;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.exercise.id,
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
  exercise,
  onEdit,
  onArchive,
  onDelete,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
  dragHandleProps,
  isDragging = false,
}: {
  exercise: Exercise;
  onEdit: () => void;
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
        style={{ backgroundColor: exercise.color, color: "#fff" }}
      >
        {exercise.emoji ?? "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{exercise.name}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {exercise.muscleGroups.map((m) => MUSCLE_LABELS[m]).join(", ")}
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Options for ${exercise.name}`} />}
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

function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [notes, setNotes] = useState("");
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [perHand, setPerHand] = useState(false);

  useEffect(() => {
    if (open) {
      setName(exercise?.name ?? "");
      setEmoji(exercise?.emoji ?? "");
      setColor(exercise?.color ?? PRESET_COLORS[0]);
      setNotes(exercise?.notes ?? "");
      setMuscleGroups(exercise?.muscleGroups ?? []);
      setPerHand(exercise?.perHand ?? false);
    }
  }, [open, exercise]);

  function toggleMuscle(m: MuscleGroup) {
    setMuscleGroups((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    if (muscleGroups.length === 0) {
      toast.error("Pick at least one muscle group");
      return;
    }
    if (exercise) {
      void mutate("update_exercise", {
        id: exercise.id,
        name,
        emoji: emoji || null,
        color,
        notes: notes || null,
        muscleGroups,
        perHand,
      });
      toast.success(`Updated "${name}"`);
    } else {
      void mutate("create_exercise", {
        id: nanoid(12),
        name,
        emoji: emoji || null,
        color,
        notes: notes || null,
        muscleGroups,
        perHand,
      });
      toast.success(`Added "${name}"`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {exercise ? "Edit exercise" : "New exercise"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Incline Dumbbell Press"
              maxLength={100}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-emoji">Emoji</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                id="ex-emoji"
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

          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor="ex-per-hand" className="text-sm">
                Weight is per-hand
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Dumbbell / single-arm. Logs show an{" "}
                <span className="font-medium">each</span> badge so you log the same
                way every time.
              </p>
            </div>
            <Switch
              id="ex-per-hand"
              checked={perHand}
              onCheckedChange={(v) => setPerHand(Boolean(v))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Muscle groups</Label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map((m) => {
                const active = muscleGroups.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscle(m)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                );
              })}
            </div>
            {muscleGroups.length === 0 ? (
              <p className="text-[11px] text-amber-600">Pick at least one.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-notes">Notes (optional)</Label>
            <Textarea
              id="ex-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Form cues, alternatives, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!name.trim() || muscleGroups.length === 0}>
              {exercise ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
