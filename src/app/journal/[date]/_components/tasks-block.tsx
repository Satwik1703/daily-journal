"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import TextareaAutosize from "react-textarea-autosize";
import { Plus, Trash2, Check, CalendarArrowUp } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { mutate } from "@/lib/sync/mutate";
import { TASK_KIND_HINTS, TASK_KIND_LABELS, TASK_KINDS, isTraceTask, type TaskKind } from "@/lib/task-meta";
import { addDays, shiftMonth, todayLocal, type DateString } from "@/lib/dates";
import type { JournalTask } from "@/db/queries/journal-tasks";

export function TasksBlock({ date, tasks }: { date: string; tasks: JournalTask[] }) {
  return (
    <div className="space-y-4">
      {TASK_KINDS.map((kind) => (
        <KindCard key={kind} date={date} kind={kind} tasks={tasks.filter((t) => t.kind === kind)} />
      ))}
    </div>
  );
}

function KindCard({ date, kind, tasks }: { date: string; kind: TaskKind; tasks: JournalTask[] }) {
  const [adding, setAdding] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [optimisticAdded, setOptimisticAdded] = useState<JournalTask[]>([]);
  const visibleServer = tasks.filter((t) => !hiddenIds.has(t.id));
  // Filter duplicates: server may already include the optimistic row.
  const visibleAdded = optimisticAdded.filter((t) => !tasks.some((s) => s.id === t.id));
  const visible = [...visibleServer, ...visibleAdded];

  function handleAdd(text: string) {
    if (!text.trim()) {
      setAdding(false);
      return;
    }
    const id = nanoid(12);
    const newTask: JournalTask = {
      id,
      date,
      kind,
      text,
      done: false,
      position: tasks.length + optimisticAdded.length,
    };
    setOptimisticAdded((arr) => [...arr, newTask]);
    void mutate("add_task", { id, date, kind, text });
    setAdding(false);
  }

  function handleHide(id: string) {
    setHiddenIds((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
    setOptimisticAdded((arr) => arr.filter((t) => t.id !== id));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <div className="flex flex-col gap-0.5">
            <span>{TASK_KIND_LABELS[kind]}</span>
            <span className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">
              {TASK_KIND_HINTS[kind]}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add ${TASK_KIND_LABELS[kind]}`}
            onClick={() => setAdding(true)}
          >
            <Plus />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {visible.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground/70 italic">Tap + to add</p>
        ) : null}
        {visible.map((t) => (
          <TaskRow key={t.id} task={t} onHide={() => handleHide(t.id)} />
        ))}
        {adding ? (
          <NewTaskInput onCancel={() => setAdding(false)} onSubmit={handleAdd} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, onHide }: { task: JournalTask; onHide: () => void }) {
  if (isTraceTask(task.text)) {
    return <TraceRow text={task.text} />;
  }
  return <ActiveTaskRow task={task} onHide={onHide} />;
}

function TraceRow({ text }: { text: string }) {
  // text format: "→ Moved to YYYY-MM-DD: excerpt"
  // We re-emit it as muted italics + strikethrough.
  return (
    <div className="flex items-start gap-2 rounded-md px-1 py-1 opacity-60">
      <span className="mt-1.5 size-5 shrink-0" aria-hidden />
      <span className="flex-1 px-2 py-1 text-sm italic leading-relaxed text-muted-foreground line-through">
        {text}
      </span>
    </div>
  );
}

function ActiveTaskRow({ task, onHide }: { task: JournalTask; onHide: () => void }) {
  const [text, setText] = useState(task.text);
  const [done, setDone] = useState(task.done);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(task.text);
    setDone(task.done);
  }, [task.id, task.text, task.done]);

  function scheduleTextSave(next: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void mutate("update_task_text", { id: task.id, text: next });
    }, 800);
  }

  return (
    <div className="group/task flex items-start gap-2 rounded-md px-1 py-1">
      <button
        type="button"
        aria-pressed={done}
        onClick={() => {
          setDone(!done);
          void mutate("toggle_task", { id: task.id });
        }}
        className={cn(
          "mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-foreground/40",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <TextareaAutosize
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleTextSave(e.target.value);
        }}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          void mutate("update_task_text", { id: task.id, text });
        }}
        minRows={1}
        placeholder="…"
        className={cn(
          "flex-1 resize-none rounded-md bg-transparent px-2 py-1 text-sm leading-relaxed outline-none transition focus:bg-muted/40",
          done && "text-muted-foreground line-through",
        )}
      />
      {!done ? <MoveTaskButton taskId={task.id} taskDate={task.date} onMoved={onHide} /> : null}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete task"
        className="opacity-50 hover:opacity-100"
        onClick={() => {
          onHide();
          void mutate("delete_task", { id: task.id });
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/**
 * Move-task affordance. One trigger (calendar-arrow icon), one popover.
 * Popup has two modes: "menu" (quick smart button + Pick date…) and
 * "picker" (embedded month-grid calendar). Stays inside this component to
 * avoid nesting two base-ui Popovers.
 */
function MoveTaskButton({
  taskId,
  taskDate,
  onMoved,
}: {
  taskId: string;
  taskDate: string;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "picker">("menu");
  const [month, setMonth] = useState<DateString>(taskDate);

  useEffect(() => {
    if (!open) setMode("menu");
  }, [open]);

  const today = todayLocal();
  const quickTarget = taskDate < today ? today : addDays(today, 1);
  const quickLabel = taskDate < today ? "Move to today" : "Move to tomorrow";

  function move(newDate: string) {
    if (newDate === taskDate) {
      toast.error("Same date");
      return;
    }
    setOpen(false);
    onMoved();
    void mutate("move_task", { id: taskId, newDate });
    toast.success(`Moved to ${newDate}`);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move task"
            className="opacity-50 hover:opacity-100"
          />
        }
      >
        <CalendarArrowUp />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="rounded-md border border-border bg-popover p-2 shadow-lg ring-1 ring-foreground/5 outline-none">
            {mode === "menu" ? (
              <div className="flex w-44 flex-col">
                <button
                  type="button"
                  disabled={quickTarget === taskDate}
                  onClick={() => move(quickTarget)}
                  className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  {quickLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("picker")}
                  className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  Pick date…
                </button>
              </div>
            ) : (
              <Calendar
                month={month}
                selected={taskDate}
                onSelect={(d) => move(d)}
                disableFuture={false}
                onPrevMonth={() => setMonth(shiftMonth(month, -1))}
                onNextMonth={() => setMonth(shiftMonth(month, 1))}
              />
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NewTaskInput({ onSubmit, onCancel }: { onSubmit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="flex items-start gap-2 rounded-md px-1 py-1">
      <span aria-hidden className="mt-1.5 size-5 shrink-0 rounded-md border border-dashed border-input" />
      <TextareaAutosize
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(text);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (text.trim()) onSubmit(text);
          else onCancel();
        }}
        minRows={1}
        placeholder="add and press enter"
        className="flex-1 resize-none rounded-md bg-muted/40 px-2 py-1 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
