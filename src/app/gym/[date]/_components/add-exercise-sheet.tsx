"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MUSCLE_LABELS } from "@/lib/muscle-groups";
import type { Exercise } from "@/lib/gym-meta";

export function AddExerciseSheet({
  exercises,
  alreadyShownIds,
  onPick,
}: {
  exercises: Exercise[];
  alreadyShownIds: Set<string>;
  onPick: (exerciseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const available = useMemo(() => {
    const filt = exercises.filter((e) => !alreadyShownIds.has(e.id));
    const norm = q.trim().toLowerCase();
    if (!norm) return filt;
    return filt.filter((e) => {
      if (e.name.toLowerCase().includes(norm)) return true;
      return e.muscleGroups.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(norm));
    });
  }, [exercises, alreadyShownIds, q]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" className="w-full">
            <Plus className="size-4" />
            Add Exercise
          </Button>
        }
      />
      <SheetContent side="bottom" className="max-h-[80vh] overflow-hidden">
        <SheetHeader>
          <SheetTitle>Add exercise</SheetTitle>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or muscle…"
              className="pl-8"
            />
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No exercises match. Add new ones in Settings → Gym library.
            </p>
          ) : (
            <ul className="space-y-1">
              {available.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(e.id);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                    {e.emoji ? <span aria-hidden>{e.emoji}</span> : null}
                    <span className="flex-1 truncate text-sm">{e.name}</span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {e.muscleGroups
                        .slice(0, 3)
                        .map((m) => MUSCLE_LABELS[m])
                        .join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
