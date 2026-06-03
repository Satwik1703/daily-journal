"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, ChevronDown } from "lucide-react";
import { nanoid } from "nanoid";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { mutate } from "@/lib/sync/mutate";
import type { Todo, TodoList as TList, TodoTag, TodoSection } from "@/lib/todo/todo-meta";
import { TodoListView, type SubtaskCounts } from "./todo-list";
import { cn } from "@/lib/utils";

export function SectionList({
  listId,
  sections,
  todos,
  listsById,
  subtasks,
  tagsByTodo,
  today,
  reorderable,
  selectMode,
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
  listId: string;
  sections: TodoSection[];
  todos: Todo[];
  listsById: Map<string, TList>;
  subtasks: SubtaskCounts;
  tagsByTodo: Record<string, TodoTag[]>;
  today: string;
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
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const valid = new Set(sections.map((s) => s.id));
  const noSection = todos.filter((t) => !t.sectionId || !valid.has(t.sectionId));
  const bySection = new Map<string, Todo[]>();
  for (const s of sections) bySection.set(s.id, []);
  for (const t of todos) {
    if (t.sectionId && valid.has(t.sectionId)) bySection.get(t.sectionId)!.push(t);
  }

  const listProps = {
    listsById,
    subtasks,
    tagsByTodo,
    today,
    showList: false,
    reorderable,
    selectMode,
    selectedIds,
    onSelect,
    onToggle,
    onOpen,
    onPriority,
    onPin,
    onDelete,
    onReschedule,
    onReorder,
  };

  const addSection = () => {
    const n = newName.trim();
    if (!n) {
      setAdding(false);
      return;
    }
    void mutate("create_section", { id: nanoid(12), listId, name: n });
    setNewName("");
    setAdding(false);
  };
  const saveRename = (id: string) => {
    const n = editName.trim();
    if (n) void mutate("update_section", { id, name: n });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {noSection.length > 0 ? (
        <TodoListView todos={noSection} {...listProps} />
      ) : null}

      {sections.map((s) => (
        <div key={s.id} className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <ChevronDown className="size-3.5 text-muted-foreground" />
            {editingId === s.id ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => saveRename(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveRename(s.id);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                className="h-6 flex-1 rounded-md border border-border bg-background px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            ) : (
              <span className="flex-1 text-sm font-medium text-foreground/90">{s.name}</span>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">
              {bySection.get(s.id)?.length ?? 0}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Section options"
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingId(s.id);
                    setEditName(s.name);
                  }}
                  className="gap-2"
                >
                  <Pencil className="size-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void mutate("delete_section", { id: s.id })}
                  className="gap-2"
                >
                  <Trash2 className="size-3.5" /> Delete section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {(bySection.get(s.id)?.length ?? 0) > 0 ? (
            <TodoListView todos={bySection.get(s.id)!} {...listProps} />
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground/70">No tasks in this section.</p>
          )}
        </div>
      ))}

      {adding ? (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={addSection}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSection();
            }
            if (e.key === "Escape") setAdding(false);
          }}
          autoFocus
          placeholder="Section name"
          className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Plus className="size-3.5" /> Add section
        </button>
      )}
    </div>
  );
}
