// Phase 9 gym rewamp seed: 5 splits + 27 exercises + split_exercises joins.
// Idempotent: skips entirely if any splits OR exercises already exist.
//
// Usage:
//   node scripts/seed-gym.mjs           # local.db
//   node scripts/seed-gym.mjs prod      # prod Turso

import { createClient } from "@libsql/client";
import { customAlphabet } from "nanoid";

const arg = process.argv[2] ?? "local";
let client;
if (arg === "prod") {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("ERROR: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN required");
    process.exit(1);
  }
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log("Target: PROD Turso");
} else {
  client = createClient({ url: "file:./local.db" });
  console.log("Target: local local.db");
}

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",
  12,
);
const now = Math.floor(Date.now() / 1000);

// ---------- Splits ----------
const SPLITS = [
  { name: "Push", emoji: "🔥", color: "#f43f5e" },
  { name: "Pull", emoji: "💪", color: "#0ea5e9" },
  { name: "Legs", emoji: "🦵", color: "#84cc16" },
  { name: "Arms", emoji: "🦾", color: "#a855f7" },
  { name: "Upper", emoji: "⚡", color: "#f59e0b" },
];

// ---------- Exercises (with muscle group tags) ----------
// Tags drive the 3D heatmap. Use MUSCLE_GROUPS from src/lib/muscle-groups.ts.
const EXERCISES = [
  // Push
  { name: "Incline Dumbbell Press", emoji: "🏋️", muscles: ["chest", "front_delts", "triceps"], splits: ["Push"] },
  { name: "Dumbbell Shoulder Press", emoji: "🏋️", muscles: ["front_delts", "side_delts", "triceps"], splits: ["Push"] },
  { name: "Shoulder Press", emoji: "🏋️", muscles: ["front_delts", "side_delts", "triceps"], splits: ["Push"] },
  { name: "Lateral Raises", emoji: "🪽", muscles: ["side_delts"], splits: ["Push"] },
  { name: "Cable Chest Fly (LTH)", emoji: "🎯", muscles: ["chest"], splits: ["Push"] },
  { name: "Tricep Pushdown", emoji: "🔽", muscles: ["triceps"], splits: ["Push"] },

  // Pull
  { name: "Barbell Shrugs", emoji: "⬆️", muscles: ["traps"], splits: ["Pull"] },
  { name: "Lat Pulldown", emoji: "🪂", muscles: ["lats", "biceps"], splits: ["Pull"] },
  { name: "Chest supported Rows", emoji: "🚣", muscles: ["upper_back", "lats", "rear_delts", "biceps"], splits: ["Pull"] },
  { name: "Face Pulls", emoji: "😤", muscles: ["rear_delts", "upper_back"], splits: ["Pull", "Upper"] },
  { name: "Incline Dumbbell Curls", emoji: "💪", muscles: ["biceps"], splits: ["Pull"] },

  // Legs
  { name: "Barbell Squats", emoji: "🏋️", muscles: ["quads", "glutes", "hamstrings", "lower_back"], splits: ["Legs"] },
  { name: "Leg Press", emoji: "🦵", muscles: ["quads", "glutes", "hamstrings"], splits: ["Legs"] },
  { name: "Romanian Deadlift", emoji: "🪢", muscles: ["hamstrings", "glutes", "lower_back"], splits: ["Legs"] },
  { name: "Walking Lunges", emoji: "🚶", muscles: ["quads", "glutes", "hamstrings"], splits: ["Legs"] },
  { name: "Calf Raises", emoji: "🦶", muscles: ["calves"], splits: ["Legs"] },
  { name: "Cable Crunch", emoji: "🧘", muscles: ["abs"], splits: ["Legs"] },

  // Arms
  { name: "Tricep Kickback", emoji: "🦵", muscles: ["triceps"], splits: ["Arms"] },
  { name: "Hammer Curls", emoji: "🔨", muscles: ["biceps", "forearms"], splits: ["Arms"] },
  { name: "Overhead Tricep Extensions", emoji: "🔺", muscles: ["triceps"], splits: ["Arms"] },
  { name: "Reverse Curls", emoji: "🔄", muscles: ["forearms", "biceps"], splits: ["Arms"] },
  { name: "Wrist Curls", emoji: "✋", muscles: ["forearms"], splits: ["Arms"] },

  // Upper
  { name: "Incline Barbell Press", emoji: "🏋️", muscles: ["chest", "front_delts", "triceps"], splits: ["Upper"] },
  { name: "Cable Lateral Raises", emoji: "🪽", muscles: ["side_delts"], splits: ["Upper"] },
  { name: "Dumbbell Shrugs", emoji: "⬆️", muscles: ["traps"], splits: ["Upper"] },
  { name: "Upright Rows", emoji: "⬆️", muscles: ["side_delts", "traps"], splits: ["Upper"] },
];

// Quick idempotency check
const splitsExisting = await client.execute(`SELECT COUNT(*) AS n FROM splits`);
const exercisesExisting = await client.execute(`SELECT COUNT(*) AS n FROM exercises`);
if (Number(splitsExisting.rows[0].n) > 0 || Number(exercisesExisting.rows[0].n) > 0) {
  console.log(
    `Already seeded: ${splitsExisting.rows[0].n} splits + ${exercisesExisting.rows[0].n} exercises. Skipping.`,
  );
  process.exit(0);
}

const PRESET_COLORS = [
  "#10b981", "#0ea5e9", "#a855f7", "#f43f5e",
  "#f59e0b", "#84cc16", "#ec4899", "#64748b",
];

const splitIdByName = new Map();
for (let i = 0; i < SPLITS.length; i++) {
  const s = SPLITS[i];
  const id = nanoid();
  splitIdByName.set(s.name, id);
  await client.execute({
    sql: `INSERT INTO splits (id, name, emoji, color, position, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, s.name, s.emoji, s.color, i, now],
  });
}
console.log(`+ ${SPLITS.length} splits`);

const exerciseIdByName = new Map();
for (let i = 0; i < EXERCISES.length; i++) {
  const e = EXERCISES[i];
  const id = nanoid();
  exerciseIdByName.set(e.name, id);
  await client.execute({
    sql: `INSERT INTO exercises (id, name, emoji, color, muscle_groups, position, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      e.name,
      e.emoji,
      PRESET_COLORS[i % PRESET_COLORS.length],
      JSON.stringify(e.muscles),
      i,
      now,
    ],
  });
}
console.log(`+ ${EXERCISES.length} exercises`);

// Join rows: per-split position is the order the user listed them.
const positionInSplit = new Map(); // splitName -> running counter
let joins = 0;
for (const e of EXERCISES) {
  for (const splitName of e.splits) {
    const splitId = splitIdByName.get(splitName);
    const exerciseId = exerciseIdByName.get(e.name);
    const pos = positionInSplit.get(splitName) ?? 0;
    positionInSplit.set(splitName, pos + 1);
    await client.execute({
      sql: `INSERT INTO split_exercises (split_id, exercise_id, position)
            VALUES (?, ?, ?)`,
      args: [splitId, exerciseId, pos],
    });
    joins++;
  }
}
console.log(`+ ${joins} split_exercises joins`);

console.log(`\nDone. Splits + exercises ready.`);
