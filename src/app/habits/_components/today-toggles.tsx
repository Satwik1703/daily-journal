"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logHabitValue, toggleHabitForDate } from "@/app/actions/habits";
import { cn } from "@/lib/utils";
import { isHabitDoneOnDate, type HabitTrackingKind } from "@/lib/habit-meta";
import type { Habit } from "@/db/queries/habits";

export function TodayToggles({
  anchor,
  isToday,
  habits,
  doneIds,
  valueAtAnchor,
  pomoCountAtAnchor,
}: {
  anchor: string;
  isToday: boolean;
  habits: Habit[];
  doneIds: string[];
  /** Sum of habit_value_logs.value on `anchor` per number-kind habit id. */
  valueAtAnchor: Record<string, number>;
  /** Count of pomodoro_sessions on `anchor` per pomo-kind habit id. */
  pomoCountAtAnchor: Record<string, number>;
}) {
  const initial = new Set(doneIds);
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    initial,
    (current: Set<string>, update: { id: string; done: boolean }) => {
      const next = new Set(current);
      if (update.done) next.add(update.id);
      else next.delete(update.id);
      return next;
    },
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>{isToday ? "Today" : "That day"}</span>
          {!isToday ? (
            <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
              Backfilling
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {habits.map((h) => {
          const done = optimisticDone.has(h.id);
          const kind = h.trackingKind as HabitTrackingKind;
          if (kind === "binary") {
            return (
              <BinaryRow
                key={h.id}
                habit={h}
                anchor={anchor}
                done={done}
                onOptimistic={(next) => setOptimisticDone({ id: h.id, done: next })}
              />
            );
          }
          if (kind === "number") {
            return (
              <NumberRow
                key={h.id}
                habit={h}
                anchor={anchor}
                done={done}
                valueToday={valueAtAnchor[h.id] ?? 0}
              />
            );
          }
          return (
            <PomoRow
              key={h.id}
              habit={h}
              anchor={anchor}
              done={done}
              sessionsToday={pomoCountAtAnchor[h.id] ?? 0}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------- Binary ----------

function BinaryRow({
  habit,
  anchor,
  done,
  onOptimistic,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  onOptimistic: (next: boolean) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => {
        startTransition(async () => {
          onOptimistic(!done);
          try {
            await toggleHabitForDate(habit.id, anchor);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Toggle failed");
          }
        });
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all active:scale-[0.99]",
        done ? "border-transparent text-foreground" : "border-border hover:bg-muted/40",
      )}
      style={done ? { backgroundColor: hexToRgba(habit.color, 0.18), borderColor: hexToRgba(habit.color, 0.5) } : undefined}
    >
      <Glyph habit={habit} done={done} />
      <span className="min-w-0 flex-1 truncate font-medium">{habit.name}</span>
      <span
        className={cn(
          "text-xs uppercase tracking-wider",
          done ? "text-foreground/70" : "text-muted-foreground/60",
        )}
      >
        {done ? "Done" : "Tap to log"}
      </span>
    </button>
  );
}

// ---------- Number ----------

function NumberRow({
  habit,
  anchor,
  done,
  valueToday,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  valueToday: number;
}) {
  const target = habit.dailyTarget ?? 0;
  // Recompute done locally in case the snapshot was computed before this
  // session's optimistic edits (e.g. a quick double-log).
  const trulyDone = isHabitDoneOnDate("number", target || null, valueToday, false) || done;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left",
        trulyDone ? "border-transparent" : "border-border",
      )}
      style={
        trulyDone
          ? { backgroundColor: hexToRgba(habit.color, 0.18), borderColor: hexToRgba(habit.color, 0.5) }
          : undefined
      }
    >
      <Glyph habit={habit} done={trulyDone} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{habit.name}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatValue(valueToday)} / {formatValue(target)}
          {habit.unit ? ` ${habit.unit}` : ""}
        </div>
      </div>
      <LogValueButton habitId={habit.id} anchor={anchor} unit={habit.unit} />
    </div>
  );
}

function LogValueButton({
  habitId,
  anchor,
  unit,
}: {
  habitId: string;
  anchor: string;
  unit: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero number");
      return;
    }
    startTransition(async () => {
      try {
        await logHabitValue({ habitId, value: n, date: anchor, note: note || undefined });
        setOpen(false);
        setValue("");
        setNote("");
        toast.success(`+${n} logged`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Log failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="size-3.5" /> Log
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log progress</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="habit-value">Amount{unit ? ` (${unit})` : null}</Label>
            <Input
              id="habit-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder="e.g. 5000"
            />
            <p className="text-[11px] text-muted-foreground">
              Positive adds, negative undoes. Sums against today&apos;s total.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="habit-note">Note (optional)</Label>
            <Textarea
              id="habit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Where, how, anything"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Pomodoro ----------

function PomoRow({
  habit,
  anchor,
  done,
  sessionsToday,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  sessionsToday: number;
}) {
  const target = habit.dailyTarget ?? 0;
  const trulyDone =
    isHabitDoneOnDate("pomodoro", target || null, sessionsToday, false) || done;

  const pomoHref = habit.pomoCategoryId
    ? `/pomodoro/${anchor}?categoryId=${encodeURIComponent(habit.pomoCategoryId)}`
    : `/pomodoro/${anchor}`;

  return (
    <Link
      href={pomoHref}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all hover:bg-muted/40",
        trulyDone ? "border-transparent" : "border-border",
      )}
      style={
        trulyDone
          ? { backgroundColor: hexToRgba(habit.color, 0.18), borderColor: hexToRgba(habit.color, 0.5) }
          : undefined
      }
    >
      <Glyph habit={habit} done={trulyDone} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{habit.name}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {sessionsToday} / {formatValue(target)} session{target === 1 ? "" : "s"}
        </div>
      </div>
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Start
        <ChevronRight className="size-3" />
      </span>
    </Link>
  );
}

// ---------- shared ----------

function Glyph({ habit, done }: { habit: Habit; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-base transition-colors",
        done ? "text-white" : "text-muted-foreground bg-muted",
      )}
      style={done ? { backgroundColor: habit.color } : undefined}
    >
      {done ? <Check className="size-5" strokeWidth={3} /> : (habit.emoji ?? "•")}
    </span>
  );
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
