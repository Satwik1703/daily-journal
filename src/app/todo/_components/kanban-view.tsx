"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { formatShortDate, type DateString } from "@/lib/dates";
import { priorityMeta, type Todo } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

const COLUMNS = [3, 2, 1, 0];

export function KanbanView({
  todos,
  today,
  onOpen,
  onSetPriority,
}: {
  todos: Todo[];
  today: DateString;
  onOpen: (t: Todo) => void;
  onSetPriority: (t: Todo, p: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byCol = new Map<number, Todo[]>();
  for (const p of COLUMNS) byCol.set(p, []);
  for (const t of todos) byCol.get(t.priority >= 0 && t.priority <= 3 ? t.priority : 0)!.push(t);

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (overId == null) return;
    const col = Number(String(overId).replace("col-", ""));
    const t = todos.find((x) => x.id === e.active.id);
    if (t && t.priority !== col) onSetPriority(t, col);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((p) => (
          <Column key={p} priority={p} todos={byCol.get(p)!} today={today} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  priority,
  todos,
  today,
  onOpen,
}: {
  priority: number;
  todos: Todo[];
  today: DateString;
  onOpen: (t: Todo) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${priority}` });
  const meta = priorityMeta(priority);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-56 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2 transition-colors",
        isOver && "bg-muted/50 ring-2 ring-ring/30",
      )}
    >
      <div className="flex items-center gap-1.5 px-1 text-xs font-medium">
        <span className="size-2 rounded-full" style={{ backgroundColor: priority === 0 ? "var(--muted-foreground)" : meta.color }} />
        {meta.label}
        <span className="ml-auto tabular-nums text-muted-foreground">{todos.length}</span>
      </div>
      {todos.map((t) => (
        <Card key={t.id} t={t} today={today} onOpen={onOpen} />
      ))}
      {todos.length === 0 ? (
        <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/60">Drop here</p>
      ) : null}
    </div>
  );
}

function Card({ t, today, onOpen }: { t: Todo; today: DateString; onOpen: (t: Todo) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : undefined;
  const overdue = t.dueDate && t.dueDate < today;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border bg-card p-2.5 text-sm shadow-sm",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag card"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 active:cursor-grabbing"
        >
          ⠿
        </button>
        <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left outline-none">
          <span className={cn("block truncate", t.status !== "active" && "text-muted-foreground line-through")}>
            {t.title}
          </span>
          {t.dueDate ? (
            <span className={cn("mt-0.5 block text-[11px]", overdue ? "text-red-500" : "text-muted-foreground")}>
              {formatShortDate(t.dueDate)}
              {t.dueTime ? ` · ${t.dueTime}` : ""}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
