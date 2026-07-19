"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search, ChefHat } from "lucide-react";
import { customAlphabet } from "nanoid";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutate } from "@/lib/sync/mutate";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import type { Food } from "@/lib/food-meta";
import { scaleNutrition } from "@/lib/food-meta";

const uid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

type Item = { food: Food; quantity: number };

export function RecipeBuilderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (recipeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [servings, setServings] = useState("1");
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);

  // Reset per-open.
  useEffect(() => {
    if (open) {
      setName("");
      setEmoji("");
      setServings("1");
      setItems([]);
      setQ("");
      setResults([]);
    }
  }, [open]);

  // Debounced search — reuses /api/food-search but only shows the local
  // slice (recipe ingredients should be things the DB already knows about).
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await authAwareFetch(
          `/api/food-search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { local: Food[]; off: Food[] };
          setResults([...body.local, ...body.off].slice(0, 8));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, open]);

  const totals = items.reduce(
    (acc, it) => {
      const scaled = scaleNutrition(it.food, it.quantity);
      return {
        kcal: acc.kcal + scaled.kcal,
        proteinG: acc.proteinG + scaled.proteinG,
        carbsG: acc.carbsG + scaled.carbsG,
        fatG: acc.fatG + scaled.fatG,
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const servingsN = Math.max(1, Number.parseFloat(servings) || 1);
  const perServing = {
    kcal: Math.round(totals.kcal / servingsN),
    proteinG: Math.round((totals.proteinG / servingsN) * 10) / 10,
    carbsG: Math.round((totals.carbsG / servingsN) * 10) / 10,
    fatG: Math.round((totals.fatG / servingsN) * 10) / 10,
  };

  function addIngredient(food: Food) {
    // If the picked food came from OFF, we need it saved as a custom food
    // first so the recipe items FK is valid. Bounce those through
    // create_food + swap the food.id to the new server-persisted id.
    if (food.source === "off") {
      const dbId = uid();
      void mutate("create_food", {
        id: dbId,
        name: food.name,
        brand: food.brand,
        servingUnit: food.servingUnit,
        servingSize: food.servingSize,
        kcal: food.kcal,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        source: "off",
        offBarcode: food.offBarcode,
      });
      food = { ...food, id: dbId, userId: "self" };
    }
    setItems((prev) => [...prev, { food, quantity: 1 }]);
    setQ("");
    setResults([]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setItemQty(idx: number, v: string) {
    const n = Number.parseFloat(v);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, quantity: Number.isFinite(n) && n > 0 ? n : 1 } : it,
      ),
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Recipe needs a name");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }
    const id = uid();
    void mutate("create_recipe", {
      id,
      name: trimmed,
      emoji: emoji.trim() || null,
      servings: servingsN,
      items: items.map((it) => ({
        foodId: it.food.id,
        quantity: it.quantity,
      })),
    });
    toast.success(`Saved recipe: ${trimmed}`);
    onCreated?.(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 font-serif text-base">
            <ChefHat className="size-4" /> Recipe builder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Basics */}
          <div className="grid grid-cols-[1fr_60px_80px] gap-2">
            <Input
              placeholder="Recipe name (e.g. My protein pancakes)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="text-center"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              title="Servings"
            />
          </div>

          {/* Ingredient search */}
          <div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search foods to add (e.g. paneer, egg, oats)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-7"
              />
            </div>
            {q.length > 0 ? (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border/60 bg-muted/10">
                {searching && results.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-muted-foreground">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-muted-foreground">
                    No matches
                  </p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {results.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => addIngredient(f)}
                          className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-muted/40"
                        >
                          <span className="text-sm truncate">{f.name}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                            {Math.round(f.kcal)} kcal · {f.servingSize} {f.servingUnit}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {/* Items list */}
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Ingredients ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/10 py-4 text-center text-[11px] text-muted-foreground">
                Search above to add ingredients.
              </p>
            ) : (
              <ul className="divide-y divide-border/40 rounded-md border border-border/60 bg-muted/10">
                {items.map((it, idx) => (
                  <li key={idx} className="flex items-center gap-2 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">{it.food.name}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0.1"
                      value={it.quantity}
                      onChange={(e) => setItemQty(idx, e.target.value)}
                      className="h-7 w-16 text-center"
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      × ({it.food.servingSize}{it.food.servingUnit === "g" || it.food.servingUnit === "ml" ? it.food.servingUnit : ` ${it.food.servingUnit}`})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label="Remove"
                      className="rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals preview */}
          {items.length > 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-0.5">
              <p>
                Total: <strong className="tabular-nums">{Math.round(totals.kcal)}</strong> kcal · P{" "}
                {Math.round(totals.proteinG)}g · C {Math.round(totals.carbsG)}g · F {Math.round(totals.fatG)}g
              </p>
              <p className="text-muted-foreground">
                Per serving ({servingsN}): <strong className="tabular-nums">{perServing.kcal}</strong>{" "}
                kcal · P {perServing.proteinG}g · C {perServing.carbsG}g · F {perServing.fatG}g
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
          <Button type="button" onClick={save}>
            <Plus className="mr-1 size-3.5" /> Save recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
