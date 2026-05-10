"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BodySvg } from "@/components/body-svg/body";
import {
  INTENSITY_LABEL,
  MUSCLE_LABELS,
  PICKER_COLOR_BY_INTENSITY,
  type Intensity,
  type MuscleGroup,
} from "@/lib/muscle-groups";
import { cn } from "@/lib/utils";
import { createWorkout } from "@/app/actions/gym";
import { todayLocal } from "@/lib/dates";
import { toast } from "sonner";

const CYCLE: (Intensity | null)[] = [null, "light", "medium", "heavy"];

export function LogWorkoutSheet() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"front" | "back">("front");
  const [picked, setPicked] = useState<Partial<Record<MuscleGroup, Intensity>>>({});
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setPicked({});
    setDuration("");
    setNotes("");
    setView("front");
  }

  function fillFor(m: MuscleGroup) {
    const i = picked[m];
    return i ? PICKER_COLOR_BY_INTENSITY[i] : "var(--card)";
  }

  function cycleMuscle(m: MuscleGroup) {
    const idx = CYCLE.indexOf(picked[m] ?? null);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setPicked((p) => {
      const copy = { ...p };
      if (next === null) delete copy[m];
      else copy[m] = next;
      return copy;
    });
  }

  function submit() {
    const muscles = Object.entries(picked).map(([muscle, intensity]) => ({ muscle, intensity: intensity as Intensity }));
    if (muscles.length === 0) {
      toast.error("Pick at least one muscle group");
      return;
    }
    startTransition(async () => {
      try {
        await createWorkout({
          date: todayLocal(),
          muscles,
          durationMin: duration ? Number(duration) : null,
          notes: notes || null,
        });
        toast.success("Workout logged");
        setOpen(false);
        reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const pickedList = Object.entries(picked) as [MuscleGroup, Intensity][];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)} size="default">
        <Plus />
        Log workout
      </Button>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-base">Log workout</SheetTitle>
          <SheetDescription>
            Tap a muscle to cycle off → light → medium → heavy.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="relative mx-auto max-w-[300px]">
            <BodySvg view={view} fillFor={fillFor} onMuscleClick={cycleMuscle} className="h-[50vh] max-h-[420px] w-auto" />
            <div className="absolute right-0 top-0 inline-flex items-center gap-0.5 rounded-md border border-border bg-background/85 p-0.5 text-[11px] shadow-sm">
              {(["front", "back"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-sm px-2 py-0.5 font-medium transition-colors",
                    view === v
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Picked legend */}
          <div className="flex flex-wrap gap-1.5">
            {pickedList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">nothing picked yet</p>
            ) : (
              pickedList.map(([m, i]) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                  style={{ borderColor: PICKER_COLOR_BY_INTENSITY[i], color: PICKER_COLOR_BY_INTENSITY[i] }}
                >
                  {MUSCLE_LABELS[m]} · {INTENSITY_LABEL[i]}
                </span>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-duration">Duration (min)</Label>
              <Input
                id="w-duration"
                type="number"
                inputMode="numeric"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-notes">Notes</Label>
              <Input
                id="w-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="optional"
                maxLength={140}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t bg-muted/40 p-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || pickedList.length === 0}>
            {pending ? "Saving…" : "Save workout"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
