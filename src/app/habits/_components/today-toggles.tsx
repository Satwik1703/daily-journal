"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { customAlphabet } from "nanoid";
import { Check, ChevronRight, History, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Popover } from "@base-ui/react/popover";
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
import {
  computeRowRatio,
  hexToRgba,
  isHabitDoneOnDate,
  LEVEL_THRESHOLDS,
  levelFor,
  levelProgress,
  MAX_LEVEL,
  nextLevelAt,
  type HabitTrackingKind,
} from "@/lib/habit-meta";
import { ProgressDonut } from "@/components/ui/progress-donut";
import type { Habit, HabitValueLogRow } from "@/db/queries/habits";
import type { Book } from "@/db/queries/books";

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
  valueLogsByHabit,
  xpByHabit,
  readingBooks,
  activeBookId,
}: {
  anchor: string;
  isToday: boolean;
  habits: Habit[];
  doneIds: string[];
  /** Sum of habit_value_logs.value on `anchor` per number-kind habit id. */
  valueAtAnchor: Record<string, number>;
  /** Count of pomodoro_sessions on `anchor` per pomo-kind habit id. */
  pomoCountAtAnchor: Record<string, number>;
  /** Today's individual value-log rows per number habit id (for the history popover). */
  valueLogsByHabit?: Record<string, HabitValueLogRow[]>;
  /** All-time XP per habit id, derived server-side. Used for the Lv chip. */
  xpByHabit?: Record<string, number>;
  /** Books in `status='reading'` to surface in the Read habit's Log dialog. */
  readingBooks?: Book[];
  /** Default book to pre-select when logging against the Read habit. */
  activeBookId?: string | null;
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

  // Reconcile number overlay against server. Direction-aware so the same
  // pattern works for both Log (positive delta) and Delete-history (negative
  // delta) — clear the overlay once the server's reported sum has moved past
  // the expected post-mutation value.
  const valuesKey = JSON.stringify(valueAtAnchor);
  useEffect(() => {
    setValueOverlay((m) => {
      if (m.size === 0) return m;
      const next = new Map(m);
      let changed = false;
      for (const [id, { delta, baseline }] of m) {
        const currentServer = valueAtAnchor[id] ?? 0;
        const expected = baseline + delta;
        const met = delta >= 0 ? currentServer >= expected : currentServer <= expected;
        if (met) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  // Optimistic-hidden value-log row ids. Reconciliation: drop entries whose
  // log no longer appears in the freshly fetched valueLogsByHabit (server
  // confirmed the delete).
  const [hiddenLogIds, setHiddenLogIds] = useState<Set<string>>(() => new Set());
  const logIdsKey = useMemo(() => {
    if (!valueLogsByHabit) return "";
    return Object.values(valueLogsByHabit)
      .flat()
      .map((r) => r.id)
      .sort()
      .join(",");
  }, [valueLogsByHabit]);
  useEffect(() => {
    if (!valueLogsByHabit) return;
    const presentIds = new Set(
      Object.values(valueLogsByHabit).flatMap((arr) => arr.map((r) => r.id)),
    );
    setHiddenLogIds((s) => {
      if (s.size === 0) return s;
      const next = new Set(s);
      let changed = false;
      for (const id of s) {
        if (!presentIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logIdsKey]);

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
          const xp = xpByHabit?.[h.id] ?? 0;
          if (kind === "binary") {
            const ratio = computeRowRatio("binary", null, 0, done);
            return (
              <BinaryRow
                key={h.id}
                habit={h}
                done={done}
                ratio={ratio}
                xp={xp}
                onFlip={(next) => {
                  flipDone(h.id, next);
                  void mutate("toggle_habit", { habitId: h.id, date: anchor });
                }}
              />
            );
          }
          if (kind === "number") {
            const todaysLogs = (valueLogsByHabit?.[h.id] ?? []).filter(
              (l) => !hiddenLogIds.has(l.id),
            );
            // Surface book picker on the Read habit (heuristic: pages-unit OR name).
            const isReadHabit =
              (h.unit ?? "").toLowerCase() === "pages" ||
              h.name.trim().toLowerCase() === "read";
            const valueToday = valueFor(h.id);
            const ratio = computeRowRatio("number", h.dailyTarget, valueToday, false);
            return (
              <NumberRow
                key={h.id}
                habit={h}
                anchor={anchor}
                done={done}
                ratio={ratio}
                valueToday={valueToday}
                onLogValue={(delta) => addValue(h.id, delta)}
                xp={xp}
                todaysLogs={todaysLogs}
                onDeleteLog={(log) => {
                  setHiddenLogIds((s) => {
                    const next = new Set(s);
                    next.add(log.id);
                    return next;
                  });
                  addValue(h.id, -log.value);
                  void mutate("delete_habit_value_log", { id: log.id });
                }}
                books={isReadHabit ? readingBooks ?? [] : undefined}
                activeBookId={isReadHabit ? activeBookId ?? null : null}
              />
            );
          }
          const sessionsToday = pomoCountAtAnchor[h.id] ?? 0;
          const ratio = computeRowRatio("pomodoro", h.dailyTarget, sessionsToday, false);
          return (
            <PomoRow
              key={h.id}
              habit={h}
              anchor={anchor}
              done={done}
              ratio={ratio}
              sessionsToday={sessionsToday}
              xp={xp}
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
  ratio,
  onFlip,
  xp,
}: {
  habit: Habit;
  done: boolean;
  ratio: number;
  onFlip: (next: boolean) => void;
  xp: number;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={done}
      onClick={() => onFlip(!done)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip(!done);
        }
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 text-left transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        done ? "border-transparent text-foreground" : "border-border hover:bg-muted/40",
      )}
      style={rowStyle(habit.color, ratio)}
    >
      <RowFill color={habit.color} ratio={ratio} />
      <DonutGlyph habit={habit} ratio={ratio} done={done} />
      <span className="relative z-10 min-w-0 flex-1 truncate font-medium">{habit.name}</span>
      <span
        className={cn(
          "relative z-10 text-xs uppercase tracking-wider",
          done ? "text-foreground/70" : "text-muted-foreground/60",
        )}
      >
        {done ? "Done" : "Tap to log"}
      </span>
      <LevelChip xp={xp} color={habit.color} habitName={habit.name} difficulty={habit.difficulty ?? 1} />
    </div>
  );
}

// ---------- Number ----------

function NumberRow({
  habit,
  anchor,
  done,
  ratio,
  valueToday,
  onLogValue,
  xp,
  todaysLogs,
  onDeleteLog,
  books,
  activeBookId,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  ratio: number;
  valueToday: number;
  onLogValue: (delta: number) => void;
  xp: number;
  todaysLogs: HabitValueLogRow[];
  onDeleteLog: (log: HabitValueLogRow) => void;
  books?: Book[];
  activeBookId?: string | null;
}) {
  const target = habit.dailyTarget ?? 0;
  const trulyDone = isHabitDoneOnDate("number", target || null, valueToday, false) || done;

  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 text-left",
        trulyDone ? "border-transparent" : "border-border",
      )}
      style={rowStyle(habit.color, ratio)}
    >
      <RowFill color={habit.color} ratio={ratio} />
      <DonutGlyph habit={habit} ratio={ratio} done={trulyDone} />
      <div className="relative z-10 min-w-0 flex-1">
        <span className="truncate font-medium">{habit.name}</span>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {formatValue(valueToday)} / {formatValue(target)}
          {habit.unit ? ` ${habit.unit}` : ""}
        </div>
      </div>
      {todaysLogs.length > 0 ? (
        <div className="relative z-10">
          <DeltasHistoryButton logs={todaysLogs} unit={habit.unit} onDelete={onDeleteLog} />
        </div>
      ) : null}
      <div className="relative z-10">
        <LogValueButton
          habitId={habit.id}
          anchor={anchor}
          unit={habit.unit}
          onLogged={onLogValue}
          books={books}
          activeBookId={activeBookId}
        />
      </div>
      <LevelChip xp={xp} color={habit.color} habitName={habit.name} difficulty={habit.difficulty ?? 1} />
    </div>
  );
}

function DeltasHistoryButton({
  logs,
  unit,
  onDelete,
}: {
  logs: HabitValueLogRow[];
  unit: string | null;
  onDelete: (log: HabitValueLogRow) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Today's logs (${logs.length})`}
            className="size-7 rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground"
          />
        }
      >
        <History className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md w-72 max-w-[calc(100vw-1rem)]">
            <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Today&apos;s entries
            </p>
            <ul className="space-y-0.5">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="font-medium tabular-nums">
                    {log.value > 0 ? "+" : ""}
                    {formatValue(log.value)}
                  </span>
                  {unit ? (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {unit}
                    </span>
                  ) : null}
                  <span className="text-[10px] text-muted-foreground/70">
                    {formatLogTime(log.createdAt)}
                  </span>
                  {log.note ? (
                    <span className="truncate text-xs text-muted-foreground italic">
                      &ldquo;{log.note}&rdquo;
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => onDelete(log)}
                    className="ml-auto rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatLogTime(ts: Date | number | string | null | undefined): string {
  if (ts == null) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function LogValueButton({
  habitId,
  anchor,
  unit,
  onLogged,
  books,
  activeBookId,
}: {
  habitId: string;
  anchor: string;
  unit: string | null;
  onLogged: (delta: number) => void;
  books?: Book[];
  activeBookId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [bookId, setBookId] = useState<string | null>(activeBookId ?? null);

  // Reset the book pick to the current default whenever the dialog opens.
  useEffect(() => {
    if (open) setBookId(activeBookId ?? null);
  }, [open, activeBookId]);

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
      bookId: bookId ?? undefined,
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
          {books && books.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Book</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setBookId(null)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    bookId == null
                      ? "border-primary bg-primary/10"
                      : "border-input text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  No book
                </button>
                {books.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBookId(b.id)}
                    className={cn(
                      "max-w-[200px] truncate rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      bookId === b.id
                        ? "border-primary bg-primary/10"
                        : "border-input text-muted-foreground hover:bg-muted/40",
                    )}
                    style={
                      bookId === b.id
                        ? { borderColor: b.color, color: "inherit" }
                        : undefined
                    }
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
  ratio,
  sessionsToday,
  xp,
}: {
  habit: Habit;
  anchor: string;
  done: boolean;
  ratio: number;
  sessionsToday: number;
  xp: number;
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
        "relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 text-left transition-all hover:bg-muted/40",
        trulyDone ? "border-transparent" : "border-border",
      )}
      style={rowStyle(habit.color, ratio)}
    >
      <RowFill color={habit.color} ratio={ratio} />
      <DonutGlyph habit={habit} ratio={ratio} done={trulyDone} />
      <div className="relative z-10 min-w-0 flex-1">
        <span className="truncate font-medium">{habit.name}</span>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {sessionsToday} / {formatValue(target)} session{target === 1 ? "" : "s"}
        </div>
      </div>
      <span className="relative z-10 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Start
        <ChevronRight className="size-3" />
      </span>
      <LevelChip xp={xp} color={habit.color} habitName={habit.name} difficulty={habit.difficulty ?? 1} />
    </Link>
  );
}

// ---------- Level chip ----------

/**
 * Always-visible level chip rendered on the right edge of every habit row.
 * Tap to open a gamified detail popover: current/next thresholds, %, full XP
 * history at-a-glance, and the difficulty multiplier.
 */
function LevelChip({
  xp,
  color,
  habitName,
  difficulty,
}: {
  xp: number;
  color: string;
  habitName: string;
  difficulty: number;
}) {
  const lvl = levelFor(xp);
  const next = nextLevelAt(xp);
  const pct = Math.round(levelProgress(xp) * 100);
  const xpInLvl = Math.max(0, xp - LEVEL_THRESHOLDS[lvl - 1]);
  const xpToNext = next == null ? 0 : next - xp;
  const lvlSpan = next == null ? 0 : next - LEVEL_THRESHOLDS[lvl - 1];

  return (
    <Popover.Root>
      <Popover.Trigger
        onClick={(e) => {
          // Prevent the surrounding row (button/Link) from receiving the tap.
          e.stopPropagation();
        }}
        render={
          <button
            type="button"
            aria-label={`Level ${lvl} — ${xp} XP`}
            className="relative z-10 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-medium tabular-nums transition-colors hover:bg-foreground/5"
            style={{
              background: hexToRgba(color, 0.18),
              borderColor: hexToRgba(color, 0.5),
            }}
          />
        }
      >
        Lv {lvl}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50 outline-none">
          <Popover.Popup className="w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif text-base leading-tight">{habitName}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Level {lvl}{next == null ? " · max" : ""}
                  </div>
                </div>
                <div
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: hexToRgba(color, 0.22),
                    color: "inherit",
                    borderColor: hexToRgba(color, 0.5),
                  }}
                >
                  Lv {lvl}
                </div>
              </div>

              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: color,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                  <span>
                    {next == null
                      ? `Max level reached`
                      : `${xpInLvl} / ${lvlSpan} XP`}
                  </span>
                  <span>{pct}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 pt-1">
                <Stat label="Total XP" value={xp.toLocaleString()} />
                <Stat label="To next" value={next == null ? "—" : xpToNext.toLocaleString()} />
                <Stat label="Difficulty" value={`×${difficulty.toFixed(1)}`} />
              </div>

              <div className="border-t border-border pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Levels
              </div>
              <ol className="space-y-0.5 text-[11px]">
                {LEVEL_THRESHOLDS.map((t, i) => {
                  const level = i + 1;
                  const reached = xp >= t;
                  const current = level === lvl;
                  return (
                    <li
                      key={level}
                      className={cn(
                        "flex items-center justify-between rounded px-1.5 py-0.5",
                        current && "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "tabular-nums",
                          !reached && "text-muted-foreground/50",
                          current && "font-medium",
                        )}
                      >
                        Lv {level}
                        {level === MAX_LEVEL ? " (max)" : ""}
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          !reached && "text-muted-foreground/50",
                        )}
                      >
                        {t.toLocaleString()} XP
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-sm tabular-nums">{value}</div>
    </div>
  );
}

// ---------- shared ----------

/**
 * Donut-wrapped emoji. Outer ring is a small ProgressDonut tracing `ratio`
 * with the habit's color, emoji sits centered inside. When the day's target
 * is fully met (ratio >= 1) the inner background fills with the habit color
 * and the emoji turns into a check.
 */
function DonutGlyph({
  habit,
  ratio,
  done,
}: {
  habit: Habit;
  ratio: number;
  done: boolean;
}) {
  const fully = done || ratio >= 1;
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <span className="relative z-10 inline-flex shrink-0 items-center justify-center">
      <ProgressDonut
        percent={pct}
        size={36}
        strokeWidth={4}
        color={habit.color}
        trackColor="rgba(125,125,125,0.18)"
        label={
          <span
            aria-hidden
            className={cn(
              "flex size-[26px] items-center justify-center rounded-full text-base leading-none transition-colors",
              fully ? "text-white" : "text-muted-foreground",
            )}
            style={fully ? { backgroundColor: habit.color } : undefined}
          >
            {fully ? <Check className="size-3.5" strokeWidth={3} /> : (habit.emoji ?? "•")}
          </span>
        }
      />
    </span>
  );
}

/** Inline style for the row container: solid color tint only when fully met;
 * partial ratios are rendered via the absolute-positioned `<RowFill />`. */
function rowStyle(color: string, ratio: number): React.CSSProperties {
  if (ratio >= 1) {
    return {
      backgroundColor: hexToRgba(color, 0.18),
      borderColor: hexToRgba(color, 0.5),
    };
  }
  return {};
}

/** Horizontal progress bar painted behind the row contents. Ratio 0..1. */
function RowFill({ color, ratio }: { color: string; ratio: number }) {
  if (ratio <= 0 || ratio >= 1) return null;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 z-0"
      style={{
        width: `${pct}%`,
        background: `linear-gradient(to right, ${hexToRgba(color, 0.22)}, ${hexToRgba(color, 0.12)})`,
      }}
    />
  );
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

