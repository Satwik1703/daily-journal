export const MUSCLE_GROUPS = [
  "chest",
  "upper_back",
  "lats",
  "traps",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  upper_back: "Upper back",
  lats: "Lats",
  traps: "Traps",
  front_delts: "Front delts",
  side_delts: "Side delts",
  rear_delts: "Rear delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

export const MUSCLES_FRONT: ReadonlyArray<MuscleGroup> = [
  "chest", "front_delts", "side_delts", "biceps", "forearms", "abs", "obliques", "quads", "calves",
];
export const MUSCLES_BACK: ReadonlyArray<MuscleGroup> = [
  "traps", "upper_back", "rear_delts", "lats", "triceps", "lower_back", "glutes", "hamstrings", "calves",
];

export type Intensity = "light" | "medium" | "heavy";

export const INTENSITY_WEIGHT: Record<Intensity, number> = {
  light: 1,
  medium: 2,
  heavy: 3.5,
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

/** Cumulative intensity at which the muscle is fully red. */
export const SATURATION_BY_RANGE: Record<"week" | "month", number> = {
  week: 12,
  month: 36,
};

const UNTRAINED = { r: 245, g: 230, b: 224 };
const TRAINED = { r: 200, g: 48, b: 42 };

export function intensityToColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));
  const r = Math.round(UNTRAINED.r + (TRAINED.r - UNTRAINED.r) * t);
  const g = Math.round(UNTRAINED.g + (TRAINED.g - UNTRAINED.g) * t);
  const b = Math.round(UNTRAINED.b + (TRAINED.b - UNTRAINED.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export const PICKER_COLOR_BY_INTENSITY: Record<Intensity, string> = {
  light: "#fbcfc7",
  medium: "#e87a72",
  heavy: "#c8302a",
};
