"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, MoreHorizontal, Pencil, Archive, RotateCcw, AlignLeft, Sliders, ToggleLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  archiveQuestion,
  createQuestion,
  unarchiveQuestion,
  updateQuestion,
} from "@/app/actions/journal-questions";
import type { JournalQuestion } from "@/db/queries/journal-questions";

const TYPES = [
  { value: "text", label: "Text", Icon: AlignLeft, hint: "Free-form writing" },
  { value: "scale", label: "Scale", Icon: Sliders, hint: "1–10 slider" },
  { value: "boolean", label: "Yes/no", Icon: ToggleLeft, hint: "On/off switch" },
] as const;
type QType = (typeof TYPES)[number]["value"];

export function QuestionsManager({
  active,
  archived,
}: {
  active: JournalQuestion[];
  archived: JournalQuestion[];
}) {
  const [editing, setEditing] = useState<JournalQuestion | null>(null);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <span>Daily questions</span>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {active.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
            No daily questions yet. Add one — e.g. <em>“Did I move my body today?”</em>
          </p>
        ) : (
          active.map((q) => (
            <Row
              key={q.id}
              q={q}
              onEdit={() => setEditing(q)}
              onArchive={() => {
                startTransition(async () => {
                  await archiveQuestion(q.id);
                  toast.success("Archived");
                });
              }}
            />
          ))
        )}

        {archived.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
        ) : null}

        {showArchived
          ? archived.map((q) => (
              <Row
                key={q.id}
                q={q}
                muted
                onEdit={() => setEditing(q)}
                onArchive={() => {
                  startTransition(async () => {
                    await unarchiveQuestion(q.id);
                    toast.success("Restored");
                  });
                }}
                archiveLabel="Unarchive"
                ArchiveIcon={RotateCcw}
              />
            ))
          : null}
      </CardContent>

      <QuestionDialog
        open={adding || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(false);
            setEditing(null);
          }
        }}
        question={editing}
      />
    </Card>
  );
}

function Row({
  q,
  onEdit,
  onArchive,
  muted = false,
  archiveLabel = "Archive",
  ArchiveIcon = Archive,
}: {
  q: JournalQuestion;
  onEdit: () => void;
  onArchive: () => void;
  muted?: boolean;
  archiveLabel?: string;
  ArchiveIcon?: typeof Archive;
}) {
  const meta = TYPES.find((t) => t.value === q.type);
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-2 py-2", muted && "opacity-60")}>
      {meta ? (
        <meta.Icon className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm">{q.label}</span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{meta?.label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Options" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>
            <ArchiveIcon />
            {archiveLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function QuestionDialog({
  open,
  onOpenChange,
  question,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: JournalQuestion | null;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<QType>("text");
  const [pending, startTransition] = useTransition();

  // Reset form fields when the dialog opens.
  useEffect(() => {
    if (open) {
      setLabel(question?.label ?? "");
      setType((question?.type as QType) ?? "text");
    }
  }, [open, question]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      try {
        if (question) {
          await updateQuestion({ id: question.id, label, type });
          toast.success("Updated");
        } else {
          await createQuestion({ label, type });
          toast.success("Question added");
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {question ? "Edit question" : "New daily question"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-label">Question</Label>
            <Input
              id="q-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. What's one thing I did well today?"
              maxLength={140}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors",
                    type === t.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <t.Icon className="size-4" />
                  <span className="font-medium">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !label.trim()}>
              {pending ? "Saving…" : question ? "Save" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
