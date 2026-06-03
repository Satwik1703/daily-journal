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
import { useRef, useState } from "react";
import { GripVertical, Calendar as CalIcon, Clock, Star, Check, ListChecks, Repeat } from "lucide-react";
import { PriorityMenu, PriorityFlag } from "./priority-menu";
import { TagChips } from "./tag-picker";
import { formatShortDate, type DateString } from "@/lib/dates";
import type { Todo, TodoList as TList, TodoTag } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

export type SubtaskCounts = Record<string, { done: number; total: number }>;

export function TodoListView({
  todos,
  listsById,
  subtasks,
  tagsByTodo,
  today,
  showList,
  reorderable,
  selectMode = false,
  selectedIds,
  onSelect,
  onToggle,
  onOpen,
  onPriority,
  onPin,
  onDelete,
  onReschedule,
  onReorder,
}: {
  todos: Todo[];
  listsById: Map<string, TList>;
  subtasks: SubtaskCounts;
  tagsByTodo: Record<string, TodoTag[]>;
  today: DateString;
  showList: boolean;
  reorderable: boolean;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onToggle: (t: Todo) => void;
  onOpen: (t: Todo) => void;
  onPriority: (t: Todo, p: number) => void;
  onPin: (t: Todo) => void;
  onDelete?: (t: Todo) => void;
  onReschedule?: (t: Todo) => void;
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

  const canReorder = reorderable && !selectMode;
  const rows = todos.map((t) => (
    <SortableRow key={t.id} id={t.id} disabled={!canReorder}>
      {(handle) => (
        <Row
          todo={t}
          list={t.listId ? listsById.get(t.listId) : undefined}
          progress={subtasks[t.id]}
          tags={tagsByTodo[t.id]}
          today={today}
          showList={showList}
          handle={handle}
          selectMode={selectMode}
          selected={selectedIds?.has(t.id) ?? false}
          onSelect={() => onSelect?.(t.id)}
          onToggle={() => onToggle(t)}
          onOpen={() => onOpen(t)}
          onPriority={(p) => onPriority(t, p)}
          onPin={() => onPin(t)}
          onDelete={onDelete ? () => onDelete(t) : undefined}
          onReschedule={onReschedule ? () => onReschedule(t) : undefined}
        />
      )}
    </SortableRow>
  ));

  if (!canReorder) return <div className="space-y-1.5">{rows}</div>;

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
  tags,
  today,
  showList,
  handle,
  selectMode,
  selected,
  onSelect,
  onToggle,
  onOpen,
  onPriority,
  onPin,
  onDelete,
  onReschedule,
}: {
  todo: Todo;
  list: TList | undefined;
  progress: { done: number; total: number } | undefined;
  tags: TodoTag[] | undefined;
  today: DateString;
  showList: boolean;
  handle: HandleProps | null;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onOpen: () => void;
  onPriority: (p: number) => void;
  onPin: () => void;
  onDelete?: () => void;
  onReschedule?: () => void;
}) {
  const done = todo.status !== "active";

  // Horizontal swipe: right = complete, left = reschedule. Disabled in select mode.
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; active: boolean; swiping: boolean }>({ x: 0, y: 0, active: false, swiping: false });
  const suppressClick = useRef(false);
  const SWIPE_TRIGGER = 80;
  const swipeProgress = Math.min(Math.abs(dx) / SWIPE_TRIGGER, 1); // 0..1
  const armed = Math.abs(dx) >= SWIPE_TRIGGER;

  const onPointerDown = (e: React.PointerEvent) => {
    if (selectMode) return;
    startRef.current = { x: e.clientX, y: e.clientY, active: true, swiping: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s.active) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.swiping) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
        s.swiping = true;
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(ddy) > 10) {
        s.active = false; // vertical scroll — bail
        return;
      }
    }
    if (s.swiping) {
      // Slight rubber-banding past the trigger so it feels springy.
      const clamped = Math.max(-140, Math.min(140, ddx));
      setDx(clamped);
    }
  };
  const onPointerUp = () => {
    const s = startRef.current;
    if (s.swiping) {
      if (dx >= SWIPE_TRIGGER) {
        onToggle();
        suppressClick.current = true;
      } else if (dx <= -SWIPE_TRIGGER && onReschedule) {
        onReschedule();
        suppressClick.current = true;
      }
    }
    startRef.current = { x: 0, y: 0, active: false, swiping: false };
    setDragging(false);
    setDx(0);
  };

  const guardedOpen = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selectMode) onSelect();
    else onOpen();
  };

  const dueTone = todo.dueDate
    ? todo.dueDate < today
      ? "text-red-500"
      : todo.dueDate === today
        ? "text-amber-500"
        : "text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* swipe action fills: right = complete (green), left = reschedule (amber) */}
      {dx > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-lg pl-4 transition-colors",
            armed ? "bg-primary/30" : "bg-primary/15",
          )}
          style={{ width: Math.max(0, dx) }}
        >
          <Check
            className="size-4 text-primary"
            style={{ opacity: Math.min(dx / 24, 1), transform: `scale(${0.6 + 0.6 * swipeProgress})` }}
          />
        </div>
      ) : null}
      {dx < 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end rounded-lg pr-4 transition-colors",
            armed ? "bg-amber-500/30" : "bg-amber-500/15",
          )}
          style={{ width: Math.max(0, -dx) }}
        >
          <CalIcon
            className="size-4 text-amber-500"
            style={{ opacity: Math.min(-dx / 24, 1), transform: `scale(${0.6 + 0.6 * swipeProgress})` }}
          />
        </div>
      ) : null}
      <div
        className={cn(
          "group flex touch-pan-y items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted/30",
          selected && "ring-2 ring-primary/50",
          dragging ? "transition-none" : "transition-transform duration-200 ease-out",
        )}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
      {/* checkbox / selection */}
      <button
        type="button"
        aria-label={selectMode ? "Select" : done ? "Mark active" : "Complete"}
        onClick={selectMode ? onSelect : onToggle}
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selectMode
            ? selected
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
            : done
              ? "border-transparent bg-primary text-primary-foreground"
              : "hover:bg-muted",
        )}
        style={
          !selectMode && !done && todo.priority > 0
            ? { borderColor: priorityColor(todo.priority) }
            : !selectMode && !done
              ? { borderColor: "var(--border)" }
              : undefined
        }
      >
        {(selectMode ? selected : done) ? <Check className="size-3" /> : null}
      </button>

      {/* body */}
      <button
        type="button"
        onClick={guardedOpen}
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
        {(todo.dueDate || todo.repeatJson || (progress && progress.total > 0) || (showList && list) || (tags && tags.length > 0)) && (
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
            {todo.repeatJson ? <Repeat className="size-3 text-muted-foreground" /> : null}
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
            {tags && tags.length ? <TagChips tags={tags} /> : null}
          </div>
        )}
      </button>

      {/* actions */}
      {!selectMode ? (
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
      ) : null}
      </div>
    </div>
  );
}

function priorityColor(p: number): string {
  return p === 3 ? "#ef4444" : p === 2 ? "#f59e0b" : p === 1 ? "#3b82f6" : "var(--border)";
}
