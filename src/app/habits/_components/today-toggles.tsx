"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { customAlphabet } from "nanoid";
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
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import { isHabitDoneOnDate, type HabitTrackingKind } from "@/lib/habit-meta";
import type { Habit } from "@/db/queries/habits";

const valueLogId = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

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
  // ---- Local overlay state ---------------------------------------------------
  // We deliberately do NOT use useOptimistic here. Its semantics — "patch
  // applies only while a transition is pending" — meant the optimistic
  // value evaporated the moment startTransition's sync body returned, and
  // the UI flipped back until /api/sync committed + useCachedPage refetched.
  // That round-trip is the 5s lag the user kept seeing.
  //
  // Instead, hold the overlay in plain useState. It persists across renders
  // forever; a reconciliation effect drops entries once the freshly fetched
  // server data confirms each optimistic change.
  const doneIdsKey = doneIds.join(",");
  const serverDoneIds = useMemo(
    () => new Set(doneIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doneIdsKey],
  );
  const [doneOverlay, setDoneOverlay] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  // Number overlay tracks both the accumulated optimistic delta AND the
  // server value at the moment we first started accumulating. Reconcile by
  // dropping the entry once the server's reported sum catches up.
  const [valueOverlay, setValueOverlay] = useState<
    Map<string, { delta: number; baseline: number }>
  >(() => new Map());

  // Reconcile binary overlay against server.
  useEffect(() => {
    setDoneOverlay((m) => {
      if (m.size === 0) return m;
      const next = new Map(m);
      let changed = false;
      for (const [id, intended] of m) {
        if (serverDoneIds.has(id) === intended) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : m;
    });
  }, [serverDoneIds]);

  // Reconcile number overlay against server.
  const valuesKey = JSON.stringify(valueAtAnchor);
  useEffect(() => {
    setValueOverlay((m) => {
      if (m.size === 0) return m;
      const next = new Map(m);
      let changed = false;
      for (const [id, { delta, baseline }] of m) {
        const currentServer = valueAtAnchor[id] ?? 0;
        if (currentServer >= baseline + delta) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  function isDone(habitId: string): boolean {
    if (doneOverlay.has(habitId)) return doneOverlay.get(habitId)!;
    return serverDoneIds.has(habitId);
  }

  function valueFor(habitId: string): number {
    const overlay = valueOverlay.get(habitId);
    return (valueAtAnchor[habitId] ?? 0) + (overlay?.delta ?? 0);
  }

  function flipDone(habitId: string, next: boolean) {
    setDoneOverlay((m) => {
      const map = new Map(m);
      map.set(habitId, next);
      return map;
    });
  }

  function addValue(habitId: string, delta: number) {
    setValueOverlay((m) => {
      const map = new Map(m);
      const existing = map.get(habitId);
      const baseline = existing?.baseline ?? (valueAtAnchor[habitId] ?? 0);
      map.set(habitId, {
        delta: (existing?.delta ?? 0) + delta,
        baseline,
      });
      return map;
    });
  }

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
          const done = isDone(h.id);
          const kind = h.trackingKind as HabitTrackingKind;
          if (kind === "binary") {
            return (
              <BinaryRow
                key={h.id}
                habit={h}
                done={done}
                onFlip={(next) => {
                  flipDone(h.id, next);
                  void mutate("toggle_habit", { habitId: h.id, date: anchor });
                }}
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
                valueToday={valueFor(h.id)}
                onLogValue={(delta) => addValue(h.id, delta)}
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
  done,
  onFlip,
}: {
  habit: Habit;
  done: boolean;
  onFlip: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => onFlip(!done)}
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
  onLogValue,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  valueToday: number;
  onLogValue: (delta: number) => void;
}) {
  const target = habit.dailyTarget ?? 0;
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
      <LogValueButton habitId={habit.id} anchor={anchor} unit={habit.unit} onLogged={onLogValue} />
    </div>
  );
}

function LogValueButton({
  habitId,
  anchor,
  unit,
  onLogged,
}: {
  habitId: string;
  anchor: string;
  unit: string | null;
  onLogged: (delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero number");
      return;
    }
    onLogged(n);
    void mutate("log_habit_value", {
      id: valueLogId(),
      habitId,
      value: n,
      date: anchor,
      note: note || undefined,
    });
    setOpen(false);
    setValue("");
    setNote("");
    toast.success(`+${n} logged`);
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
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
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
