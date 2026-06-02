"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatShortDate } from "@/lib/dates";
import type { Todo, TodoPageData } from "@/lib/todo/todo-meta";
import { PriorityFlag } from "./priority-menu";
import { cn } from "@/lib/utils";

export function SearchSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (t: Todo) => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<Todo[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    let cancelled = false;
    // Search the full active set (the "all" view returns every active top-level todo).
    fetch("/api/page/todo/all", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TodoPageData | null) => {
        if (!cancelled && d) setAll(d.todos);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? all.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q),
      )
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] gap-0 rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">Search tasks</SheetTitle>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search active tasks…"
              className="h-6 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </SheetHeader>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto px-4 pb-6">
          {q && results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No matches.</p>
          ) : null}
          {results.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                onOpenChange(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-muted/30"
            >
              <PriorityFlag priority={t.priority} />
              <span className={cn("min-w-0 flex-1 truncate text-sm", t.status !== "active" && "text-muted-foreground line-through")}>
                {t.title}
              </span>
              {t.dueDate ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatShortDate(t.dueDate)}</span>
              ) : null}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
