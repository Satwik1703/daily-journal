"use client";

import { useState } from "react";
import { BookOpen, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, BookCheck, BookMinus, BookHeart } from "lucide-react";
import { mutate } from "@/lib/sync/mutate";
import { useCachedPage } from "@/lib/sync/cache";
import { cn } from "@/lib/utils";
import { BookFormDialog } from "./book-form-dialog";
import type { Book, BookStatus } from "@/db/queries/books";

type PageData = {
  books: Book[];
  progress: Record<string, number>;
  activeBookId: string | null;
};

const STATUS_SECTIONS: { key: BookStatus; label: string; emptyHint?: string }[] = [
  { key: "reading", label: "Reading", emptyHint: "No active books — tap + to add one." },
  { key: "wishlist", label: "Wishlist" },
  { key: "finished", label: "Finished" },
  { key: "dnf", label: "Did not finish" },
];

export function BooksPageClient() {
  const data = useCachedPage<PageData | null>(`books`, null, async () => {
    const res = await fetch(`/api/page/books`, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    return (await res.json()) as PageData;
  });
  const [editing, setEditing] = useState<Book | null>(null);
  const [creating, setCreating] = useState(false);

  if (data == null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-4">
        <div className="h-12 animate-pulse rounded-md bg-muted/40" />
        <div className="h-40 animate-pulse rounded-md bg-muted/40" />
        <div className="h-40 animate-pulse rounded-md bg-muted/40" />
      </div>
    );
  }

  const booksByStatus = new Map<BookStatus, Book[]>();
  for (const s of STATUS_SECTIONS) booksByStatus.set(s.key, []);
  for (const b of data.books) {
    const arr = booksByStatus.get(b.status as BookStatus);
    if (arr) arr.push(b);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal leading-tight">Books</h1>
          <p className="text-xs text-muted-foreground">
            Tracks pages through the Read habit. Picking an active book makes it the default in
            today&apos;s Read log dialog.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New
        </Button>
      </div>

      {STATUS_SECTIONS.map((s) => {
        const list = booksByStatus.get(s.key) ?? [];
        if (list.length === 0 && s.key !== "reading") return null;
        return (
          <Card key={s.key}>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg font-normal">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 italic">{s.emptyHint}</p>
              ) : (
                list.map((b) => (
                  <BookRow
                    key={b.id}
                    book={b}
                    progress={data.progress[b.id] ?? 0}
                    isActive={data.activeBookId === b.id}
                    onEdit={() => setEditing(b)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      <BookFormDialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        book={editing}
      />
    </div>
  );
}

function BookRow({
  book,
  progress,
  isActive,
  onEdit,
}: {
  book: Book;
  progress: number;
  isActive: boolean;
  onEdit: () => void;
}) {
  const pct =
    book.totalPages && book.totalPages > 0
      ? Math.min(100, Math.round((progress / book.totalPages) * 100))
      : null;
  return (
    <div className="flex items-start gap-3 rounded-md px-2 py-2">
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md text-base shadow-sm"
        style={{ backgroundColor: book.color, color: "#fff" }}
      >
        <BookOpen className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{book.title}</span>
          {isActive ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary">
              Active
            </span>
          ) : null}
        </div>
        {book.author ? (
          <div className="truncate text-[11px] text-muted-foreground">{book.author}</div>
        ) : null}
        {book.totalPages && book.totalPages > 0 ? (
          <div className="space-y-0.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: book.color,
                }}
              />
            </div>
            <div className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(progress)} / {book.totalPages} pages · {pct}%
            </div>
          </div>
        ) : progress > 0 ? (
          <div className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round(progress)} pages logged
          </div>
        ) : null}
        {book.status === "finished" && book.rating ? (
          <div className="flex gap-0.5 pt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-3",
                  i < (book.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${book.title}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          {book.status === "reading" ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  void mutate("set_active_book", { bookId: book.id });
                  toast.success(`Active book: ${book.title}`);
                }}
              >
                <BookHeart />
                Set as active
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void mutate("update_book", { id: book.id, status: "finished" });
                  toast.success(`Marked finished`);
                }}
              >
                <BookCheck />
                Mark finished
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void mutate("update_book", { id: book.id, status: "dnf" });
                  toast.success(`Marked DNF`);
                }}
              >
                <BookMinus />
                Mark DNF
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={() => {
                void mutate("update_book", { id: book.id, status: "reading" });
                toast.success(`Moved back to Reading`);
              }}
            >
              <BookOpen />
              Move to Reading
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void mutate("delete_book", { id: book.id });
              toast.success(`Deleted “${book.title}”`);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
