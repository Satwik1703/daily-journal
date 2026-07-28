"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import {
  formatSlotLabel,
  type LabelStat,
  type TimeboxCategory,
} from "@/lib/timebox-meta";
import { Autocomplete } from "./autocomplete";

export function MultiSelectBar({
  date,
  selected,
  categories,
  stats,
  onClose,
  onApplied,
}: {
  date: string;
  selected: number[];
  categories: TimeboxCategory[];
  stats: LabelStat[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  if (selected.length === 0) return null;

  const sortedSel = [...selected].sort((a, b) => a - b);
  const first = sortedSel[0];
  const last = sortedSel[sortedSel.length - 1];

  function apply(overrideLabel?: string, overrideCat?: string | null) {
    const finalLabel = (overrideLabel ?? label).trim();
    const finalCat = overrideCat !== undefined ? overrideCat : categoryId;
    void mutate("upsert_timebox_slots_bulk", {
      date,
      slotIndices: selected,
      categoryId: finalCat,
      label: finalLabel || null,
    });
    toast.success(`Applied to ${selected.length} slot${selected.length === 1 ? "" : "s"}`);
    onApplied();
  }

  function clearAll() {
    void mutate("clear_timebox_slots_bulk", { date, slotIndices: selected });
    toast.success(`Cleared ${selected.length} slot${selected.length === 1 ? "" : "s"}`);
    onApplied();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-4 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="rounded bg-primary/15 px-1.5 py-px font-medium text-primary">
              {selected.length}
            </span>{" "}
            <span className="text-muted-foreground">
              selected · {formatSlotLabel(first)} → {formatSlotLabel(last)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel selection"
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Category chips — tap = apply to selection */}
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => apply(label || c.name, c.id)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
                categoryId === c.id
                  ? "border-transparent"
                  : "border-border hover:bg-muted/60",
              )}
              style={
                categoryId === c.id
                  ? { background: c.color + "26", color: c.color, borderColor: c.color + "80" }
                  : undefined
              }
            >
              {c.emoji ? <span className="mr-1">{c.emoji}</span> : null}
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Autocomplete
            value={label}
            onChange={setLabel}
            onSubmit={(v, catId) => apply(v, catId ?? categoryId)}
            placeholder="Label for all selected (Enter to apply)"
            stats={stats}
            categories={categories}
            activeCategoryId={categoryId}
            currentSlotIndex={first}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-destructive hover:bg-destructive/10"
            title="Clear all selected"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
