"use client";

import { useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Hash, Check, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { mutate } from "@/lib/sync/mutate";
import type { TodoTag } from "@/lib/todo/todo-meta";
import { cn } from "@/lib/utils";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

export function TagPicker({
  allTags,
  selected,
  onChange,
  children,
}: {
  allTags: TodoTag[];
  selected: TodoTag[];
  onChange: (tags: TodoTag[]) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);

  // Existing tags not yet selected, plus any selected-but-new tags, merged.
  const known = useMemo(() => {
    const m = new Map<string, TodoTag>();
    for (const t of allTags) m.set(t.id, t);
    for (const t of selected) m.set(t.id, t);
    return Array.from(m.values());
  }, [allTags, selected]);

  const q = query.trim().toLowerCase();
  const filtered = known.filter((t) => t.name.toLowerCase().includes(q));
  const exactExists = known.some((t) => t.name.toLowerCase() === q);

  const toggle = (tag: TodoTag) => {
    if (selectedIds.has(tag.id)) onChange(selected.filter((t) => t.id !== tag.id));
    else onChange([...selected, tag]);
  };

  const createAndAdd = () => {
    const name = query.trim();
    if (!name) return;
    const existing = known.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedIds.has(existing.id)) onChange([...selected, existing]);
      setQuery("");
      return;
    }
    const id = nanoid(12);
    const color = PALETTE[known.length % PALETTE.length];
    const tag: TodoTag = { id, name, color, position: known.length };
    void mutate("create_tag", { id, name, color });
    onChange([...selected, tag]);
    setQuery("");
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="inline-flex outline-none">{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-60 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createAndAdd();
                }
              }}
              placeholder="Search or create tag…"
              autoFocus
              className="mb-1.5 h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
                >
                  <Hash className="size-3.5" style={{ color: t.color }} />
                  <span className="flex-1 truncate">{t.name}</span>
                  {selectedIds.has(t.id) ? <Check className="size-3.5 text-muted-foreground" /> : null}
                </button>
              ))}
              {q && !exactExists ? (
                <button
                  type="button"
                  onClick={createAndAdd}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-primary hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                  Create &ldquo;{query.trim()}&rdquo;
                </button>
              ) : null}
              {filtered.length === 0 && !q ? (
                <p className="px-1.5 py-2 text-xs text-muted-foreground">No tags yet — type to create one.</p>
              ) : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TagChips({ tags, className }: { tags: TodoTag[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]"
          style={{ color: t.color, backgroundColor: `${t.color}1a` }}
        >
          <Hash className="size-2.5" />
          {t.name}
        </span>
      ))}
    </span>
  );
}
