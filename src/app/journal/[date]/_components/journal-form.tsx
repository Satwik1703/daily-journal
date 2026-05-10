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
  energy: number;
  mood: number;
  sleepQuality: number;
  tomorrowPlan: string;
  answers: Record<string, unknown>;
};

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
                placeholder="Something you're grateful for…"
                minRows={1}
                className="font-serif w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60"
              />
            );
          })}
        </CardContent>
      </Card>

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

      {tasksBlock}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif font-normal">Tomorrow</CardTitle>
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
