"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Star } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import type { Book, BookStatus } from "@/db/queries/books";

const BOOK_COLORS = ["#a89b6a", "#4fa896", "#8b6dc7", "#c9824d", "#5e7ec9", "#c45e7e"];
const STATUSES: { key: BookStatus; label: string }[] = [
  { key: "reading", label: "Reading" },
  { key: "wishlist", label: "Wishlist" },
  { key: "finished", label: "Finished" },
  { key: "dnf", label: "DNF" },
];

export function BookFormDialog({
  open,
  onOpenChange,
  book,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [status, setStatus] = useState<BookStatus>("reading");
  const [color, setColor] = useState<string>(BOOK_COLORS[0]);
  const [startedAt, setStartedAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(book?.title ?? "");
      setAuthor(book?.author ?? "");
      setTotalPages(book?.totalPages != null ? String(book.totalPages) : "");
      setStatus((book?.status as BookStatus) ?? "reading");
      setColor(book?.color ?? BOOK_COLORS[0]);
      setStartedAt(book?.startedAt ?? "");
      setFinishedAt(book?.finishedAt ?? "");
      setRating(book?.rating ?? null);
      setNotes(book?.notes ?? "");
    }
  }, [open, book]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    const totalNum = totalPages.trim() ? Number(totalPages) : null;
    if (totalNum != null && (!Number.isInteger(totalNum) || totalNum < 0)) {
      toast.error("Total pages must be a positive integer");
      return;
    }
    const payload = {
      title: title.trim(),
      author: author.trim() || null,
      totalPages: totalNum,
      status,
      color,
      startedAt: startedAt || null,
      finishedAt: finishedAt || null,
      rating: status === "finished" ? rating : null,
      notes: notes.trim() || null,
    };
    if (book) {
      void mutate("update_book", { id: book.id, ...payload });
      toast.success(`Updated “${title}”`);
    } else {
      void mutate("create_book", { id: nanoid(12), ...payload });
      toast.success(`Added “${title}”`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {book ? "Edit book" : "New book"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="book-title">Title</Label>
            <Input
              id="book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Atomic Habits"
              maxLength={200}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-author">Author (optional)</Label>
            <Input
              id="book-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="James Clear"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-pages">Total pages (optional)</Label>
            <Input
              id="book-pages"
              inputMode="numeric"
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              placeholder="320"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-sm transition-colors",
                    s.key === status
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cover color</Label>
            <div className="flex flex-wrap gap-2">
              {BOOK_COLORS.map((c) => (
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
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="book-start">Started (optional)</Label>
              <Input
                id="book-start"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-end">Finished (optional)</Label>
              <Input
                id="book-end"
                type="date"
                value={finishedAt}
                onChange={(e) => setFinishedAt(e.target.value)}
              />
            </div>
          </div>
          {status === "finished" ? (
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1 === rating ? null : i + 1)}
                    aria-label={`${i + 1} stars`}
                  >
                    <Star
                      className={cn(
                        "size-6 transition-colors",
                        rating != null && i < rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40 hover:text-amber-300",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="book-notes">Notes (optional)</Label>
            <Textarea
              id="book-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Highlights, quotes, what stuck"
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!title.trim()}>
              {book ? "Save" : "Add book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
