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
import { TODO_PRESET_COLORS, type TodoTag } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

export function TagFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoTag | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TODO_PRESET_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? TODO_PRESET_COLORS[0]);
  }, [open, editing]);

  const save = () => {
    const n = name.trim().replace(/^#/, "");
    if (!n) return;
    if (editing) {
      void mutate("update_tag", { id: editing.id, name: n, color });
    } else {
      void mutate("create_tag", { id: nanoid(12), name: n, color });
    }
    onOpenChange(false);
  };

  const del = () => {
    if (!editing) return;
    void mutate("delete_tag", { id: editing.id });
    onOpenChange(false);
    router.push("/todo/all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
            placeholder="Tag name"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
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
