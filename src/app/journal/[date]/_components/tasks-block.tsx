"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import TextareaAutosize from "react-textarea-autosize";
import { Plus, Trash2, Check, CalendarArrowUp, GripVertical } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
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
  const [reorderOverride, setReorderOverride] = useState<JournalTask[] | null>(null);
  const visibleServer = tasks.filter((t) => !hiddenIds.has(t.id));
  // Filter duplicates: server may already include the optimistic row.
  const visibleAdded = optimisticAdded.filter((t) => !tasks.some((s) => s.id === t.id));
  // If a local drag-reorder just happened, render that order until the server
  // refetch confirms (which clears the override).
  const visible = reorderOverride
    ? reorderOverride.filter(
        (t) => !hiddenIds.has(t.id) && (tasks.some((s) => s.id === t.id) || optimisticAdded.some((o) => o.id === t.id)),
      )
    : [...visibleServer, ...visibleAdded];

  // Drop the override once the server's task list reflects it.
  const tasksKey = tasks.map((t) => t.id).join(",");
  useEffect(() => {
    if (!reorderOverride) return;
    const serverOrder = tasks.map((t) => t.id).join(",");
    const overrideOrder = reorderOverride
      .filter((t) => tasks.some((s) => s.id === t.id))
      .map((t) => t.id)
      .join(",");
    if (serverOrder === overrideOrder) setReorderOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only active (non-trace) rows participate in drag-reorder. Trace stubs
  // render in place after the active list.
  const activeTasks = visible.filter((t) => !isTraceTask(t.text));
  const traceTasks = visible.filter((t) => isTraceTask(t.text));

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIndex = activeTasks.findIndex((t) => t.id === a.id);
    const newIndex = activeTasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextActive = arrayMove(activeTasks, oldIndex, newIndex);
    // Reassemble full visible list keeping trace tasks at the end.
    const nextFull = [...nextActive, ...traceTasks];
    setReorderOverride(nextFull);
    void mutate("reorder_tasks", {
      date,
      kind,
      orderedIds: nextActive.map((t) => t.id),
    });
  }

  function handleAdd(text: string) {
    if (!text.trim()) {
      setAdding(false);
      return;
    }
    const id = nanoid(12);
    const newTask: JournalTask = {
      id,
      userId: "",
      date,
      kind,
      text,
      done: false,
      position: tasks.length + optimisticAdded.length,
      movedToDate: null,
    };
    setOptimisticAdded((arr) => [...arr, newTask]);
    void mutate("add_task", { id, date, kind, text });
    setAdding(false);
  }

  function handleHide(id: string): () => void {
    let removedOptimistic: JournalTask | undefined;
    setHiddenIds((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
    setOptimisticAdded((arr) => {
      removedOptimistic = arr.find((t) => t.id === id);
      return arr.filter((t) => t.id !== id);
    });
    return () => {
      setHiddenIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      if (removedOptimistic) {
        const restored = removedOptimistic;
        setOptimisticAdded((arr) => [...arr, restored]);
      }
    };
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
        {activeTasks.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {activeTasks.map((t) => (
                <SortableTaskRow key={t.id} task={t} onHide={() => handleHide(t.id)} />
              ))}
            </SortableContext>
          </DndContext>
        ) : null}
        {traceTasks.map((t) => (
          <TraceRow key={t.id} text={t.text} movedToDate={t.movedToDate ?? null} />
        ))}
        {adding ? (
          <NewTaskInput onCancel={() => setAdding(false)} onSubmit={handleAdd} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SortableTaskRow({ task, onHide }: { task: JournalTask; onHide: () => () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <ActiveTaskRow
        task={task}
        onHide={onHide}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

function TraceRow({ text, movedToDate }: { text: string; movedToDate: string | null }) {
  // Phase 11.1: when movedToDate is set, wrap in a Link to navigate to the
  // target. Falls back to plain span for legacy trace rows without the
  // structured pointer column.
  const inner = (
    <span className="flex-1 px-2 py-1 text-sm italic leading-relaxed text-muted-foreground line-through">
      {text}
    </span>
  );
  return (
    <div className="flex items-start gap-2 rounded-md px-1 py-1 opacity-60">
      <span className="mt-1.5 size-5 shrink-0" aria-hidden />
      {movedToDate ? (
        <Link
          href={`/journal/${movedToDate}`}
          className="flex-1 hover:opacity-80"
          title={`Jump to ${movedToDate}`}
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

type DragHandleProps = React.HTMLAttributes<HTMLButtonElement>;

function ActiveTaskRow({
  task,
  onHide,
  dragHandleProps,
  isDragging = false,
}: {
  task: JournalTask;
  onHide: () => () => void;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
}) {
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
    <div
      className={cn(
        "group/task flex items-start gap-1 rounded-md px-1 py-1",
        isDragging && "bg-muted/40 shadow-sm",
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="-ml-1 mt-1.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 opacity-0 hover:text-foreground/70 active:cursor-grabbing group-hover/task:opacity-100"
          {...dragHandleProps}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
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
  onMoved: () => unknown;
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
