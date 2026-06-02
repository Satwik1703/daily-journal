"use client";

import { Check, Flag, Calendar as CalIcon, FolderInput, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { priorityMeta, type TodoList } from "@/lib/todo/todo-meta";
import { DueDatePopover } from "./due-date-popover";
import { type DateString } from "@/lib/dates";

export function BulkBar({
  count,
  lists,
  onComplete,
  onPriority,
  onDue,
  onMove,
  onDelete,
  onClose,
}: {
  count: number;
  lists: TodoList[];
  onComplete: () => void;
  onPriority: (p: number) => void;
  onDue: (d: DateString | null) => void;
  onMove: (listId: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 backdrop-blur supports-backdrop-filter:bg-popover/80 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-1 px-3 py-2">
        <button type="button" onClick={onClose} aria-label="Cancel selection" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
        <span className="mr-1 text-sm font-medium tabular-nums">{count}</span>

        <Action label="Complete" onClick={onComplete}>
          <Check className="size-4" />
        </Action>

        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Priority" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" />}>
            <Flag className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {[3, 2, 1, 0].map((p) => (
              <DropdownMenuItem key={p} onClick={() => onPriority(p)} className="gap-2">
                <Flag className="size-4" style={{ color: p === 0 ? "var(--muted-foreground)" : priorityMeta(p).color }} fill={p === 0 ? "none" : priorityMeta(p).color} />
                {priorityMeta(p).label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DueDatePopover date={null} time={null} onChange={(d) => onDue(d)} align="center">
          <span className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <CalIcon className="size-4" />
          </span>
        </DueDatePopover>

        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Move to list" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" />}>
            <FolderInput className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => onMove(null)}>Inbox</DropdownMenuItem>
            {lists.filter((l) => l.kind === "list").map((l) => (
              <DropdownMenuItem key={l.id} onClick={() => onMove(l.id)} className="gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Action label="Delete" onClick={onDelete} danger>
          <Trash2 className="size-4" />
        </Action>
      </div>
    </div>
  );
}

function Action({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-lg hover:bg-muted ${danger ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
