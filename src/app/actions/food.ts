"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import {
  foodFavorites,
  foodLogs,
  foods,
  foodRecipeItems,
  foodRecipes,
  nutritionProfile,
  waterLogs,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/context";
import { isValidDateString } from "@/lib/dates";
import {
  DEFAULT_MEAL_CATEGORIES,
  scaleNutrition,
  type ActivityLevel,
  type Goal,
  type Sex,
  type ServingUnit,
} from "@/lib/food-meta";

function coerceNonNegative(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function nullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

// ---------- Foods CRUD ----------

export async function createFood(input: {
  id?: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  servingUnit: ServingUnit;
  servingSize: number;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  source?: "custom" | "off";
  offBarcode?: string | null;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("name required");
  const servingUnit = input.servingUnit;
  if (!["g", "ml", "serving", "piece", "cup"].includes(servingUnit)) {
    throw new Error("bad servingUnit");
  }
  const id = input.id ?? nanoid(12);
  await db.insert(foods).values({
    id,
    userId: user.id,
    name,
    brand: nullableString(input.brand),
    category: nullableString(input.category),
    servingUnit,
    servingSize: coerceNonNegative(input.servingSize) || 1,
    kcal: coerceNonNegative(input.kcal),
    proteinG: coerceNonNegative(input.proteinG),
    carbsG: coerceNonNegative(input.carbsG),
    fatG: coerceNonNegative(input.fatG),
    fiberG: input.fiberG != null ? coerceNonNegative(input.fiberG) : null,
    sugarG: input.sugarG != null ? coerceNonNegative(input.sugarG) : null,
    sodiumMg: input.sodiumMg != null ? coerceNonNegative(input.sodiumMg) : null,
    source: input.source ?? "custom",
    offBarcode: nullableString(input.offBarcode),
  });
  revalidatePath("/food", "layout");
  return { id };
}

export async function updateFood(input: {
  id: string;
  name?: string;
  brand?: string | null;
  category?: string | null;
  servingUnit?: ServingUnit;
  servingSize?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
}): Promise<void> {
  const { user } = await requireUser();
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof foods.$inferInsert> = {};
  if (input.name !== undefined) patch.name = String(input.name).trim();
  if (input.brand !== undefined) patch.brand = nullableString(input.brand);
  if (input.category !== undefined) patch.category = nullableString(input.category);
  if (input.servingUnit !== undefined) patch.servingUnit = input.servingUnit;
  if (input.servingSize !== undefined) patch.servingSize = coerceNonNegative(input.servingSize) || 1;
  if (input.kcal !== undefined) patch.kcal = coerceNonNegative(input.kcal);
  if (input.proteinG !== undefined) patch.proteinG = coerceNonNegative(input.proteinG);
  if (input.carbsG !== undefined) patch.carbsG = coerceNonNegative(input.carbsG);
  if (input.fatG !== undefined) patch.fatG = coerceNonNegative(input.fatG);
  if (input.fiberG !== undefined) patch.fiberG = input.fiberG == null ? null : coerceNonNegative(input.fiberG);
  if (input.sugarG !== undefined) patch.sugarG = input.sugarG == null ? null : coerceNonNegative(input.sugarG);
  if (input.sodiumMg !== undefined) patch.sodiumMg = input.sodiumMg == null ? null : coerceNonNegative(input.sodiumMg);
  if (Object.keys(patch).length > 0) {
    // Only allow updates on the user's own foods, never global seed rows.
    await db
      .update(foods)
      .set(patch)
      .where(and(eq(foods.id, input.id), eq(foods.userId, user.id)));
  }
  revalidatePath("/food", "layout");
}

export async function deleteFood(id: string): Promise<void> {
  const { user } = await requireUser();
  if (!id) throw new Error("id required");
  await db
    .delete(foods)
    .where(and(eq(foods.id, id), eq(foods.userId, user.id)));
  revalidatePath("/food", "layout");
}

/**
 * Per-user favorite. Works on both user-owned foods AND global seed rows
 * via the food_favorites join table (Phase 16 follow-up).
 */
export async function favoriteFood(input: {
  id: string;
  isFavorite: boolean;
}): Promise<void> {
  const { user } = await requireUser();
  if (!input.id) throw new Error("id required");
  if (input.isFavorite) {
    // Idempotent — ignore duplicate PK collisions.
    try {
      await db
        .insert(foodFavorites)
        .values({ userId: user.id, foodId: input.id });
    } catch {
      /* already favorited */
    }
  } else {
    await db
      .delete(foodFavorites)
      .where(
        and(
          eq(foodFavorites.userId, user.id),
          eq(foodFavorites.foodId, input.id),
        ),
      );
  }
  revalidatePath("/food", "layout");
}

// ---------- Food logs ----------

export async function logFood(input: {
  id?: string;
  date: string;
  mealType: string;
  foodId?: string | null;
  foodName: string;
  quantity: number;
  // If foodId is set + these are omitted, we scale from the foods row.
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  note?: string | null;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const mealType = String(input.mealType || "").trim();
  if (!mealType) throw new Error("mealType required");
  const foodName = String(input.foodName || "").trim();
  if (!foodName) throw new Error("foodName required");
  const quantity = coerceNonNegative(input.quantity) || 1;

  let kcal = input.kcal != null ? coerceNonNegative(input.kcal) : null;
  let proteinG = input.proteinG != null ? coerceNonNegative(input.proteinG) : null;
  let carbsG = input.carbsG != null ? coerceNonNegative(input.carbsG) : null;
  let fatG = input.fatG != null ? coerceNonNegative(input.fatG) : null;

  // If macros weren't supplied but we have a foodId, derive from foods row.
  if ((kcal == null || proteinG == null || carbsG == null || fatG == null) && input.foodId) {
    const rows = await db
      .select()
      .from(foods)
      .where(eq(foods.id, input.foodId))
      .limit(1);
    const f = rows[0];
    if (f) {
      const scaled = scaleNutrition(
        { kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG },
        quantity,
      );
      kcal = scaled.kcal;
      proteinG = scaled.proteinG;
      carbsG = scaled.carbsG;
      fatG = scaled.fatG;
    }
  }

  const id = input.id ?? nanoid(12);
  await db.insert(foodLogs).values({
    id,
    userId: user.id,
    date: input.date,
    mealType,
    foodId: input.foodId ?? null,
    foodName,
    quantity,
    kcal: kcal ?? 0,
    proteinG: proteinG ?? 0,
    carbsG: carbsG ?? 0,
    fatG: fatG ?? 0,
    note: nullableString(input.note),
  });
  revalidatePath("/food", "layout");
  return { id };
}

export async function updateFoodLog(input: {
  id: string;
  quantity?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  note?: string | null;
  mealType?: string;
}): Promise<void> {
  const { user } = await requireUser();
  if (!input.id) throw new Error("id required");
  const patch: Partial<typeof foodLogs.$inferInsert> = {};
  if (input.quantity !== undefined) patch.quantity = coerceNonNegative(input.quantity) || 1;
  if (input.kcal !== undefined) patch.kcal = coerceNonNegative(input.kcal);
  if (input.proteinG !== undefined) patch.proteinG = coerceNonNegative(input.proteinG);
  if (input.carbsG !== undefined) patch.carbsG = coerceNonNegative(input.carbsG);
  if (input.fatG !== undefined) patch.fatG = coerceNonNegative(input.fatG);
  if (input.note !== undefined) patch.note = nullableString(input.note);
  if (input.mealType !== undefined) patch.mealType = String(input.mealType).trim();
  if (Object.keys(patch).length > 0) {
    await db
      .update(foodLogs)
      .set(patch)
      .where(and(eq(foodLogs.id, input.id), eq(foodLogs.userId, user.id)));
  }
  revalidatePath("/food", "layout");
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { user } = await requireUser();
  if (!id) throw new Error("id required");
  await db
    .delete(foodLogs)
    .where(and(eq(foodLogs.id, id), eq(foodLogs.userId, user.id)));
  revalidatePath("/food", "layout");
}

// ---------- Water ----------

export async function logWater(input: {
  id?: string;
  date: string;
  amountMl: number;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  if (!isValidDateString(input.date)) throw new Error("bad date");
  const amount = coerceNonNegative(input.amountMl);
  if (amount === 0) throw new Error("amount must be > 0");
  const id = input.id ?? nanoid(12);
  await db.insert(waterLogs).values({
    id,
    userId: user.id,
    date: input.date,
    amountMl: amount,
  });
  revalidatePath("/food", "layout");
  return { id };
}

export async function deleteWaterLog(id: string): Promise<void> {
  const { user } = await requireUser();
  if (!id) throw new Error("id required");
  await db
    .delete(waterLogs)
    .where(and(eq(waterLogs.id, id), eq(waterLogs.userId, user.id)));
  revalidatePath("/food", "layout");
}

// ---------- Nutrition profile ----------

export async function updateNutritionProfile(input: {
  heightCm?: number | null;
  age?: number | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  rateKgPerWeek?: number | null;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  dailyKcalTarget?: number | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  waterTargetMl?: number;
}): Promise<void> {
  const { user } = await requireUser();
  const patch: Partial<typeof nutritionProfile.$inferInsert> = {};
  if (input.heightCm !== undefined) {
    patch.heightCm = input.heightCm == null ? null : coerceNonNegative(input.heightCm);
  }
  if (input.age !== undefined) {
    patch.age = input.age == null ? null : Math.max(0, Math.round(Number(input.age)));
  }
  if (input.sex !== undefined) patch.sex = input.sex;
  if (input.activityLevel !== undefined) patch.activityLevel = input.activityLevel;
  if (input.goal !== undefined) patch.goal = input.goal;
  if (input.rateKgPerWeek !== undefined) {
    patch.rateKgPerWeek =
      input.rateKgPerWeek == null ? null : coerceNonNegative(input.rateKgPerWeek);
  }
  if (input.targetWeightKg !== undefined) {
    patch.targetWeightKg =
      input.targetWeightKg == null ? null : coerceNonNegative(input.targetWeightKg);
  }
  if (input.targetDate !== undefined) patch.targetDate = nullableString(input.targetDate);
  if (input.dailyKcalTarget !== undefined) {
    patch.dailyKcalTarget =
      input.dailyKcalTarget == null ? null : coerceNonNegative(input.dailyKcalTarget);
  }
  if (input.proteinTargetG !== undefined) {
    patch.proteinTargetG =
      input.proteinTargetG == null ? null : coerceNonNegative(input.proteinTargetG);
  }
  if (input.carbsTargetG !== undefined) {
    patch.carbsTargetG =
      input.carbsTargetG == null ? null : coerceNonNegative(input.carbsTargetG);
  }
  if (input.fatTargetG !== undefined) {
    patch.fatTargetG = input.fatTargetG == null ? null : coerceNonNegative(input.fatTargetG);
  }
  if (input.waterTargetMl !== undefined) patch.waterTargetMl = coerceNonNegative(input.waterTargetMl) || 2500;
  patch.updatedAt = new Date();

  // Upsert.
  await db
    .insert(nutritionProfile)
    .values({ userId: user.id, ...patch })
    .onConflictDoUpdate({ target: nutritionProfile.userId, set: patch });
  revalidatePath("/food", "layout");
  revalidatePath("/settings", "layout");
}

export async function setMealCategories(input: {
  categories: string[];
}): Promise<void> {
  const { user } = await requireUser();
  const arr = (input.categories ?? [])
    .filter((s) => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const finalArr = arr.length > 0 ? arr : DEFAULT_MEAL_CATEGORIES;
  const json = JSON.stringify(finalArr);
  await db
    .insert(nutritionProfile)
    .values({ userId: user.id, mealCategoriesJson: json, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: nutritionProfile.userId,
      set: { mealCategoriesJson: json, updatedAt: new Date() },
    });
  revalidatePath("/food", "layout");
  revalidatePath("/settings", "layout");
}

// ---------- Recipes ----------

export async function createRecipe(input: {
  id?: string;
  name: string;
  emoji?: string | null;
  servings: number;
  items: Array<{ foodId: string; quantity: number; unit?: string | null }>;
}): Promise<{ id: string }> {
  const { user } = await requireUser();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("name required");
  const servings = coerceNonNegative(input.servings) || 1;
  const items = (input.items ?? []).filter((it) => it.foodId);
  if (items.length === 0) throw new Error("at least one item required");

  // Compute aggregate macros by scaling each item's food row.
  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const it of items) {
    const rows = await db.select().from(foods).where(eq(foods.id, it.foodId)).limit(1);
    const food = rows[0];
    if (!food) continue;
    const q = coerceNonNegative(it.quantity) || 1;
    kcal += food.kcal * q;
    p += food.proteinG * q;
    c += food.carbsG * q;
    f += food.fatG * q;
  }
  const id = input.id ?? nanoid(12);
  await db.transaction(async (tx) => {
    await tx.insert(foodRecipes).values({
      id,
      userId: user.id,
      name,
      emoji: nullableString(input.emoji),
      servings,
      totalKcal: Math.round(kcal),
      totalProteinG: Math.round(p * 10) / 10,
      totalCarbsG: Math.round(c * 10) / 10,
      totalFatG: Math.round(f * 10) / 10,
    });
    for (const it of items) {
      await tx.insert(foodRecipeItems).values({
        id: nanoid(12),
        recipeId: id,
        foodId: it.foodId,
        quantity: coerceNonNegative(it.quantity) || 1,
        unit: nullableString(it.unit),
      });
    }
  });
  revalidatePath("/food", "layout");
  return { id };
}

export async function deleteRecipe(id: string): Promise<void> {
  const { user } = await requireUser();
  if (!id) throw new Error("id required");
  await db
    .delete(foodRecipes)
    .where(and(eq(foodRecipes.id, id), eq(foodRecipes.userId, user.id)));
  revalidatePath("/food", "layout");
}
