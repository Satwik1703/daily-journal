"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createHabit, updateHabit } from "@/app/actions/habits";
import { PRESET_COLORS } from "@/lib/habit-meta";
import { cn } from "@/lib/utils";
import type { Habit } from "@/db/queries/habits";
import { toast } from "sonner";

const SUGGESTED_EMOJI = ["💧", "📚", "🏃", "🧘", "💊", "🥗", "🛌", "🙏", "🎯", "✏️"];

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  // Reset form fields when the dialog opens.
  useEffect(() => {
    if (open) {
      setName(habit?.name ?? "");
      setEmoji(habit?.emoji ?? "");
      setColor(habit?.color ?? PRESET_COLORS[0]);
    }
  }, [open, habit]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        if (habit) {
          await updateHabit({ id: habit.id, name, emoji: emoji || null, color });
          toast.success(`Updated “${name}”`);
        } else {
          await createHabit({ name, emoji: emoji || null, color });
          toast.success(`Added “${name}”`);
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save habit");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {habit ? "Edit habit" : "New habit"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 30 minutes"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-emoji">Emoji</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                id="habit-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder=""
                maxLength={8}
                className="w-14 text-center text-lg"
              />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "size-8 rounded-md border border-transparent text-base transition-colors hover:bg-muted",
                      emoji === e && "border-primary bg-primary/10",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    "size-8 rounded-full ring-offset-2 ring-offset-popover transition-all",
                    color === c ? "ring-2 ring-foreground" : "ring-0",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : habit ? "Save" : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
