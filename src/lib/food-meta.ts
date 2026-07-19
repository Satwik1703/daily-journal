// Client-safe constants and pure helpers for the Calorie Tracker tab.
// No DB imports — client components can import from here freely (rule #7).

export type FoodSource = "seed" | "custom" | "off";
export type ServingUnit = "g" | "ml" | "serving" | "piece" | "cup";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type Sex = "male" | "female" | "other";

export const SERVING_UNITS: ServingUnit[] = ["g", "ml", "serving", "piece", "cup"];

export const DEFAULT_MEAL_CATEGORIES = ["Breakfast", "Lunch", "Snacks", "Dinner"];

export function parseMealCategories(json: string | null | undefined): string[] {
  if (!json) return DEFAULT_MEAL_CATEGORIES;
  try {
    const parsed = JSON.parse(json);
    if (
      Array.isArray(parsed) &&
      parsed.every((s) => typeof s === "string") &&
      parsed.length > 0 &&
      parsed.length <= 8
    ) {
      return parsed as string[];
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_MEAL_CATEGORIES;
}

// ---------- BMR / TDEE / target ----------

// Mifflin-St Jeor (kcal/day). Assumes weight kg + height cm + age years.
export function bmrMifflin(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  // "other" — use the average.
  return base - 78;
}

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary — desk, minimal exercise",
  light: "Light — 1-3 sessions / week",
  moderate: "Moderate — 3-5 sessions / week",
  active: "Active — 6-7 sessions / week",
  very_active: "Very active — twice-a-day or physical job",
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

// 7700 kcal ≈ 1 kg body fat. Deficit/surplus per day for a given weekly rate.
const KCAL_PER_KG = 7700;

export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return bmrValue * ACTIVITY_MULTIPLIER[activity];
}

export function dailyKcalTargetFor(
  tdeeValue: number,
  goal: Goal,
  rateKgPerWeek: number | null,
): number {
  if (goal === "maintain") return Math.round(tdeeValue);
  const rate = rateKgPerWeek == null || rateKgPerWeek <= 0 ? 0.5 : rateKgPerWeek;
  const delta = (rate * KCAL_PER_KG) / 7;
  const raw = goal === "lose" ? tdeeValue - delta : tdeeValue + delta;
  // Safety floor / ceiling — the profile-form UI should also enforce these.
  return Math.round(Math.max(1200, Math.min(5000, raw)));
}

// Default macro split: 30 P / 40 C / 30 F by kcal.
// Protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g.
export function defaultMacroSplit(kcal: number): {
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  return {
    proteinG: Math.round((kcal * 0.3) / 4),
    carbsG: Math.round((kcal * 0.4) / 4),
    fatG: Math.round((kcal * 0.3) / 9),
  };
}

// ---------- Serving-based nutrition scaling ----------

/**
 * Scale a food's per-serving nutrition by a quantity multiplier.
 * `foods` rows are stored per-serving (whatever `serving_size` + `serving_unit`
 * mean for that food) — the quantity a user logs is a multiplier of that.
 */
export function scaleNutrition(
  food: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  },
  quantity: number,
): {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  const q = quantity <= 0 ? 1 : quantity;
  return {
    kcal: Math.round(food.kcal * q),
    proteinG: Math.round(food.proteinG * q * 10) / 10,
    carbsG: Math.round(food.carbsG * q * 10) / 10,
    fatG: Math.round(food.fatG * q * 10) / 10,
  };
}

// ---------- Formatting ----------

export function formatKcal(n: number): string {
  return `${Math.round(n)} kcal`;
}

export function formatGrams(n: number): string {
  return `${Math.round(n * 10) / 10} g`;
}

// ---------- Types for API payload ----------

export type Food = {
  id: string;
  userId: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  servingUnit: ServingUnit;
  servingSize: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  source: FoodSource;
  offBarcode: string | null;
  isFavorite: boolean;
};

export type FoodLog = {
  id: string;
  date: string;
  mealType: string;
  foodId: string | null;
  foodName: string;
  quantity: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string | null;
  loggedAt: number;
};

export type WaterLog = {
  id: string;
  date: string;
  amountMl: number;
  loggedAt: number;
};

export type NutritionProfile = {
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  rateKgPerWeek: number | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyKcalTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  waterTargetMl: number;
  mealCategories: string[];
};
