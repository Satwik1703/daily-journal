"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { saveJournalEntry, type JournalPatch } from "@/app/actions/journal";
import { QuestionsBlock } from "./questions-block";
import type { JournalQuestion } from "@/db/queries/journal-questions";
import { cn } from "@/lib/utils";

export type JournalFormState = {
  gratitude1: string;
  gratitude2: string;
  gratitude3: string;
  identity1: string;
  identity2: string;
  identity3: string;
  identity4: string;
  identity5: string;
  energy: number;
  mood: number;
  sleepQuality: number;
  tomorrowPlan: string;
  answers: Record<string, unknown>;
};

const IDENTITY_PLACEHOLDERS = [
  "I am the kind of person who shows up before they feel ready.",
  "I am the kind of person who keeps promises to myself.",
  "I am the kind of person who chooses long-term over easy.",
  "I am the kind of person who learns from every day.",
  "I am the kind of person who builds with intention, not impulse.",
] as const;

const DEBOUNCE_MS = 1500;

type ScalarKey = Exclude<keyof JournalFormState, "answers">;
type ScalarPatch = { [K in ScalarKey]?: JournalFormState[K] };

export function JournalForm({
  date,
  questions,
  initial,
  tasksBlock,
}: {
  date: string;
  questions: JournalQuestion[];
  initial: JournalFormState;
  tasksBlock?: React.ReactNode;
}) {
  const [state, setState] = useState<JournalFormState>(initial);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedAgo, setSavedAgo] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pending changes are accumulated as a partial; answers needs special merge handling.
  const pendingScalarsRef = useRef<ScalarPatch>({});
  const answersDirtyRef = useRef(false);
  const stateRef = useRef(state);
  // Keep the ref in sync with the latest state for use inside debounced timers
  // that run outside the render cycle. (Updating refs during render is an
  // anti-pattern; doing it in an effect is the canonical "use latest" pattern.)
  useEffect(() => {
    stateRef.current = state;
  });
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (!savedAt) return;
    const update = () => {
      const s = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
      setSavedAgo(s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [savedAt]);

  function flush() {
    const patch: JournalPatch = { date, ...pendingScalarsRef.current };
    if (answersDirtyRef.current) patch.answers = stateRef.current.answers;
    pendingScalarsRef.current = {};
    answersDirtyRef.current = false;
    if (Object.keys(patch).length <= 1) return;
    startTransition(async () => {
      await saveJournalEntry(patch);
      setSavedAt(Date.now());
    });
  }

  function scheduleFlush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }

  function updateScalar<K extends ScalarKey>(key: K, value: JournalFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    pendingScalarsRef.current[key] = value;
    scheduleFlush();
  }

  function updateAnswer(qid: string, value: unknown) {
    setState((s) => ({ ...s, answers: { ...s.answers, [qid]: value } }));
    answersDirtyRef.current = true;
    scheduleFlush();
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    const onHidden = () => {
      if (
        document.visibilityState === "hidden" &&
        (Object.keys(pendingScalarsRef.current).length || answersDirtyRef.current)
      ) {
        flush();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <SaveIndicator pending={isPending} savedAgo={savedAgo} hasAnythingSaved={savedAt !== null} />

      {/* Group 1 — Mindset */}
      <section className="space-y-4">
        <GroupBreak label="Mindset" first />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif font-normal">Gratitude</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([1, 2, 3] as const).map((n) => {
              const key = `gratitude${n}` as const;
              return (
                <TextareaAutosize
                  key={key}
                  value={state[key]}
                  onChange={(e) => updateScalar(key, e.target.value)}
                  placeholder="I'm grateful for ..."
                  minRows={1}
                  className="font-serif w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60"
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif font-normal">Identity Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([1, 2, 3, 4, 5] as const).map((n) => {
              const key = `identity${n}` as const;
              return (
                <IdentityInput
                  key={key}
                  value={state[key]}
                  onChange={(v) => updateScalar(key, v)}
                  placeholder={IDENTITY_PLACEHOLDERS[n - 1]}
                />
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Group 2 — Today's intent */}
      <section className="space-y-4">
        <GroupBreak label="Today's intent" />
        {tasksBlock}
      </section>

      {/* Group 3 — Reflection */}
      <section className="space-y-4">
        <GroupBreak label="Reflection" />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif font-normal">How was today?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScaleField label="Energy" value={state.energy} onChange={(v) => updateScalar("energy", v)} hint="1 = drained · 10 = fully charged" />
            <ScaleField label="Mood" value={state.mood} onChange={(v) => updateScalar("mood", v)} hint="1 = low · 10 = great" />
            <ScaleField label="Sleep quality" value={state.sleepQuality} onChange={(v) => updateScalar("sleepQuality", v)} hint="last night" />
          </CardContent>
        </Card>

        <QuestionsBlock questions={questions} answers={state.answers} onAnswer={updateAnswer} />
      </section>

      {/* Group 4 — Looking ahead */}
      <section className="space-y-4">
        <GroupBreak label="Looking ahead" />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif font-normal">Set tomorrow up</CardTitle>
          </CardHeader>
          <CardContent>
            <TextareaAutosize
              value={state.tomorrowPlan}
              onChange={(e) => updateScalar("tomorrowPlan", e.target.value)}
              placeholder="What's the one thing that would make tomorrow a good day?"
              minRows={3}
              className="font-serif w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/**
 * Textarea with a "typewriter" placeholder: instead of vanishing on first
 * keystroke, the placeholder text reveals the *remaining* characters in
 * muted color behind the cursor, like a writing prompt that gets eaten as
 * the user types. The typed prefix is rendered invisibly in the overlay so
 * the ghost suffix lines up with the real cursor position.
 */
function IdentityInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const ghost = value.length >= placeholder.length ? "" : placeholder.slice(value.length);
  return (
    <div className="relative rounded-md border border-input bg-background shadow-xs transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
      <TextareaAutosize
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minRows={1}
        className="font-serif relative z-10 block w-full resize-none rounded-md bg-transparent px-3 py-2 text-base leading-relaxed outline-none"
      />
      {ghost ? (
        <div
          aria-hidden
          className="font-serif pointer-events-none absolute inset-0 px-3 py-2 text-base leading-relaxed whitespace-pre-wrap break-words text-muted-foreground/45"
        >
          <span className="invisible">{value}</span>
          {ghost}
        </div>
      ) : null}
    </div>
  );
}

function GroupBreak({ label, first = false }: { label: string; first?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-1", first ? "mt-2" : "mt-6")}>
      <span className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function ScaleField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Badge variant="secondary" className="font-mono text-sm tabular-nums">
          {value}
        </Badge>
      </div>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : (v as number);
          if (typeof next === "number") onChange(next);
        }}
      />
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SaveIndicator({
  pending,
  savedAgo,
  hasAnythingSaved,
}: {
  pending: boolean;
  savedAgo: string;
  hasAnythingSaved: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 text-xs transition-colors",
        pending ? "text-muted-foreground" : hasAnythingSaved ? "text-primary/80" : "text-muted-foreground/60",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          pending ? "bg-muted-foreground animate-pulse" : hasAnythingSaved ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      {pending ? "Saving…" : hasAnythingSaved ? `Saved ${savedAgo}` : "Edits autosave"}
    </div>
  );
}
