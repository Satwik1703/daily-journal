"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import { nanoid } from "nanoid";
import { TODO_PRESET_COLORS, type TodoFilter, type TodoList, type TodoTag } from "@/lib/todo/todo-meta";
import { parseFilterRules, type FilterCondition, type FilterField } from "@/lib/todo/filters";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<FilterField, string> = {
  list: "List",
  tag: "Tag",
  priority: "Priority",
  due: "Due",
  keyword: "Keyword",
  status: "Status",
};

const DUE_OPS = [
  { op: "overdue", label: "is overdue" },
  { op: "today", label: "is today" },
  { op: "next7", label: "within 7 days" },
  { op: "none", label: "has no date" },
  { op: "any", label: "has a date" },
  { op: "before", label: "before…" },
  { op: "after", label: "after…" },
];

function defaultCondition(field: FilterField): FilterCondition {
  switch (field) {
    case "list": return { field, op: "is", value: "" };
    case "tag": return { field, op: "has", value: "" };
    case "priority": return { field, op: "is", value: 3 };
    case "due": return { field, op: "overdue", value: "" };
    case "keyword": return { field, op: "contains", value: "" };
    case "status": return { field, op: "is", value: "active" };
  }
}

export function FilterBuilderDialog({
  open,
  onOpenChange,
  editing,
  lists,
  tags,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TodoFilter | null;
  lists: TodoList[];
  tags: TodoTag[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TODO_PRESET_COLORS[7]);
  const [combinator, setCombinator] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? TODO_PRESET_COLORS[7]);
    const rules = editing ? parseFilterRules(editing.rulesJson) : null;
    setCombinator(rules?.combinator ?? "and");
    setConditions(rules?.conditions ?? [defaultCondition("priority")]);
  }, [open, editing]);

  const update = (i: number, patch: Partial<FilterCondition>) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => setConditions((cs) => cs.filter((_, idx) => idx !== i));

  const save = () => {
    const n = name.trim() || "Filter";
    const rules = { combinator, conditions };
    if (editing) {
      void mutate("update_filter", { id: editing.id, name: n, color, rules });
      onOpenChange(false);
    } else {
      const id = nanoid(12);
      void mutate("create_filter", { id, name: n, color, rules });
      onOpenChange(false);
      router.push(`/todo/filter-${id}`);
    }
  };
  const del = () => {
    if (!editing) return;
    void mutate("delete_filter", { id: editing.id });
    onOpenChange(false);
    router.push("/todo/all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit filter" : "New filter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Filter name"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Match</span>
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              {(["and", "or"] as const).map((cb) => (
                <button
                  key={cb}
                  type="button"
                  onClick={() => setCombinator(cb)}
                  className={cn("rounded-md px-2.5 py-1 font-medium", combinator === cb ? "bg-background shadow-sm" : "text-muted-foreground")}
                >
                  {cb === "and" ? "All" : "Any"}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">of:</span>
          </div>

          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-2">
                <select
                  value={c.field}
                  onChange={(e) => setConditions((cs) => cs.map((x, idx) => (idx === i ? defaultCondition(e.target.value as FilterField) : x)))}
                  className="h-7 rounded-md border border-border bg-background px-1.5 text-xs outline-none"
                >
                  {(Object.keys(FIELD_LABELS) as FilterField[]).map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                  ))}
                </select>
                <ConditionControls c={c} lists={lists} tags={tags} onChange={(patch) => update(i, patch)} />
                <button type="button" onClick={() => remove(i)} aria-label="Remove condition" className="ml-auto text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <Button
              size="xs"
              variant="ghost"
              className="gap-1 text-muted-foreground"
              onClick={() => setConditions((cs) => [...cs, defaultCondition("keyword")])}
            >
              <Plus className="size-3.5" /> Add condition
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {TODO_PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Color ${hex}`}
                onClick={() => setColor(hex)}
                className={cn("size-6 rounded-full transition-transform", color === hex ? "scale-110 ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover" : "hover:scale-105")}
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
            <Button size="sm" onClick={save} className="ml-auto">
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConditionControls({
  c,
  lists,
  tags,
  onChange,
}: {
  c: FilterCondition;
  lists: TodoList[];
  tags: TodoTag[];
  onChange: (patch: Partial<FilterCondition>) => void;
}) {
  const sel = "h-7 rounded-md border border-border bg-background px-1.5 text-xs outline-none";
  switch (c.field) {
    case "list":
      return (
        <select className={sel} value={String(c.value) || (c.op === "inbox" ? "inbox" : "")} onChange={(e) => {
          const v = e.target.value;
          if (v === "inbox") onChange({ op: "inbox", value: "" });
          else onChange({ op: "is", value: v });
        }}>
          <option value="inbox">Inbox</option>
          {lists.filter((l) => l.kind === "list").map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      );
    case "tag":
      return (
        <select className={sel} value={String(c.value)} onChange={(e) => onChange({ op: "has", value: e.target.value })}>
          <option value="">— tag —</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      );
    case "priority":
      return (
        <>
          <select className={sel} value={c.op} onChange={(e) => onChange({ op: e.target.value })}>
            <option value="is">is</option>
            <option value="gte">≥</option>
            <option value="lte">≤</option>
          </select>
          <select className={sel} value={Number(c.value)} onChange={(e) => onChange({ value: Number(e.target.value) })}>
            <option value={3}>High</option>
            <option value={2}>Medium</option>
            <option value={1}>Low</option>
            <option value={0}>None</option>
          </select>
        </>
      );
    case "due":
      return (
        <>
          <select className={sel} value={c.op} onChange={(e) => onChange({ op: e.target.value })}>
            {DUE_OPS.map((o) => (
              <option key={o.op} value={o.op}>{o.label}</option>
            ))}
          </select>
          {(c.op === "before" || c.op === "after") ? (
            <input type="date" className={sel} value={String(c.value)} onChange={(e) => onChange({ value: e.target.value })} />
          ) : null}
        </>
      );
    case "keyword":
      return (
        <input className={cn(sel, "flex-1")} placeholder="contains…" value={String(c.value)} onChange={(e) => onChange({ value: e.target.value })} />
      );
    case "status":
      return (
        <select className={sel} value={String(c.value)} onChange={(e) => onChange({ op: "is", value: e.target.value })}>
          <option value="active">Active</option>
          <option value="done">Completed</option>
          <option value="wontDo">Won&apos;t do</option>
        </select>
      );
  }
}
