"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, GripVertical, X, CalendarClock } from "lucide-react";
import { customAlphabet } from "nanoid";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import type { TimeboxCategory } from "@/lib/timebox-meta";

const uid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

type PomoCategoryLite = { id: string; name: string; emoji: string | null };

const SWATCHES = [
  "#2563eb", "#7c3aed", "#db2777", "#059669", "#f59e0b",
  "#4b5563", "#78716c", "#0ea5e9", "#dc2626", "#84cc16",
];

export function TimeboxCategoriesManager({
  initial,
  pomoCategories,
}: {
  initial: TimeboxCategory[];
  pomoCategories: PomoCategoryLite[];
}) {
  const [items, setItems] = useState<TimeboxCategory[]>(initial);
  const [editing, setEditing] = useState<TimeboxCategory | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => setItems(initial), [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    void mutate("reorder_timebox_categories", {
      orderedIds: next.map((n) => n.id),
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 font-serif text-lg font-normal">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4" /> Timebox categories
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/10 py-4 text-center text-xs text-muted-foreground">
              No categories yet.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1">
                  {items.map((c) => (
                    <Row key={c.id} cat={c} onEdit={() => setEditing(c)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <p className="pt-1 text-[10px] text-muted-foreground">
            Drag to reorder · link a pomodoro category to auto-fill matching slots.
          </p>
        </CardContent>
      </Card>

      <CategoryDialog
        open={creating}
        onOpenChange={setCreating}
        pomoCategories={pomoCategories}
      />
      {editing ? (
        <CategoryDialog
          open
          onOpenChange={(o) => (!o ? setEditing(null) : null)}
          cat={editing}
          pomoCategories={pomoCategories}
        />
      ) : null}
    </>
  );
}

function Row({ cat, onEdit }: { cat: TimeboxCategory; onEdit: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: cat.id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab text-muted-foreground/60 hover:text-foreground"
      >
        <GripVertical className="size-3.5" />
      </button>
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ background: cat.color }}
      />
      <span className="flex-1 truncate text-sm">
        {cat.emoji ? <span className="mr-1">{cat.emoji}</span> : null}
        {cat.name}
        {cat.pomoCategoryId ? (
          <span className="ml-2 rounded bg-amber-500/15 px-1 py-0 text-[9px] uppercase text-amber-700 dark:text-amber-300">
            pomo-link
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit category"
        className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
    </li>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  cat,
  pomoCategories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cat?: TimeboxCategory;
  pomoCategories: PomoCategoryLite[];
}) {
  const [name, setName] = useState(cat?.name ?? "");
  const [emoji, setEmoji] = useState(cat?.emoji ?? "");
  const [color, setColor] = useState(cat?.color ?? SWATCHES[0]);
  const [pomoLink, setPomoLink] = useState<string | "">(cat?.pomoCategoryId ?? "");

  useEffect(() => {
    if (open) {
      setName(cat?.name ?? "");
      setEmoji(cat?.emoji ?? "");
      setColor(cat?.color ?? SWATCHES[0]);
      setPomoLink(cat?.pomoCategoryId ?? "");
    }
  }, [open, cat?.name, cat?.emoji, cat?.color, cat?.pomoCategoryId]);

  function save() {
    const n = name.trim();
    if (!n) {
      toast.error("Name required");
      return;
    }
    if (cat) {
      void mutate("update_timebox_category", {
        id: cat.id,
        name: n,
        emoji: emoji.trim() || null,
        color,
        pomoCategoryId: pomoLink || null,
      });
    } else {
      void mutate("create_timebox_category", {
        id: uid(),
        name: n,
        emoji: emoji.trim() || null,
        color,
        pomoCategoryId: pomoLink || null,
      });
    }
    onOpenChange(false);
  }

  function del() {
    if (!cat) return;
    void mutate("delete_timebox_category", { id: cat.id });
    toast.info("Category deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {cat ? "Edit category" : "New category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_60px] gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="text-center"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setColor(s)}
                  aria-label={`Color ${s}`}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    color === s ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: s }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Auto-fill from pomodoro category (optional)
            </p>
            <select
              value={pomoLink}
              onChange={(e) => setPomoLink(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {pomoCategories.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji ? `${p.emoji} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground italic">
              If set, pomodoro sessions with this category auto-fill matching timebox slots.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between">
          {cat ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={del}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1 size-3.5" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose render={<Button type="button" variant="ghost" size="sm" />}>
              <X className="mr-1 size-3.5" /> Cancel
            </DialogClose>
            <Button type="button" size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
