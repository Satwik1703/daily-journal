"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mutate } from "@/lib/sync/mutate";
import type { FoodLog } from "@/lib/food-meta";
import { FoodPickerSheet } from "./food-picker-sheet";

export function MealCard({
  date,
  mealType,
  logs,
  onHide,
}: {
  date: string;
  mealType: string;
  logs: FoodLog[];
  onHide?: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = logs.filter((l) => !hidden.has(l.id));

  const subtotal = visible.reduce(
    (acc, l) => ({
      kcal: acc.kcal + l.kcal,
      protein: acc.protein + l.proteinG,
      carbs: acc.carbs + l.carbsG,
      fat: acc.fat + l.fatG,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function handleDelete(id: string) {
    setHidden((h) => {
      const next = new Set(h);
      next.add(id);
      return next;
    });
    onHide?.(id);
    void mutate("delete_food_log", { id, date });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="font-serif text-base font-normal">{mealType}</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(subtotal.kcal)} kcal
          {" · "}
          P {Math.round(subtotal.protein)}g · C {Math.round(subtotal.carbs)}g · F{" "}
          {Math.round(subtotal.fat)}g
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {visible.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.foodName}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {l.quantity} × · {Math.round(l.kcal)} kcal · P {Math.round(l.proteinG)}g
                    {" · "}C {Math.round(l.carbsG)}g · F {Math.round(l.fatG)}g
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(l.id)}
                  aria-label="Delete entry"
                  className="rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="w-full justify-center border border-dashed border-border text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="mr-1 size-3.5" /> Add food
        </Button>
      </CardContent>
      <FoodPickerSheet
        date={date}
        mealType={mealType}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </Card>
  );
}
