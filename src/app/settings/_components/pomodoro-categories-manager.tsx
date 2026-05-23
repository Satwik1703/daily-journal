"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Plus,
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
import { toast } from "sonner";
import type { PomoCategory } from "@/db/queries/pomodoro-categories";
import {
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  reorderCategories,
} from "@/app/actions/pomodoro-categories";

const SUGGESTED_EMOJI = ["💼", "📚", "📖", "🏃", "🎨", "✨", "🧘", "💻", "🎯", "✏️"];

export function PomodoroCategoriesManager({
  active,
  archived,
}: {
  active: PomoCategory[];
  archived: PomoCategory[];
}) {
  const [editing, setEditing] = useState<PomoCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [orderedActive, setOrderedActive] = useState<PomoCategory[]>(active);
  const [, startTransition] = useTransition();

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
    const oldIndex = orderedActive.findIndex((c) => c.id === a.id);
    const newIndex = orderedActive.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedActive, oldIndex, newIndex);
    const previous = orderedActive;
    setOrderedActive(next);
    startTransition(async () => {
      try {
        await reorderCategories(next.map((c) => c.id));
      } catch (err) {
        setOrderedActive(previous);
        toast.error(err instanceof Error ? err.message : "Failed to reorder");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Pomodoro categories</span>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="size-3.5" /> New
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {orderedActive.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No categories. Add one above.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedActive.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedActive.map((c) => (
                <SortableRow
                  key={c.id}
                  category={c}
                  onEdit={() => setEditing(c)}
                  onArchive={() => {
                    startTransition(async () => {
                      await archiveCategory(c.id);
                      toast.success(`Archived "${c.name}"`);
                    });
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
          ? archived.map((c) => (
              <Row
                key={c.id}
                category={c}
                muted
                onEdit={() => setEditing(c)}
                onArchive={() => {
                  startTransition(async () => {
                    await unarchiveCategory(c.id);
                    toast.success(`Restored "${c.name}"`);
                  });
                }}
                archiveLabel="Unarchive"
                ArchiveIcon={RotateCcw}
              />
            ))
          : null}
      </CardContent>

      <CategoryFormDialog
        open={editing !== null || adding}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(false);
          }
        }}
        category={editing}
      />
    </Card>
  );
}

function SortableRow({
  category,
  onEdit,
  onArchive,
}: {
  category: PomoCategory;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Row
        category={category}
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
  category,
  onEdit,
  onArchive,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
  dragHandleProps,
  isDragging = false,
}: {
  category: PomoCategory;
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
        style={{ backgroundColor: category.color, color: "#fff" }}
      >
        {category.emoji ?? "•"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${category.name}`} />
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

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: PomoCategory | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setEmoji(category?.emoji ?? "");
      setColor(category?.color ?? PRESET_COLORS[0]);
    }
  }, [open, category]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        if (category) {
          await updateCategory({
            id: category.id,
            name,
            emoji: emoji || null,
            color,
          });
          toast.success(`Updated "${name}"`);
        } else {
          await createCategory({ name, emoji: emoji || null, color });
          toast.success(`Added "${name}"`);
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {category ? "Edit category" : "New category"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deep Work"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-emoji">Emoji</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                id="cat-emoji"
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
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : category ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
