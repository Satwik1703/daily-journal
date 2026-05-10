"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Plus, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addTask, deleteTask, toggleTask, updateTaskText } from "@/app/actions/journal-tasks";
import { TASK_KIND_HINTS, TASK_KIND_LABELS, TASK_KINDS, type TaskKind } from "@/lib/task-meta";
import type { JournalTask } from "@/db/queries/journal-tasks";

export function TasksBlock({ date, tasks }: { date: string; tasks: JournalTask[] }) {
  return (
    <div className="space-y-4">
      {TASK_KINDS.map((kind) => (
        <KindCard key={kind} date={date} kind={kind} tasks={tasks.filter((t) => t.kind === kind)} />
      ))}
    </div>
  );
}

function KindCard({ date, kind, tasks }: { date: string; kind: TaskKind; tasks: JournalTask[] }) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between font-serif text-lg font-normal">
          <div className="flex flex-col gap-0.5">
            <span>{TASK_KIND_LABELS[kind]}</span>
            <span className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground">
              {TASK_KIND_HINTS[kind]}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add ${TASK_KIND_LABELS[kind]}`}
            onClick={() => setAdding(true)}
          >
            <Plus />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {tasks.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground/70 italic">none yet — tap + to add</p>
        ) : null}
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {adding ? (
          <NewTaskInput
            onCancel={() => setAdding(false)}
            onSubmit={(text) => {
              startTransition(async () => {
                await addTask({ date, kind, text });
                setAdding(false);
              });
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: JournalTask }) {
  const [text, setText] = useState(task.text);
  const [done, setDone] = useState(task.done);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(task.text);
    setDone(task.done);
  }, [task.id, task.text, task.done]);

  function scheduleTextSave(next: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        await updateTaskText({ id: task.id, text: next });
      });
    }, 800);
  }

  return (
    <div className="group/task flex items-start gap-2 rounded-md px-1 py-1">
      <button
        type="button"
        aria-pressed={done}
        onClick={() => {
          const next = !done;
          setDone(next);
          startTransition(async () => {
            await toggleTask(task.id);
          });
        }}
        className={cn(
          "mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-foreground/40",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <TextareaAutosize
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleTextSave(e.target.value);
        }}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          startTransition(async () => {
            await updateTaskText({ id: task.id, text });
          });
        }}
        minRows={1}
        placeholder="…"
        className={cn(
          "flex-1 resize-none rounded-md bg-transparent px-2 py-1 text-sm leading-relaxed outline-none transition focus:bg-muted/40",
          done && "text-muted-foreground line-through",
        )}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete task"
        className="opacity-50 hover:opacity-100"
        onClick={() => {
          startTransition(async () => {
            await deleteTask(task.id);
          });
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function NewTaskInput({ onSubmit, onCancel }: { onSubmit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="flex items-start gap-2 rounded-md px-1 py-1">
      <span aria-hidden className="mt-1.5 size-5 shrink-0 rounded-md border border-dashed border-input" />
      <TextareaAutosize
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(text);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (text.trim()) onSubmit(text);
          else onCancel();
        }}
        minRows={1}
        placeholder="add and press enter"
        className="flex-1 resize-none rounded-md bg-muted/40 px-2 py-1 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
