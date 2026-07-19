"use client";

import { useState } from "react";
import { Droplet, Plus, Trash2 } from "lucide-react";
import { customAlphabet } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutate } from "@/lib/sync/mutate";
import type { WaterLog } from "@/lib/food-meta";

const uid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

const PRESETS = [
  { label: "Glass", ml: 250 },
  { label: "Bottle", ml: 500 },
  { label: "Big", ml: 750 },
];

export function WaterCard({
  date,
  logs,
  targetMl,
}: {
  date: string;
  logs: WaterLog[];
  targetMl: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState("");
  const visible = logs.filter((l) => !hidden.has(l.id));
  const total = visible.reduce((acc, l) => acc + l.amountMl, 0);
  const pct = targetMl > 0 ? Math.min(1, total / targetMl) : 0;

  function addPreset(ml: number) {
    const id = uid();
    void mutate("log_water", { id, date, amountMl: ml });
  }

  function addCustom() {
    const n = Number.parseFloat(customMl);
    if (!Number.isFinite(n) || n <= 0) return;
    addPreset(n);
    setCustomOpen(false);
    setCustomMl("");
  }

  function removeLog(id: string) {
    setHidden((h) => new Set(h).add(id));
    void mutate("delete_water_log", { id, date });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="font-serif text-base font-normal flex items-center gap-1.5">
          <Droplet className="size-4 text-sky-500" /> Water
        </CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(total)} / {Math.round(targetMl)} ml
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            style={{ width: `${pct * 100}%` }}
            className="h-full bg-sky-500/80 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.ml}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPreset(p.ml)}
              className="gap-1"
            >
              <Plus className="size-3" /> {p.label}{" "}
              <span className="text-[10px] text-muted-foreground">({p.ml} ml)</span>
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCustomOpen((o) => !o)}
          >
            Custom…
          </Button>
        </div>
        {customOpen ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="ml"
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
              className="w-24"
            />
            <Button type="button" size="sm" onClick={addCustom}>
              Add
            </Button>
          </div>
        ) : null}
        {visible.length > 0 ? (
          <ul className="divide-y divide-border/40 max-h-32 overflow-y-auto">
            {visible.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-1 text-xs">
                <span className="tabular-nums">{Math.round(l.amountMl)} ml</span>
                <span className="text-muted-foreground/70 text-[10px]">
                  {new Date(l.loggedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => removeLog(l.id)}
                  aria-label="Delete water log"
                  className="rounded p-0.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
