import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
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
import type {
  Food,
  FoodLog,
  NutritionProfile,
  ServingUnit,
  WaterLog,
} from "@/lib/food-meta";
import {
  DEFAULT_MEAL_CATEGORIES,
  parseMealCategories,
} from "@/lib/food-meta";

// ---------- Foods ----------

function toFood(
  r: typeof foods.$inferSelect,
  isFav: boolean,
): Food {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    brand: r.brand,
    category: r.category,
    servingUnit: r.servingUnit as ServingUnit,
    servingSize: r.servingSize,
    kcal: r.kcal,
    proteinG: r.proteinG,
    carbsG: r.carbsG,
    fatG: r.fatG,
    fiberG: r.fiberG,
    sugarG: r.sugarG,
    sodiumMg: r.sodiumMg,
    source: r.source as Food["source"],
    offBarcode: r.offBarcode,
    isFavorite: isFav,
  };
}

async function getFavoriteIdSet(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ foodId: foodFavorites.foodId })
    .from(foodFavorites)
    .where(eq(foodFavorites.userId, userId));
  return new Set(rows.map((r) => r.foodId));
}

/**
 * All foods visible to `userId`: their own custom foods + global seeds.
 * `q` filters by name / brand (case-insensitive LIKE) if provided.
 */
export async function searchFoods(
  userId: string,
  q?: string,
  limit = 40,
): Promise<Food[]> {
  const conds = [
    or(eq(foods.userId, userId), isNull(foods.userId)),
    isNull(foods.archivedAt),
  ];
  if (q && q.trim().length > 0) {
    const like_ = `%${q.trim().toLowerCase()}%`;
    conds.push(
      or(
        like(sql`lower(${foods.name})`, like_),
        like(sql`lower(coalesce(${foods.brand}, ''))`, like_),
      ),
    );
  }
  const [rows, favIds] = await Promise.all([
    db
      .select()
      .from(foods)
      .where(and(...conds.filter(Boolean)))
      .orderBy(asc(foods.name))
      .limit(limit),
    getFavoriteIdSet(userId),
  ]);
  return rows.map((r) => toFood(r, favIds.has(r.id)));
}

/** Foods the user has logged most recently (with dedup by foodId). */
export async function getRecentFoods(
  userId: string,
  limit = 12,
): Promise<Food[]> {
  const rows = await db
    .select({ foodId: foodLogs.foodId })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), sql`${foodLogs.foodId} is not null`))
    .orderBy(desc(foodLogs.loggedAt))
    .limit(80);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of rows) {
    if (r.foodId && !seen.has(r.foodId)) {
      seen.add(r.foodId);
      ids.push(r.foodId);
      if (ids.length >= limit) break;
    }
  }
  if (ids.length === 0) return [];
  const [foodRows, favIds] = await Promise.all([
    db
      .select()
      .from(foods)
      .where(
        and(
          inArray(foods.id, ids),
          or(eq(foods.userId, userId), isNull(foods.userId)),
        ),
      ),
    getFavoriteIdSet(userId),
  ]);
  const byId = new Map(foodRows.map((f) => [f.id, toFood(f, favIds.has(f.id))]));
  return ids.map((id) => byId.get(id)).filter((f): f is Food => f != null);
}

export async function getFavoriteFoods(userId: string): Promise<Food[]> {
  const rows = await db
    .select({ food: foods })
    .from(foodFavorites)
    .innerJoin(foods, eq(foods.id, foodFavorites.foodId))
    .where(
      and(
        eq(foodFavorites.userId, userId),
        or(eq(foods.userId, userId), isNull(foods.userId)),
        isNull(foods.archivedAt),
      ),
    )
    .orderBy(asc(foods.name));
  return rows.map((r) => toFood(r.food, true));
}

export async function getFoodById(
  userId: string,
  id: string,
): Promise<Food | null> {
  const rows = await db
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, id),
        or(eq(foods.userId, userId), isNull(foods.userId)),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  const favIds = await getFavoriteIdSet(userId);
  return toFood(rows[0], favIds.has(rows[0].id));
}

/** New: month-status map for the food date-stepper calendar popover.
 *  Status derived from kcal-vs-daily-target using the shared JournalStatus
 *  palette so the popover matches journal/habits/goals visually.
 *
 *  crazy  → within  ±10% of target
 *  great  → within  ±20% of target
 *  good   → within  ±35% of target
 *  avg    → any logs but way off
 *  bad    → had a target-set profile but zero logs (only for past days)
 *  empty  → no logs and target ineligible (no profile or future day)
 */
export type FoodDayStatus = "crazy" | "great" | "good" | "avg" | "bad" | "empty";
export async function getFoodMonthStatus(
  userId: string,
  start: string,
  end: string,
): Promise<Record<string, FoodDayStatus>> {
  const [daily, profile] = await Promise.all([
    getFoodDailyTotals(userId, start, end),
    getNutritionProfile(userId),
  ]);
  const target = profile.dailyKcalTarget ?? 0;
  const byDate: Record<string, FoodDayStatus> = {};
  for (const d of daily) {
    if (d.kcal <= 0) continue;
    if (target <= 0) {
      byDate[d.date] = "good";
      continue;
    }
    const ratio = d.kcal / target;
    const off = Math.abs(ratio - 1);
    if (off <= 0.1) byDate[d.date] = "crazy";
    else if (off <= 0.2) byDate[d.date] = "great";
    else if (off <= 0.35) byDate[d.date] = "good";
    else byDate[d.date] = "avg";
  }
  return byDate;
}

