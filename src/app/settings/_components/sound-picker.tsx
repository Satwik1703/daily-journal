"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SOUND_OPTIONS } from "@/lib/pomodoro-meta";
import { primeAudio, playPomodoroSound } from "@/lib/pomodoro-audio";
import { mutate } from "@/lib/sync/mutate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SoundPicker({ currentSoundId }: { currentSoundId: string }) {
  const [selected, setSelected] = useState(currentSoundId);

  function handleSelect(id: string) {
    setSelected(id);
    void mutate("set_pomo_sound", { soundId: id });
    toast.success("Sound updated");
  }

  function preview(id: string) {
    primeAudio();
    playPomodoroSound(id, 2500);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">
          Completion sound
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {SOUND_OPTIONS.map((s) => {
          const active = s.id === selected;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                active
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40",
              )}
            >
              <button
                type="button"
                onClick={() => handleSelect(s.id)}
                className="flex flex-1 items-start gap-3 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors",
                    active ? "border-primary bg-primary" : "border-border",
                  )}
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.description}
                  </span>
                </span>
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => preview(s.id)}
              >
                <Play className="size-3.5" /> Preview
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
