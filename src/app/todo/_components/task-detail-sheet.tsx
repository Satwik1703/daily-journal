"use client";

import { useEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Calendar as CalIcon,
  Flag,
  Trash2,
  Ban,
  Check,
  Plus,
  CircleSlash,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { mutate } from "@/lib/sync/mutate";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import { nanoid } from "nanoid";
import { formatShortDate, type DateString } from "@/lib/dates";
import {
  priorityMeta,
  type Todo,
  type TodoList,
  type TodoTag,
  type TodoSection,
} from "@/lib/todo/todo-meta";
import { DueDatePopover } from "./due-date-popover";
import { PriorityMenu } from "./priority-menu";
import { TagPicker } from "./tag-picker";
import { RepeatEditor } from "./repeat-editor";
import { describeRule, parseRule } from "@/lib/todo/recurrence";
import { Hash, Rows3, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskDetailSheet({
  todo,
  lists,
  allTags,
  initialTags,
  sections,
  today,
  open,
  onOpenChange,
}: {
  todo: Todo | null;
  lists: TodoList[];
  allTags: TodoTag[];
  initialTags: TodoTag[];
  sections: TodoSection[];
  today: DateString;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState<DateString | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [status, setStatus] = useState<Todo["status"]>("active");
  const [tags, setTags] = useState<TodoTag[]>([]);
  const [repeatJson, setRepeatJson] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Todo[]>([]);
  const [newSub, setNewSub] = useState("");

  // Seed local state when a new todo opens.
  useEffect(() => {
    if (!todo) return;
    setTitle(todo.title);
    setNote(todo.note ?? "");
    setPriority(todo.priority);
    setDueDate(todo.dueDate);
    setDueTime(todo.dueTime);
    setListId(todo.listId);
    setSectionId(todo.sectionId);
    setStatus(todo.status);
    setTags(initialTags);
    setRepeatJson(todo.repeatJson);
    setSubtasks([]);
    // Fetch subtasks lazily.
    let cancelled = false;
    authAwareFetch(`/api/page/todo-detail/${todo.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { subtasks: [] }))
      .then((d) => {
        if (!cancelled) setSubtasks(d.subtasks ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todo]);

  if (!todo) return null;
  const id = todo.id;
  const currentList = listId ? lists.find((l) => l.id === listId) : null;

  const patch = (fields: Record<string, unknown>) => void mutate("update_todo", { id, ...fields });

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== todo.title) patch({ title: t });
  };
  const saveNote = () => {
    if ((note.trim() || null) !== (todo.note ?? null)) patch({ note: note.trim() || null });
  };

  const setPriorityNow = (p: number) => {
    setPriority(p);
    patch({ priority: p });
  };
  const setDueNow = (d: DateString | null, tm: string | null) => {
    setDueDate(d);
    setDueTime(tm);
    patch({ dueDate: d, dueTime: tm });
  };
  const setListNow = (lid: string | null) => {
    setListId(lid);
    setSectionId(null);
    void mutate("move_todo_to_list", { id, listId: lid });
  };
  const setSectionNow = (sid: string | null) => {
    setSectionId(sid);
    void mutate("move_todo_to_section", { id, sectionId: sid });
  };
  const setTagsNow = (next: TodoTag[]) => {
    setTags(next);
    void mutate("set_todo_tags", { todoId: id, tagIds: next.map((t) => t.id) });
  };
  const setRepeatNow = (json: string | null) => {
    setRepeatJson(json);
    void mutate("update_todo", { id, repeatJson: json });
  };
  const toggleDone = () => {
    const next = status === "active" ? "done" : "active";
    setStatus(next);
    void mutate("toggle_todo", { id });
  };
  const markWontDo = () => {
    setStatus("wontDo");
    void mutate("set_todo_status", { id, status: "wontDo" });
    onOpenChange(false);
  };
  const del = () => {
    void mutate("delete_todo", { id });
    onOpenChange(false);
  };

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    const subId = nanoid(12);
    setSubtasks((s) => [
      ...s,
      {
        id: subId,
        listId,
        parentId: id,
        sectionId: null,
        title: t,
        note: null,
        priority: 0,
        status: "active",
        completedAt: null,
        dueDate: null,
        dueTime: null,
        isAllDay: true,
        repeatJson: null,
        pinned: false,
        position: s.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    setNewSub("");
    void mutate("create_todo", { id: subId, title: t, parentId: id, listId });
  };
  const toggleSub = (s: Todo) => {
    setSubtasks((arr) =>
      arr.map((x) => (x.id === s.id ? { ...x, status: x.status === "active" ? "done" : "active" } : x)),
    );
    void mutate("toggle_todo", { id: s.id });
  };
  const delSub = (s: Todo) => {
    setSubtasks((arr) => arr.filter((x) => x.id !== s.id));
    void mutate("delete_todo", { id: s.id });
  };

  const done = status !== "active";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label={done ? "Mark active" : "Complete"}
              onClick={toggleDone}
              className={cn(
                "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                done ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              style={!done && priority > 0 ? { borderColor: priorityMeta(priority).color } : undefined}
            >
              {done ? <Check className="size-3" /> : null}
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-base font-medium outline-none",
                done && "text-muted-foreground line-through",
              )}
            />
          </div>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-4">
          {/* attribute chips */}
          <div className="flex flex-wrap gap-2">
            <DueDatePopover date={dueDate} time={dueTime} onChange={setDueNow}>
              <AttrChip active={!!dueDate}>
                <CalIcon className="size-3.5" />
                {dueDate ? (
                  <>
                    {formatShortDate(dueDate)}
                    {dueTime ? ` · ${dueTime}` : ""}
                  </>
                ) : (
                  "Due date"
                )}
              </AttrChip>
            </DueDatePopover>

            <PriorityMenu value={priority} onChange={setPriorityNow}>
              <AttrChip active={priority > 0} color={priority > 0 ? priorityMeta(priority).color : undefined}>
                <Flag className="size-3.5" />
                {priority > 0 ? priorityMeta(priority).label : "Priority"}
              </AttrChip>
            </PriorityMenu>

            <DropdownMenu>
              <DropdownMenuTrigger render={<span className="inline-flex outline-none" />}>
                <AttrChip active={!!currentList}>
                  {currentList ? (
                    <span className="size-2 rounded-full" style={{ backgroundColor: currentList.color }} />
                  ) : null}
                  {currentList ? currentList.name : "Inbox"}
                  <ChevronDown className="size-3" />
                </AttrChip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setListNow(null)}>Inbox</DropdownMenuItem>
                {lists
                  .filter((l) => l.kind === "list")
                  .map((l) => (
                    <DropdownMenuItem key={l.id} onClick={() => setListNow(l.id)} className="gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.emoji ? `${l.emoji} ` : ""}
                      {l.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <TagPicker allTags={allTags} selected={tags} onChange={setTagsNow}>
              <AttrChip active={tags.length > 0}>
                <Hash className="size-3.5" />
                {tags.length ? tags.map((t) => t.name).join(", ") : "Tags"}
              </AttrChip>
            </TagPicker>

            <RepeatEditor value={repeatJson} onChange={setRepeatNow}>
              <AttrChip active={!!repeatJson}>
                <Repeat className="size-3.5" />
                {repeatJson ? (parseRule(repeatJson) ? describeRule(parseRule(repeatJson)!) : "Repeat") : "Repeat"}
              </AttrChip>
            </RepeatEditor>

            {sections.length > 0 && sections[0].listId === listId ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<span className="inline-flex outline-none" />}>
                  <AttrChip active={!!sectionId}>
                    <Rows3 className="size-3.5" />
                    {sectionId
                      ? (sections.find((s) => s.id === sectionId)?.name ?? "Section")
                      : "Section"}
                  </AttrChip>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setSectionNow(null)}>No section</DropdownMenuItem>
                  {sections.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => setSectionNow(s.id)}>
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {/* note */}
          <TextareaAutosize
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder="Notes…"
            minRows={2}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />

          {/* subtasks */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Subtasks</div>
            <div className="space-y-1">
              {subtasks.map((s) => {
                const sDone = s.status !== "active";
                return (
                  <div key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1">
                    <button
                      type="button"
                      onClick={() => toggleSub(s)}
                      aria-label={sDone ? "Mark active" : "Complete"}
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                        sDone ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                      )}
                    >
                      {sDone ? <Check className="size-2.5" /> : null}
                    </button>
                    <span className={cn("flex-1 text-sm", sDone && "text-muted-foreground line-through")}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => delSub(s)}
                      aria-label="Delete subtask"
                      className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center gap-2 px-1">
              <Plus className="size-3.5 text-muted-foreground" />
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSub();
                  }
                }}
                placeholder="Add subtask"
                className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          {/* footer actions */}
          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            {repeatJson ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void mutate("skip_recurrence", { id });
                  onOpenChange(false);
                }}
                className="gap-1.5"
              >
                <Repeat className="size-3.5" /> Skip
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={markWontDo} className="gap-1.5">
              <Ban className="size-3.5" /> Won&apos;t do
            </Button>
            {status === "wontDo" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CircleSlash className="size-3.5" /> Marked won&apos;t do
              </span>
            ) : null}
            <Button variant="destructive" size="sm" onClick={del} className="ml-auto gap-1.5">
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AttrChip({
  children,
  active,
  color,
}: {
  children: React.ReactNode;
  active?: boolean;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active ? "border-border bg-muted/60 text-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted/40",
      )}
      style={active && color ? { color, borderColor: `${color}66` } : undefined}
    >
      {children}
    </span>
  );
}