// ---------- Food logs ----------

function toFoodLog(r: typeof foodLogs.$inferSelect): FoodLog {
  return {
    id: r.id,
    date: r.date,
    mealType: r.mealType,
    foodId: r.foodId,
    foodName: r.foodName,
    quantity: r.quantity,
    kcal: r.kcal,
    proteinG: r.proteinG,
    carbsG: r.carbsG,
    fatG: r.fatG,
    note: r.note,
    loggedAt:
      r.loggedAt instanceof Date ? r.loggedAt.getTime() : Number(r.loggedAt),
  };
}

export async function getFoodLogsForDate(
  userId: string,
  date: string,
): Promise<FoodLog[]> {
  const rows = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.date, date)))
    .orderBy(asc(foodLogs.loggedAt));
  return rows.map(toFoodLog);
}

/**
 * Aggregate kcal per date for a range. Used by the Insights nutrition section.
 */
export async function getFoodDailyTotals(
  userId: string,
  start: string,
  end: string,
): Promise<
  Array<{
    date: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>
> {
  const rows = await db
    .select({
      date: foodLogs.date,
      kcal: sql<number>`sum(${foodLogs.kcal})`,
      proteinG: sql<number>`sum(${foodLogs.proteinG})`,
      carbsG: sql<number>`sum(${foodLogs.carbsG})`,
      fatG: sql<number>`sum(${foodLogs.fatG})`,
    })
    .from(foodLogs)
    .where(
      and(
        eq(foodLogs.userId, userId),
        gte(foodLogs.date, start),
        lte(foodLogs.date, end),
      ),
    )
    .groupBy(foodLogs.date)
    .orderBy(asc(foodLogs.date));
  return rows.map((r) => ({
    date: r.date,
    kcal: r.kcal ?? 0,
    proteinG: r.proteinG ?? 0,
    carbsG: r.carbsG ?? 0,
    fatG: r.fatG ?? 0,
  }));
}

// ---------- Water ----------

function toWaterLog(r: typeof waterLogs.$inferSelect): WaterLog {
  return {
    id: r.id,
    date: r.date,
    amountMl: r.amountMl,
    loggedAt:
      r.loggedAt instanceof Date ? r.loggedAt.getTime() : Number(r.loggedAt),
  };
}

export async function getWaterLogsForDate(
  userId: string,
  date: string,
): Promise<WaterLog[]> {
  const rows = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date)))
    .orderBy(asc(waterLogs.loggedAt));
  return rows.map(toWaterLog);
}

export async function getWaterDailyTotals(
  userId: string,
  start: string,
  end: string,
): Promise<Array<{ date: string; amountMl: number }>> {
  const rows = await db
    .select({
      date: waterLogs.date,
      amountMl: sql<number>`sum(${waterLogs.amountMl})`,
    })
    .from(waterLogs)
    .where(
      and(
        eq(waterLogs.userId, userId),
        gte(waterLogs.date, start),
        lte(waterLogs.date, end),
      ),
    )
    .groupBy(waterLogs.date)
    .orderBy(asc(waterLogs.date));
  return rows.map((r) => ({ date: r.date, amountMl: r.amountMl ?? 0 }));
}

// ---------- Nutrition profile ----------

export async function getNutritionProfile(
  userId: string,
): Promise<NutritionProfile> {
  const rows = await db
    .select()
    .from(nutritionProfile)
    .where(eq(nutritionProfile.userId, userId))
    .limit(1);
  const r = rows[0];
  if (!r) {
    return {
      heightCm: null,
      age: null,
      sex: null,
      activityLevel: "moderate",
      goal: "maintain",
      rateKgPerWeek: null,
      targetWeightKg: null,
      targetDate: null,
      dailyKcalTarget: null,
      proteinTargetG: null,
      carbsTargetG: null,
      fatTargetG: null,
      waterTargetMl: 2500,
      mealCategories: DEFAULT_MEAL_CATEGORIES,
    };
  }
  return {
    heightCm: r.heightCm,
    age: r.age,
    sex: r.sex as NutritionProfile["sex"],
    activityLevel: r.activityLevel as NutritionProfile["activityLevel"],
    goal: r.goal as NutritionProfile["goal"],
    rateKgPerWeek: r.rateKgPerWeek,
    targetWeightKg: r.targetWeightKg,
    targetDate: r.targetDate,
    dailyKcalTarget: r.dailyKcalTarget,
    proteinTargetG: r.proteinTargetG,
    carbsTargetG: r.carbsTargetG,
    fatTargetG: r.fatTargetG,
    waterTargetMl: r.waterTargetMl,
    mealCategories: parseMealCategories(r.mealCategoriesJson),
  };
}

// ---------- Recipes ----------

export type Recipe = typeof foodRecipes.$inferSelect;
export type RecipeItem = typeof foodRecipeItems.$inferSelect;

export async function getRecipesForUser(userId: string): Promise<Recipe[]> {
  return db
    .select()
    .from(foodRecipes)
    .where(and(eq(foodRecipes.userId, userId), isNull(foodRecipes.archivedAt)))
    .orderBy(asc(foodRecipes.name));
}

export async function getRecipeItems(recipeId: string): Promise<RecipeItem[]> {
  return db
    .select()
    .from(foodRecipeItems)
    .where(eq(foodRecipeItems.recipeId, recipeId));
}
