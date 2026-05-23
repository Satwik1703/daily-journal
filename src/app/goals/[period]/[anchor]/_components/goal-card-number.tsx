"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "@/lib/sync/mutate";
import {
  GOAL_STATUS_LABELS,
  PACE_PILL_LABELS,
  computeGoalPace,
  type GoalStatus,
} from "@/lib/goal-meta";
import { statusBg, type JournalStatus } from "@/lib/journal-status";
import type { GoalWithDerived } from "@/db/queries/goals";
import type { DateString } from "@/lib/dates";

export function GoalCardNumber({
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
  const pace = computeGoalPace({
    status: goal.status as GoalStatus,
    current: goal.currentValue,
    target: goal.targetValue,
    periodStart,
    periodEnd,
    today,
  });

  const target = goal.targetValue ?? 0;
  const filled = Math.min(100, Math.round(pace.progress * 100));
  const pillStatus = paceToStatus(pace.pill);
  const isClosed = today > periodEnd;
  const isAchieved = pace.pill === "achieved";

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
          <PacePill paceLabel={PACE_PILL_LABELS[pace.pill]} statusKey={pillStatus} />
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${filled}%`,
                background: goal.color,
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {formatValue(goal.currentValue)} / {formatValue(target)}
              {goal.unit ? ` ${goal.unit}` : ""}
            </span>
            <span>{filled}%</span>
          </div>
        </div>

        {!isClosed ? (
          <LogProgressButton goalId={goal.id} unit={goal.unit ?? null} />
        ) : (
          <div className="text-xs text-muted-foreground">
            {isAchieved ? "✓ Achieved" : `✗ ${GOAL_STATUS_LABELS.missed}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PacePill({
  paceLabel,
  statusKey,
}: {
  paceLabel: string;
  statusKey: JournalStatus;
}) {
  return (
    <Badge
      variant="secondary"
      className="shrink-0 border-transparent text-[10px] uppercase tracking-wide"
      style={{ background: statusBg(statusKey), color: "var(--background)" }}
    >
      {paceLabel}
    </Badge>
  );
}

function LogProgressButton({ goalId, unit }: { goalId: string; unit: string | null }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("1");
  const [note, setNote] = useState("");

  function submit() {
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero number");
      return;
    }
    void mutate("log_progress", {
      id: nanoid(12),
      goalId,
      delta: n,
      note: note || undefined,
    });
    setOpen(false);
    setDelta("1");
    setNote("");
    toast.success(n > 0 ? `+${n} logged` : `${n} logged`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <Plus className="size-4" /> Log progress
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log progress</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-delta">Amount{unit ? ` (${unit})` : null}</Label>
            <Input
              id="goal-delta"
              inputMode="decimal"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Positive adds, negative undoes. Use decimals if you want.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-note">Note (optional)</Label>
            <Textarea
              id="goal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you do?"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function paceToStatus(pill: ReturnType<typeof computeGoalPace>["pill"]): JournalStatus {
  if (pill === "achieved") return "crazy";
  if (pill === "ahead") return "great";
  if (pill === "on-track") return "good";
  if (pill === "behind") return "avg";
  if (pill === "at-risk" || pill === "missed") return "bad";
  return "empty";
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
