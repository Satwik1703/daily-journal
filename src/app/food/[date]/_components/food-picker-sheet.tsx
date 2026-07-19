"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Star, X, Plus } from "lucide-react";
import { customAlphabet } from "nanoid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutate } from "@/lib/sync/mutate";
import { authAwareFetch } from "@/lib/sync/auth-fetch";
import { useCachedPage } from "@/lib/sync/cache";
import type { Food, FoodLog } from "@/lib/food-meta";
import { scaleNutrition } from "@/lib/food-meta";
import { CustomFoodDialog } from "./custom-food-dialog";

const uid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

type Tab = "search" | "recent" | "favorites" | "custom";

type PageData = {
  date: string;
  foodLogs: FoodLog[];
  recentFoods: Food[];
  favoriteFoods: Food[];
};

export function FoodPickerSheet({
  date,
  mealType,
  open,
  onOpenChange,
}: {
  date: string;
  mealType: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [remoteResults, setRemoteResults] = useState<{ local: Food[]; off: Food[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  // Read the current day payload (already fetched by the parent page).
  // If we hit this without a cached parent, still works via /api/page/food/[date].
  const data = useCachedPage<PageData | null>(
    `food:${date}`,
    null,
    async () => {
      const res = await authAwareFetch(`/api/page/food/${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as PageData;
    },
  );

  // Debounce the search field.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Hit the search endpoint whenever the debounced query settles + we're on the Search tab.
  useEffect(() => {
    if (!open) return;
    if (tab !== "search") return;
    const query = debouncedQ;
    if (!query) {
      setRemoteResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        const res = await authAwareFetch(
          `/api/food-search?q=${encodeURIComponent(query)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.ok) {
          setRemoteResults((await res.json()) as { local: Food[]; off: Food[] });
        } else {
          setRemoteResults({ local: [], off: [] });
        }
      } catch {
        if (!cancelled) setRemoteResults({ local: [], off: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQ, tab]);

  // Reset per-open.
  useEffect(() => {
    if (open) {
      setTab("recent");
      setQ("");
      setDebouncedQ("");
      setRemoteResults(null);
      setPicked(null);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              Add to {mealType}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {(["recent", "favorites", "search", "custom"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "border-b-2 px-3 py-1.5 text-xs capitalize " +
                    (tab === t
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  {t === "favorites" ? "Fav" : t}
                </button>
              ))}
            </div>

            {tab === "search" ? (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search foods (uses Open Food Facts for anything not in the seed)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-7"
                />
                {searching ? (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            ) : null}

            <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6">
              {tab === "recent" ? (
                <FoodList
                  foods={data?.recentFoods ?? []}
                  emptyHint="No recent foods yet. Log something and it'll appear here."
                  onPick={setPicked}
                />
              ) : tab === "favorites" ? (
                <FoodList
                  foods={data?.favoriteFoods ?? []}
                  emptyHint="No favorites yet. Star a custom food to add it."
                  onPick={setPicked}
                />
              ) : tab === "search" ? (
                debouncedQ.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Type to search. First checks your foods + seed, then Open Food Facts.
                  </p>
                ) : remoteResults == null ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Searching…</p>
                ) : (
                  <SearchResults results={remoteResults} onPick={setPicked} />
                )
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <p>Create a food that isn&apos;t in the database.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomOpen(true)}
                    className="mt-3"
                  >
                    <Plus className="mr-1 size-3.5" /> New custom food
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {picked ? (
        <QuantityDialog
          food={picked}
          date={date}
          mealType={mealType}
          onClose={() => setPicked(null)}
          onLogged={() => {
            setPicked(null);
            onOpenChange(false);
          }}
        />
      ) : null}

      <CustomFoodDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onCreated={(food) => {
          setCustomOpen(false);
          setPicked(food);
        }}
      />
    </>
  );
}

function FoodList({
  foods,
  emptyHint,
  onPick,
}: {
  foods: Food[];
  emptyHint: string;
  onPick: (f: Food) => void;
}) {
  if (foods.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{emptyHint}</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {foods.map((f) => (
        <FoodRow key={f.id} food={f} onPick={() => onPick(f)} />
      ))}
    </ul>
  );
}

function SearchResults({
  results,
  onPick,
}: {
  results: { local: Food[]; off: Food[] };
  onPick: (f: Food) => void;
}) {
  const nothing = results.local.length === 0 && results.off.length === 0;
  return (
    <div>
      {results.local.length > 0 ? (
        <>
          <p className="mb-1 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Local / seeded
          </p>
          <ul className="divide-y divide-border/40 mb-3">
            {results.local.map((f) => (
              <FoodRow key={f.id} food={f} onPick={() => onPick(f)} />
            ))}
          </ul>
        </>
      ) : null}
      {results.off.length > 0 ? (
        <>
          <p className="mb-1 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Open Food Facts
          </p>
          <ul className="divide-y divide-border/40">
            {results.off.map((f) => (
              <FoodRow key={f.id} food={f} onPick={() => onPick(f)} />
            ))}
          </ul>
        </>
      ) : null}
      {nothing ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No matches. Try a different name, or create a custom food.
        </p>
      ) : null}
    </div>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-start gap-2 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <div className="mt-0.5 shrink-0">
          {food.source === "custom" ? (
            <span className="rounded bg-primary/15 px-1 py-0 text-[9px] uppercase text-primary">
              Custom
            </span>
          ) : food.source === "off" ? (
            <span className="rounded bg-amber-500/20 px-1 py-0 text-[9px] uppercase text-amber-700 dark:text-amber-300">
              OFF
            </span>
          ) : (
            <span className="rounded bg-muted px-1 py-0 text-[9px] uppercase text-muted-foreground">
              Seed
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {food.name}
            {food.brand ? (
              <span className="text-xs text-muted-foreground"> · {food.brand}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {Math.round(food.kcal)} kcal · P {food.proteinG}g · C {food.carbsG}g · F {food.fatG}g
            <span className="text-muted-foreground/80"> per {food.servingSize}{food.servingUnit === "g" || food.servingUnit === "ml" ? food.servingUnit : ` ${food.servingUnit}`}</span>
          </p>
        </div>
        {food.isFavorite ? (
          <Star className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        ) : null}
      </button>
    </li>
  );
}

function QuantityDialog({
  food,
  date,
  mealType,
  onClose,
  onLogged,
}: {
  food: Food;
  date: string;
  mealType: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 20);
  }, []);
  const qNum = Number.parseFloat(quantity);
  const q = Number.isFinite(qNum) && qNum > 0 ? qNum : 1;
  const scaled = scaleNutrition(food, q);

  function submit() {
    const id = uid();
    // For OFF results, save into the user's custom foods first so future logs
    // reference a stable row.
    if (food.source === "off") {
      const foodDbId = uid();
      void mutate("create_food", {
        id: foodDbId,
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
      void mutate("log_food", {
        id,
        date,
        mealType,
        foodId: foodDbId,
        foodName: food.name,
        quantity: q,
        kcal: scaled.kcal,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
      });
    } else {
      void mutate("log_food", {
        id,
        date,
        mealType,
        foodId: food.id,
        foodName: food.name,
        quantity: q,
        kcal: scaled.kcal,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
      });
    }
    onLogged();
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">{food.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Per serving ({food.servingSize} {food.servingUnit}): {Math.round(food.kcal)} kcal · P{" "}
            {food.proteinG}g · C {food.carbsG}g · F {food.fatG}g
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Quantity</label>
            <Input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">
              × ({food.servingSize} {food.servingUnit})
            </span>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <p className="font-medium tabular-nums">{scaled.kcal} kcal</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              P {scaled.proteinG}g · C {scaled.carbsG}g · F {scaled.fatG}g
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="mr-1 size-3.5" /> Cancel
            </Button>
            <Button type="button" size="sm" onClick={submit}>
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
