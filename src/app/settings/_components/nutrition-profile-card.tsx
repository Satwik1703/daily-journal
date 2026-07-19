"use client";

import { useEffect, useState } from "react";
import { Utensils, GripVertical, X, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutate } from "@/lib/sync/mutate";
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIER,
  GOAL_LABELS,
  bmrMifflin,
  dailyKcalTargetFor,
  defaultMacroSplit,
  tdee,
  type ActivityLevel,
  type Goal,
  type NutritionProfile,
  type Sex,
} from "@/lib/food-meta";

export function NutritionProfileCard({
  initial,
  currentWeightKg,
}: {
  initial: NutritionProfile;
  currentWeightKg: number | null;
}) {
  const [heightCm, setHeightCm] = useState(
    initial.heightCm != null ? String(initial.heightCm) : "",
  );
  const [age, setAge] = useState(initial.age != null ? String(initial.age) : "");
  const [sex, setSex] = useState<Sex | "">(initial.sex ?? "");
  const [activity, setActivity] = useState<ActivityLevel>(initial.activityLevel);
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [rate, setRate] = useState(
    initial.rateKgPerWeek != null ? String(initial.rateKgPerWeek) : "0.5",
  );
  const [targetWeight, setTargetWeight] = useState(
    initial.targetWeightKg != null ? String(initial.targetWeightKg) : "",
  );
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? "");
  const [customKcal, setCustomKcal] = useState(
    initial.dailyKcalTarget != null ? String(Math.round(initial.dailyKcalTarget)) : "",
  );
  const [waterMl, setWaterMl] = useState(String(initial.waterTargetMl));

  // Derived preview using current weight from gym body_weight_logs.
  const heightN = Number.parseFloat(heightCm);
  const ageN = Number.parseFloat(age);
  const rateN = Number.parseFloat(rate);
  const weightN = currentWeightKg ?? 0;
  const preview =
    weightN > 0 && Number.isFinite(heightN) && heightN > 0 && Number.isFinite(ageN) && ageN > 0 && sex
      ? (() => {
          const bmr = bmrMifflin(weightN, heightN, ageN, sex as Sex);
          const tdeeV = tdee(bmr, activity);
          const target = dailyKcalTargetFor(tdeeV, goal, Number.isFinite(rateN) ? rateN : null);
          const macros = defaultMacroSplit(target);
          return { bmr: Math.round(bmr), tdee: Math.round(tdeeV), target, macros };
        })()
      : null;

  function save() {
    const payload = {
      heightCm: heightN > 0 ? heightN : null,
      age: ageN > 0 ? Math.round(ageN) : null,
      sex: sex === "" ? null : sex,
      activityLevel: activity,
      goal,
      rateKgPerWeek: Number.isFinite(rateN) && rateN > 0 ? rateN : null,
      targetWeightKg: Number.parseFloat(targetWeight) || null,
      targetDate: targetDate.trim() || null,
      dailyKcalTarget:
        customKcal.trim().length > 0
          ? Number.parseFloat(customKcal)
          : preview?.target ?? null,
      proteinTargetG: preview?.macros.proteinG ?? null,
      carbsTargetG: preview?.macros.carbsG ?? null,
      fatTargetG: preview?.macros.fatG ?? null,
      waterTargetMl: Number.parseFloat(waterMl) || 2500,
    };
    void mutate("update_nutrition_profile", payload);
    toast.success("Nutrition profile saved");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 font-serif text-lg font-normal">
          <Utensils className="size-4" /> Nutrition profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Height (cm)">
            <Input
              type="number"
              inputMode="numeric"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </Field>
          <Field label="Age">
            <Input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </Field>
          <Field label="Sex">
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex | "")}
              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        <Field label="Activity level">
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
          >
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Goal">
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
            >
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          {goal !== "maintain" ? (
            <Field label="Rate (kg / week)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Target weight (kg)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
          </Field>
          <Field label="Target date (optional)">
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Custom kcal (blank = auto)">
            <Input
              type="number"
              inputMode="numeric"
              placeholder={preview ? String(preview.target) : "auto"}
              value={customKcal}
              onChange={(e) => setCustomKcal(e.target.value)}
            />
          </Field>
          <Field label="Water target (ml)">
            <Input
              type="number"
              inputMode="numeric"
              value={waterMl}
              onChange={(e) => setWaterMl(e.target.value)}
            />
          </Field>
        </div>

        {preview ? (
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-0.5">
            <p className="tabular-nums">
              BMR: <strong>{preview.bmr}</strong> kcal · TDEE (×{ACTIVITY_MULTIPLIER[activity]}):{" "}
              <strong>{preview.tdee}</strong> kcal
            </p>
            <p className="tabular-nums">
              Daily target: <strong>{preview.target}</strong> kcal · Macros: P{" "}
              {preview.macros.proteinG}g / C {preview.macros.carbsG}g / F {preview.macros.fatG}g
            </p>
          </div>
        ) : currentWeightKg == null ? (
          <p className="text-xs text-muted-foreground italic">
            Log a body weight in Gym to compute TDEE and default targets.
          </p>
        ) : null}

        <Button type="button" onClick={save} size="sm" className="w-full">
          <Save className="mr-1 size-3.5" /> Save profile
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-0.5">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function MealCategoriesEditor({ initial }: { initial: string[] }) {
  const [cats, setCats] = useState<string[]>(initial);
  const [adding, setAdding] = useState("");

  useEffect(() => setCats(initial), [initial]);

  function commit(next: string[]) {
    setCats(next);
    void mutate("set_meal_categories", { categories: next });
  }

  function remove(i: number) {
    if (cats.length <= 1) {
      toast.error("Need at least one meal category");
      return;
    }
    commit(cats.filter((_, idx) => idx !== i));
  }

  function rename(i: number, v: string) {
    commit(cats.map((c, idx) => (idx === i ? v : c)));
  }

  function add() {
    const trimmed = adding.trim();
    if (!trimmed) return;
    if (cats.length >= 8) {
      toast.error("Max 8 meal categories");
      return;
    }
    commit([...cats, trimmed]);
    setAdding("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const next = [...cats];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg font-normal">Meal categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {cats.map((c, i) => (
            <li key={i} className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
              <div className="flex flex-col text-muted-foreground/60">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="hover:text-foreground">
                  <GripVertical className="size-3 rotate-90" />
                </button>
              </div>
              <Input
                value={c}
                onChange={(e) => rename(i, e.target.value)}
                onBlur={() => commit(cats)}
                className="h-8 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                className="rounded p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder="Add category (e.g. Pre-workout)"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button type="button" size="sm" onClick={add}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Reorder w/ the grip · rename inline · min 1, max 8.
        </p>
      </CardContent>
    </Card>
  );
}
