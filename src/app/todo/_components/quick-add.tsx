"use client";

import { useRef, useState } from "react";
import { Plus, Flag, Calendar as CalIcon, Clock, Hash, Folder, Repeat } from "lucide-react";
import { parseQuickAdd } from "@/lib/todo/quick-parse";
import { describeRule, parseRule } from "@/lib/todo/recurrence";
import { priorityMeta, type TodoList, type TodoTag } from "@/lib/todo/todo-meta";
import { formatShortDate, type DateString } from "@/lib/dates";
import { DueDatePopover } from "./due-date-popover";
import { RepeatEditor } from "./repeat-editor";
import { cn } from "@/lib/utils";

export type QuickAddExtra = {
  dueDate?: DateString | null;
  dueTime?: string | null;
  repeat?: string | null;
};

type Suggestion = { id: string; label: string; insert: string; color?: string; hint?: string };

const PRIORITY_SUGGESTIONS: Suggestion[] = [
  { id: "p3", label: "High", insert: "!high", color: "#ef4444" },
  { id: "p2", label: "Medium", insert: "!med", color: "#f59e0b" },
  { id: "p1", label: "Low", insert: "!low", color: "#3b82f6" },
  { id: "p0", label: "None", insert: "", color: "#94a3b8" },
];

export function QuickAdd({
  today,
  lists,
  tags,
  placeholder = "Add a task…  try \"pay rent !high every monday 6pm\"",
  onSubmit,
  inputRef,
}: {
  today: DateString;
  lists: TodoList[];
  tags: TodoTag[];
  placeholder?: string;
  onSubmit: (text: string, extra?: QuickAddExtra) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  // Chip-set overrides (win over parsed values). null entry = "not overridden".
  const [dueOv, setDueOv] = useState<{ date: DateString | null; time: string | null } | null>(null);
  const [repeatOv, setRepeatOv] = useState<{ json: string | null } | null>(null);

  const parsed = text.trim() ? parseQuickAdd(text, today) : null;
  const effDate = dueOv ? dueOv.date : (parsed?.dueDate ?? null);
  const effTime = dueOv ? dueOv.time : (parsed?.dueTime ?? null);
  const effRepeat = repeatOv ? repeatOv.json : (parsed?.repeat ?? null);
  const rule = effRepeat ? parseRule(effRepeat) : null;
  const listName =
    parsed?.listName &&
    lists.find((l) => l.name.toLowerCase() === parsed.listName!.toLowerCase())?.name;

  // Detect the token being typed immediately before the caret.
  const before = text.slice(0, caret);
  const tokenMatch = before.match(/([~#!])([\p{L}\d_-]*)$/u);
  const tokenChar = tokenMatch?.[1] ?? null;
  const tokenQuery = (tokenMatch?.[2] ?? "").toLowerCase();

  let suggestions: Suggestion[] = [];
  if (tokenChar === "~") {
    suggestions = lists
      .filter((l) => l.kind === "list" && l.name.toLowerCase().includes(tokenQuery))
      .map((l) => ({
        id: l.id,
        label: l.name,
        insert: l.name.includes(" ") ? `~"${l.name}"` : `~${l.name}`,
        color: l.color,
      }));
  } else if (tokenChar === "#") {
    suggestions = tags
      .filter((t) => t.name.toLowerCase().includes(tokenQuery))
      .map((t) => ({ id: t.id, label: t.name, insert: `#${t.name}`, color: t.color }));
    if (tokenQuery && !tags.some((t) => t.name.toLowerCase() === tokenQuery)) {
      suggestions.push({ id: "__new", label: `Create "${tokenQuery}"`, insert: `#${tokenQuery}`, hint: "new" });
    }
  } else if (tokenChar === "!") {
    suggestions = PRIORITY_SUGGESTIONS.filter((p) => p.label.toLowerCase().includes(tokenQuery));
  }

  const syncCaret = () => {
    const el = ref.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  };

  const applySuggestion = (s: Suggestion) => {
    if (!tokenMatch) return;
    const start = caret - tokenMatch[0].length;
    const next = text.slice(0, start) + s.insert + (s.insert ? " " : "") + text.slice(caret);
    setText(next);
    const newCaret = start + s.insert.length + (s.insert ? 1 : 0);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      }
    });
  };

  // Clicking a preview chip starts that token so the picker opens.
  const startToken = (ch: "~" | "#" | "!") => {
    const needsSpace = text.length > 0 && !text.endsWith(" ");
    const next = `${text}${needsSpace ? " " : ""}${ch}`;
    setText(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
        setCaret(next.length);
      }
    });
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const extra: QuickAddExtra = {};
    if (dueOv) {
      extra.dueDate = dueOv.date;
      extra.dueTime = dueOv.time;
    }
    if (repeatOv) extra.repeat = repeatOv.json;
    onSubmit(t, extra);
    setText("");
    setCaret(0);
    setDueOv(null);
    setRepeatOv(null);
  };

  const showSuggest = tokenChar !== null && suggestions.length > 0;
  const showPreview =
    !showSuggest && (parsed?.priority || effDate || effTime || listName || parsed?.tags.length || rule);

  return (
    <div className="relative rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !showSuggest) {
              e.preventDefault();
              submit();
            } else if (e.key === "Enter" && showSuggest) {
              e.preventDefault();
              applySuggestion(suggestions[0]);
            }
          }}
          placeholder={placeholder}
          className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {/* autocomplete dropdown */}
      {showSuggest ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg ring-1 ring-foreground/5">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(s);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {tokenChar === "~" ? <Folder className="size-3.5" style={{ color: s.color }} /> : null}
              {tokenChar === "#" ? <Hash className="size-3.5" style={{ color: s.color }} /> : null}
              {tokenChar === "!" ? <Flag className="size-3.5" style={{ color: s.color }} fill={s.color} /> : null}
              <span className="flex-1 truncate">{s.label}</span>
              {s.hint ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* parsed preview chips (clickable where it makes sense) */}
      {showPreview ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-1.5 text-[11px]">
          {parsed?.priority ? (
            <button type="button" onClick={() => startToken("!")}>
              <Chip color={priorityMeta(parsed.priority).color}>
                <Flag className="size-3" /> {priorityMeta(parsed.priority).label}
              </Chip>
            </button>
          ) : null}
          {effDate ? (
            <DueDatePopover date={effDate} time={effTime} onChange={(d, t) => setDueOv({ date: d, time: t })}>
              <Chip>
                <CalIcon className="size-3" /> {formatShortDate(effDate)}
                {effTime ? (
                  <>
                    <Clock className="size-3" /> {effTime}
                  </>
                ) : null}
              </Chip>
            </DueDatePopover>
          ) : null}
          {rule ? (
            <RepeatEditor value={effRepeat} onChange={(j) => setRepeatOv({ json: j })}>
              <Chip>
                <Repeat className="size-3" /> {describeRule(rule)}
              </Chip>
            </RepeatEditor>
          ) : null}
          {listName ? (
            <button type="button" onClick={() => startToken("~")}>
              <Chip>
                <Folder className="size-3" /> {listName}
              </Chip>
            </button>
          ) : null}
          {parsed?.tags.map((t) => (
            <Chip key={t}>
              <Hash className="size-3" /> {t}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
        "border-border bg-muted/50 text-muted-foreground",
      )}
      style={color ? { color, borderColor: `${color}55` } : undefined}
    >
      {children}
    </span>
  );
}
