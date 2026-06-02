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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoList | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(TODO_PRESET_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmoji(editing?.emoji ?? "");
    setColor(editing?.color ?? TODO_PRESET_COLORS[0]);
  }, [open, editing]);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    if (editing) {
      void mutate("update_list", { id: editing.id, name: n, emoji: emoji.trim() || null, color });
    } else {
      const id = nanoid(12);
      void mutate("create_list", { id, name: n, emoji: emoji.trim() || null, color });
      router.push(`/todo/list-${id}`);
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
          <DialogTitle>{editing ? "Edit list" : "New list"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
