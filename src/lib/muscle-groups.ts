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
