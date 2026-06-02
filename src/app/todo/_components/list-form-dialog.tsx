"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import { nanoid } from "nanoid";
import { TODO_PRESET_COLORS, type TodoList } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

export function ListFormDialog({
  open,
  onOpenChange,
  editing,
  folders,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoList | null;
  folders: TodoList[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(TODO_PRESET_COLORS[0]);
  const [kind, setKind] = useState<"list" | "folder">("list");
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmoji(editing?.emoji ?? "");
    setColor(editing?.color ?? TODO_PRESET_COLORS[0]);
    setKind(editing?.kind ?? "list");
    setParentId(editing?.parentId ?? null);
  }, [open, editing]);

  const isFolder = kind === "folder";

  const save = () => {
    const n = name.trim();
    if (!n) return;
    if (editing) {
      void mutate("update_list", {
        id: editing.id,
        name: n,
        emoji: emoji.trim() || null,
        color,
        parentId: editing.kind === "list" ? parentId : undefined,
      });
    } else {
      const id = nanoid(12);
      void mutate("create_list", {
        id,
        name: n,
        emoji: emoji.trim() || null,
        color,
        kind,
        parentId: kind === "list" ? parentId : null,
      });
      if (kind === "list") router.push(`/todo/list-${id}`);
    }
    onOpenChange(false);
  };

  const del = () => {
    if (!editing) return;
    void mutate("delete_list", { id: editing.id });
    onOpenChange(false);
    router.push("/todo/all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? (editing.kind === "folder" ? "Edit folder" : "Edit list") : isFolder ? "New folder" : "New list"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!editing ? (
            <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setKind("list")}
                className={cn("flex-1 rounded-md py-1.5 font-medium", kind === "list" ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setKind("folder")}
                className={cn("flex-1 rounded-md py-1.5 font-medium", kind === "folder" ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                Folder
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="📋"
              className="h-9 w-12 rounded-lg border border-border bg-background text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              autoFocus
              placeholder="List name"
              className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {!isFolder && (editing?.kind ?? "list") === "list" && folders.length > 0 ? (
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji ? `${f.emoji} ` : ""}
                  {f.name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {TODO_PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Color ${hex}`}
                onClick={() => setColor(hex)}
                className={cn(
                  "size-7 rounded-full transition-transform",
                  color === hex ? "scale-110 ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover" : "hover:scale-105",
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editing ? (
              <Button variant="destructive" size="sm" onClick={del} className="gap-1.5">
                <Trash2 className="size-3.5" /> Delete
              </Button>
            ) : null}
            <Button size="sm" onClick={save} className="ml-auto" disabled={!name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
