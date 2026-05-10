"use client";

import TextareaAutosize from "react-textarea-autosize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { JournalQuestion } from "@/db/queries/journal-questions";

export function QuestionsBlock({
  questions,
  answers,
  onAnswer,
}: {
  questions: JournalQuestion[];
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, value: unknown) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif font-normal">Daily questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {questions.map((q) => {
          if (q.type === "text") {
            const v = (answers[q.id] as string) ?? "";
            return (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-sm font-medium">{q.label}</Label>
                <TextareaAutosize
                  value={v}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  minRows={1}
                  className="font-serif w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60"
                />
              </div>
            );
          }
          if (q.type === "scale") {
            const v = typeof answers[q.id] === "number" ? (answers[q.id] as number) : 5;
            return (
              <div key={q.id}>
                <div className="mb-2 flex items-baseline justify-between">
                  <Label className="text-sm font-medium">{q.label}</Label>
                  <Badge variant="secondary" className="font-mono text-sm tabular-nums">
                    {v}
                  </Badge>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[v]}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : (value as number);
                    if (typeof next === "number") onAnswer(q.id, next);
                  }}
                />
              </div>
            );
          }
          // boolean
          const v = answers[q.id] === true;
          return (
            <div key={q.id} className="flex items-center justify-between gap-3">
              <Label className="flex-1 text-sm font-medium">{q.label}</Label>
              <Switch checked={v} onCheckedChange={(checked) => onAnswer(q.id, checked === true)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
