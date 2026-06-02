"use client";

import { useState } from "react";
import { Plus, Flag, Calendar as CalIcon, Clock, Hash, Folder } from "lucide-react";
import { parseQuickAdd } from "@/lib/todo/quick-parse";
import { priorityMeta, type TodoList } from "@/lib/todo/todo-meta";
import { formatShortDate, type DateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function QuickAdd({
  today,
  lists,
  placeholder = "Add a task…  try \"pay rent !high tomorrow 6pm\"",
  onSubmit,
  inputRef,
}: {
  today: DateString;
  lists: TodoList[];
  placeholder?: string;
  onSubmit: (text: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? parseQuickAdd(text, today) : null;
  const listName =
    parsed?.listName &&
    lists.find((l) => l.name.toLowerCase() === parsed.listName!.toLowerCase())?.name;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {parsed && (parsed.priority || parsed.dueDate || parsed.dueTime || listName || parsed.tags.length) ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-1.5 text-[11px]">
          {parsed.priority ? (
            <Chip color={priorityMeta(parsed.priority).color}>
              <Flag className="size-3" /> {priorityMeta(parsed.priority).label}
            </Chip>
          ) : null}
          {parsed.dueDate ? (
            <Chip>
              <CalIcon className="size-3" /> {formatShortDate(parsed.dueDate)}
            </Chip>
          ) : null}
          {parsed.dueTime ? (
            <Chip>
              <Clock className="size-3" /> {parsed.dueTime}
            </Chip>
          ) : null}
          {listName ? (
            <Chip>
              <Folder className="size-3" /> {listName}
            </Chip>
          ) : null}
          {parsed.tags.map((t) => (
            <Chip key={t}>
              <Hash className="size-3" /> {t}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
        "border-border bg-muted/50 text-muted-foreground",
      )}
      style={color ? { color, borderColor: `${color}55` } : undefined}
    >
      {children}
    </span>
  );
}
