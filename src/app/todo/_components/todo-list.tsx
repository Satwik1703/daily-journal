"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar as CalIcon, Clock, Star, Check, ListChecks } from "lucide-react";
import { PriorityMenu, PriorityFlag } from "./priority-menu";
import { formatShortDate, type DateString } from "@/lib/dates";
import type { Todo, TodoList as TList } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

export type SubtaskCounts = Record<string, { done: number; total: number }>;

export function TodoListView({
  todos,
  listsById,
  subtasks,
  today,
  showList,
  reorderable,
  onToggle,
  onOpen,
  onPriority,
  onPin,
  onReorder,
}: {
  todos: Todo[];
  listsById: Map<string, TList>;
  subtasks: SubtaskCounts;
  today: DateString;
  showList: boolean;
  reorderable: boolean;
  onToggle: (t: Todo) => void;
  onOpen: (t: Todo) => void;
  onPriority: (t: Todo, p: number) => void;
  onPin: (t: Todo) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = todos.map((t) => t.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };

  const rows = todos.map((t) => (
    <SortableRow key={t.id} id={t.id} disabled={!reorderable}>
      {(handle) => (
        <Row
          todo={t}
          list={t.listId ? listsById.get(t.listId) : undefined}
          progress={subtasks[t.id]}
          today={today}
          showList={showList}
          handle={handle}
          onToggle={() => onToggle(t)}
          onOpen={() => onOpen(t)}
          onPriority={(p) => onPriority(t, p)}
          onPin={() => onPin(t)}
        />
      )}
    </SortableRow>
  ));

  if (!reorderable) return <div className="space-y-1.5">{rows}</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">{rows}</div>
      </SortableContext>
    </DndContext>
  );
}

type HandleProps = {
  ref: (el: HTMLElement | null) => void;
} & React.HTMLAttributes<HTMLElement>;

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: HandleProps | null) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const handle: HandleProps | null = disabled
    ? null
    : { ref: setActivatorNodeRef, ...attributes, ...listeners };
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

function Row({
  todo,
  list,
  progress,
  today,
  showList,
  handle,
  onToggle,
  onOpen,
  onPriority,
  onPin,
}: {
  todo: Todo;
  list: TList | undefined;
  progress: { done: number; total: number } | undefined;
  today: DateString;
  showList: boolean;
  handle: HandleProps | null;
  onToggle: () => void;
  onOpen: () => void;
  onPriority: (p: number) => void;
  onPin: () => void;
}) {
  const done = todo.status !== "active";
  const dueTone = todo.dueDate
    ? todo.dueDate < today
      ? "text-red-500"
      : todo.dueDate === today
        ? "text-amber-500"
        : "text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/30">
      {/* checkbox */}
      <button
        type="button"
        aria-label={done ? "Mark active" : "Complete"}
        onClick={onToggle}
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
        style={
          !done && todo.priority > 0
            ? { borderColor: priorityColor(todo.priority) }
            : !done
              ? { borderColor: "var(--border)" }
              : undefined
        }
      >
        {done ? <Check className="size-3" /> : null}
      </button>

      {/* body */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left outline-none"
      >
        <div
          className={cn(
            "truncate text-sm leading-snug",
            done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </div>
        {(todo.dueDate || (progress && progress.total > 0) || (showList && list)) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            {todo.dueDate ? (
              <span className={cn("inline-flex items-center gap-1", dueTone)}>
                <CalIcon className="size-3" />
                {formatShortDate(todo.dueDate)}
                {todo.dueTime ? (
                  <>
                    <Clock className="size-3" />
                    {todo.dueTime}
                  </>
                ) : null}
              </span>
            ) : null}
            {progress && progress.total > 0 ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ListChecks className="size-3" />
                {progress.done}/{progress.total}
              </span>
            ) : null}
            {showList && list ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                {list.emoji ? `${list.emoji} ` : ""}
                {list.name}
              </span>
            ) : null}
          </div>
        )}
      </button>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        <PriorityMenu value={todo.priority} onChange={onPriority}>
          <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <PriorityFlag priority={todo.priority} showNone />
          </span>
        </PriorityMenu>
        <button
          type="button"
          aria-label={todo.pinned ? "Unpin" : "Pin"}
          onClick={onPin}
          className={cn(
            "flex size-7 items-center justify-center rounded-md hover:bg-muted",
            todo.pinned ? "text-amber-500" : "text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          <Star className="size-3.5" fill={todo.pinned ? "currentColor" : "none"} />
        </button>
        {handle ? (
          <span
            {...handle}
            aria-label="Drag to reorder"
            className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted active:cursor-grabbing group-hover:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function priorityColor(p: number): string {
  return p === 3 ? "#ef4444" : p === 2 ? "#f59e0b" : p === 1 ? "#3b82f6" : "var(--border)";
}
