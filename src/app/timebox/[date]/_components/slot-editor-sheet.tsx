"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import {
  formatSlotLabel,
  type LabelStat,
  type TimeboxCategory,
  type TimeboxSlot,
} from "@/lib/timebox-meta";
import { Autocomplete } from "./autocomplete";

export function SlotEditorSheet({
  date,
  slotIndex,
  slot,
  categories,
  stats,
  onClose,
}: {
  date: string;
  slotIndex: number;
  slot: TimeboxSlot | null;
  categories: TimeboxCategory[];
  stats: LabelStat[];
  onClose: () => void;
}) {
  const [label, setLabel] = useState(slot?.label ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(slot?.categoryId ?? null);
  const [note, setNote] = useState(slot?.note ?? "");

  useEffect(() => {
    setLabel(slot?.label ?? "");
    setCategoryId(slot?.categoryId ?? null);
    setNote(slot?.note ?? "");
  }, [slot?.label, slot?.categoryId, slot?.note]);

  function save() {
    void mutate("upsert_timebox_slot", {
      date,
      slotIndex,
      categoryId,
      label: label.trim() || null,
      note: note.trim() || null,
      source: "manual",
    });
    onClose();
  }

  function clear() {
    void mutate("clear_timebox_slot", { date, slotIndex });
    toast.success("Slot cleared");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {formatSlotLabel(slotIndex)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              slot #{slotIndex + 1} of 48
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Category picker */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Category
            </p>
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs transition-colors " +
                    (c.id === categoryId
                      ? "border-transparent"
                      : "border-border hover:bg-muted/60")
                  }
                  style={
                    c.id === categoryId
                      ? { background: c.color + "26", color: c.color, borderColor: c.color + "80" }
                      : undefined
                  }
                >
                  {c.emoji ? <span className="mr-1">{c.emoji}</span> : null}
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Label
            </p>
            <Autocomplete
              value={label}
              onChange={setLabel}
              onSubmit={(v, catId) => {
                setLabel(v);
                if (catId && !categoryId) setCategoryId(catId);
              }}
              placeholder="What did you do?"
              stats={stats}
              categories={categories}
              activeCategoryId={categoryId}
              currentSlotIndex={slotIndex}
            />
          </div>

          {/* Note */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Anything worth noting…"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between">
          {slot ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1 size-3.5" /> Clear
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose render={<Button type="button" variant="ghost" size="sm" />}>
              Cancel
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
