"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/app/actions/goals";
import {
  PACE_PILL_LABELS,
  computeGoalPace,
  type GoalStatus,
} from "@/lib/goal-meta";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import type { GoalWithDerived, GoalChecklistItem } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";

export function GoalCardMilestone({
  goal,
  periodStart,
  periodEnd,
  today,
}: {
  goal: GoalWithDerived;
  periodStart: DateString;
  periodEnd: DateString;
  today: DateString;
}) {
  const initialItems = goal.checklist ?? [];
  const [items, setItems] = useState<GoalChecklistItem[]>(initialItems);
  const [optimisticItems, applyOptimistic] = useOptimistic(
    items,
    (state: GoalChecklistItem[], action: Action) => reduce(state, action),
  );
  const [pendingMutation, startTransition] = useTransition();
  const [newText, setNewText] = useState("");

  const totalCount = optimisticItems.length;
  const doneCount = optimisticItems.filter((i) => i.done).length;
  const ratioCurrent = totalCount === 0 ? 0 : doneCount;
  const target = totalCount === 0 ? 1 : totalCount;
  const pace = computeGoalPace({
    status: goal.status as GoalStatus,
    current: ratioCurrent,
    target,
    periodStart,
    periodEnd,
    today,
  });
  const pillStatus = paceToStatus(pace.pill);
  const isClosed = today > periodEnd;
  const filled = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  function toggle(item: GoalChecklistItem) {
    startTransition(async () => {
      applyOptimistic({ kind: "toggle", id: item.id });
      try {
        const { done } = await toggleChecklistItem(item.id);
        setItems((arr) => arr.map((i) => (i.id === item.id ? { ...i, done } : i)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to toggle");
      }
    });
  }

  function add() {
    const text = newText.trim();
    if (!text) return;
    const tempId = `tmp-${Date.now()}`;
    startTransition(async () => {
      applyOptimistic({
        kind: "add",
        item: { id: tempId, goalId: goal.id, text, done: false, position: 0 },
      });
      try {
        const { id } = await addChecklistItem({ goalId: goal.id, text });
        setItems((arr) => [
          ...arr,
          { id, goalId: goal.id, text, done: false, position: arr.length },
        ]);
        setNewText("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add item");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      applyOptimistic({ kind: "delete", id });
      try {
        await deleteChecklistItem(id);
        setItems((arr) => arr.filter((i) => i.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg" style={{ color: goal.color }}>
              {goal.emoji ?? "🎯"}
            </span>
            <span className="font-medium">{goal.title}</span>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 border-transparent text-[10px] uppercase tracking-wide"
            style={{ background: statusBg(pillStatus), color: "var(--background)" }}
          >
            {PACE_PILL_LABELS[pace.pill]}
          </Badge>
        </div>

        {totalCount > 0 ? (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${filled}%`, background: goal.color }}
              />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {doneCount} / {totalCount} sub-tasks
            </div>
          </div>
        ) : null}

        <ul className="space-y-1.5">
          {optimisticItems.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-border"
            >
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-pressed={item.done}
                disabled={pendingMutation && item.id.startsWith("tmp-")}
                className={
                  "grid size-5 shrink-0 place-items-center rounded border transition-colors " +
                  (item.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted")
                }
              >
                {item.done ? <Check className="size-3.5" /> : null}
              </button>
              <span
                className={
                  "flex-1 text-sm " +
                  (item.done ? "text-muted-foreground line-through" : "")
                }
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="invisible text-muted-foreground hover:text-foreground group-hover:visible"
                aria-label="Delete item"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {!isClosed ? (
          <div className="flex items-center gap-2">
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Add sub-task…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={add}
              disabled={!newText.trim() || pendingMutation}
              aria-label="Add sub-task"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type Action =
  | { kind: "toggle"; id: string }
  | { kind: "add"; item: GoalChecklistItem }
  | { kind: "delete"; id: string };

function reduce(state: GoalChecklistItem[], action: Action): GoalChecklistItem[] {
  if (action.kind === "toggle") {
    return state.map((i) => (i.id === action.id ? { ...i, done: !i.done } : i));
  }
  if (action.kind === "add") return [...state, action.item];
  return state.filter((i) => i.id !== action.id);
}

function paceToStatus(pill: ReturnType<typeof computeGoalPace>["pill"]): JournalStatus {
  if (pill === "achieved") return "crazy";
  if (pill === "ahead") return "great";
  if (pill === "on-track") return "good";
  if (pill === "behind") return "avg";
  if (pill === "at-risk" || pill === "missed") return "bad";
  return "empty";
}
