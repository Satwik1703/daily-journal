"use client";

import { useState } from "react";
import { customAlphabet } from "nanoid";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutate } from "@/lib/sync/mutate";
import { SERVING_UNITS, type Food, type ServingUnit } from "@/lib/food-meta";

const uid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

export function CustomFoodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (food: Food) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingUnit, setServingUnit] = useState<ServingUnit>("serving");
  const [servingSize, setServingSize] = useState("1");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  function reset() {
    setName("");
    setBrand("");
    setServingUnit("serving");
    setServingSize("1");
    setKcal("");
    setP("");
    setC("");
    setF("");
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name required");
      return;
    }
    const kcalN = Number.parseFloat(kcal);
    if (!Number.isFinite(kcalN) || kcalN <= 0) {
      toast.error("Enter calories");
      return;
    }
    const id = uid();
    const proteinG = Number.parseFloat(p) || 0;
    const carbsG = Number.parseFloat(c) || 0;
    const fatG = Number.parseFloat(f) || 0;
    const size = Number.parseFloat(servingSize) || 1;

    void mutate("create_food", {
      id,
      name: trimmed,
      brand: brand.trim() || null,
      servingUnit,
      servingSize: size,
      kcal: kcalN,
      proteinG,
      carbsG,
      fatG,
      source: "custom",
    });

    // Return an optimistic Food shape so the picker can immediately open a
    // quantity dialog against it. Backend row lands via the sync queue.
    onCreated({
      id,
      userId: "self",
      name: trimmed,
      brand: brand.trim() || null,
      category: null,
      servingUnit,
      servingSize: size,
      kcal: kcalN,
      proteinG,
      carbsG,
      fatG,
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
      source: "custom",
      offBarcode: null,
      isFavorite: false,
    });
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">New custom food</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Brand (optional)"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.25"
              placeholder="Serving size"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
              className="flex-1"
            />
            <select
              value={servingUnit}
              onChange={(e) => setServingUnit(e.target.value as ServingUnit)}
              className="rounded-md border border-border bg-transparent px-2 text-sm"
            >
              {SERVING_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Calories per serving"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Protein g"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Carbs g"
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Fat g"
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
          <Button type="button" onClick={submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
