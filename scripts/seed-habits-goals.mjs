// Habit + goal seed for the Habit_Log app.
//
// Phase 6: every tracked thing is a habit (binary | number | pomodoro kind).
// All goals are habit-linked; their target is "days in period that hit the
// daily target". Same math for every kind. No more number/pomodoro goal
// types in the seeded stack.
//
// Two modes:
//
//  - LOCAL (target=local): inserts 6 pomodoro categories + 14 habits +
//    14 yearly + 8*14 monthly + 14 weekly goals into a *fresh* local.db.
//
//  - PROD (target=prod): destructive mirror. Wipes goal_progress,
//    goal_checklist, goals, habit_value_logs, habit_logs, habits.
//    Renames any existing "Creative" → "Create" in pomodoro_categories,
//    reuses prod's existing category ids. Preserves journal entries +
//    pomodoro sessions.
//
// Usage:
//   node scripts/seed-habits-goals.mjs            # local.db
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/seed-habits-goals.mjs prod

import { createClient } from "@libsql/client";
import { customAlphabet } from "nanoid";

const arg = process.argv[2] ?? "local";
let client;
if (arg === "prod") {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("ERROR: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN required for prod target");
    process.exit(1);
  }
  client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log("Target: PROD Turso");
} else if (arg === "local") {
  client = createClient({ url: "file:./local.db" });
  console.log("Target: local local.db");
} else {
  console.error(`Unknown target '${arg}'. Use 'local' or 'prod'.`);
  process.exit(1);
}

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",
  12,
);

// Largest-remainder integer split (same algorithm as src/lib/goal-meta.ts).
function autoSplit(total, slices) {
  const base = Math.floor(total / slices);
  const extra = Math.round(total - base * slices);
  return Array.from({ length: slices }, (_, i) => base + (i < extra ? 1 : 0));
}

// ---------- Master ordered list of all 14 items ----------
// All entries become habits. `trackingKind` decides what the /habits row
// looks like and how the linked goal counts qualifying days.
// `weeklyDays` is the number of days/week target → drives yearly = ×52,
// monthly cascade split, and weekly = the value itself.
const ITEMS = [
  { position:  0, name: "Wake up at 8",     emoji: "☀️", color: "#0ea5e9",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 3 },
  { position:  1, name: "Journal",          emoji: "✍️", color: "#10b981",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 5 },
  { position:  2, name: "Gym",              emoji: "🏋️", color: "#10b981",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 5 },
  { position:  3, name: "Pray",             emoji: "🙏", color: "#f59e0b",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 3 },
  { position:  4, name: "Mantra",           emoji: "🕉️", color: "#a855f7",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 5 },
  { position:  5, name: "Work",             emoji: "💼", color: "#0ea5e9",
    trackingKind: "pomodoro", dailyTarget: 4, unit: null, categoryName: "Work", weeklyDays: 5 },
  { position:  6, name: "Meditate 5 min",   emoji: "🧘", color: "#a855f7",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 3 },
  { position:  7, name: "Study",            emoji: "📖", color: "#0ea5e9",
    trackingKind: "pomodoro", dailyTarget: 1, unit: null, categoryName: "Study", weeklyDays: 5 },
  { position:  8, name: "Walk (5k)",        emoji: "👟", color: "#84cc16",
    trackingKind: "number", dailyTarget: 5000, unit: "steps", categoryName: null, weeklyDays: 5 },
  { position:  9, name: "Read (5 pages)",   emoji: "📚", color: "#ec4899",
    trackingKind: "number", dailyTarget: 5, unit: "pages", categoryName: null, weeklyDays: 5 },
  { position: 10, name: "No junk",          emoji: "🥗", color: "#f43f5e",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 5 },
  { position: 11, name: "Create",           emoji: "🎨", color: "#f59e0b",
    trackingKind: "pomodoro", dailyTarget: 1, unit: null, categoryName: "Create", weeklyDays: 2 },
  { position: 12, name: "Brush + Skincare", emoji: "🪥", color: "#0ea5e9",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 5 },
  { position: 13, name: "Sleep before 12",  emoji: "😴", color: "#64748b",
    trackingKind: "binary", dailyTarget: null, unit: null, categoryName: null, weeklyDays: 3 },
];

// ---------- Pomodoro categories ----------
// Matches DEFAULT_CATEGORIES from src/lib/pomodoro-meta.ts (Create not Creative).
const POMO_CATEGORIES = [
  { name: "Work",     emoji: "💼", color: "#0ea5e9" },
  { name: "Study",    emoji: "📚", color: "#a855f7" },
  { name: "Read",     emoji: "📖", color: "#10b981" },
  { name: "Exercise", emoji: "🏃", color: "#f43f5e" },
  { name: "Create",   emoji: "🎨", color: "#f59e0b" },
  { name: "Other",    emoji: "✨", color: "#64748b" },
];

const YEAR = "2026";
const CURRENT_MONTH_IDX = 4; // May (0-indexed)
const CURRENT_WEEK_KEY = "2026-W21";
const now = Math.floor(Date.now() / 1000);

const counts = { categories: 0, habits: 0, yearGoals: 0, monthGoals: 0, weekGoals: 0, deleted: 0 };
const categoryIdByName = new Map();

if (arg === "prod") {
  const renamed = await client.execute({
    sql: `UPDATE pomodoro_categories SET name='Create' WHERE name='Creative'`,
  });
  if ((renamed.rowsAffected ?? 0) > 0) {
    console.log(`  renamed Creative -> Create (${renamed.rowsAffected} row)`);
  }

  // FK-safe order. habit_value_logs cascades off habits but wipe explicitly.
  const tablesToWipe = [
    "goal_progress",
    "goal_checklist",
    "goals",
    "habit_value_logs",
    "habit_logs",
    "habits",
  ];
  for (const t of tablesToWipe) {
    const r = await client.execute({ sql: `DELETE FROM ${t}` });
    counts.deleted += r.rowsAffected ?? 0;
    console.log(`  wiped ${t}: ${r.rowsAffected ?? 0} rows`);
  }

  const cats = await client.execute(`SELECT id, name FROM pomodoro_categories`);
  for (const row of cats.rows) categoryIdByName.set(row.name, row.id);
  for (const required of ["Work", "Study", "Create"]) {
    if (!categoryIdByName.has(required)) {
      throw new Error(`Prod missing required category: ${required}`);
    }
  }
  console.log(`  reusing prod pomodoro_categories: ${categoryIdByName.size}`);
} else {
  for (let i = 0; i < POMO_CATEGORIES.length; i++) {
    const c = POMO_CATEGORIES[i];
    const id = nanoid();
    await client.execute({
      sql: `INSERT INTO pomodoro_categories (id, name, emoji, color, position, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, c.name, c.emoji, c.color, i, now],
    });
    categoryIdByName.set(c.name, id);
    counts.categories++;
  }
}

// ---------- Per-item: insert habit + yearly + monthly + weekly goal ----------
for (const item of ITEMS) {
  const habitId = nanoid();
  let pomoCategoryId = null;
  if (item.trackingKind === "pomodoro") {
    pomoCategoryId = categoryIdByName.get(item.categoryName);
    if (!pomoCategoryId) throw new Error(`Missing pomo category: ${item.categoryName}`);
  }

  // Habit row — every item, regardless of tracking kind.
  await client.execute({
    sql: `INSERT INTO habits
          (id, name, emoji, color, cadence, tracking_kind, daily_target, unit, pomo_category_id, position, created_at)
          VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?)`,
    args: [
      habitId,
      item.name,
      item.emoji,
      item.color,
      item.trackingKind,
      item.dailyTarget,
      item.unit,
      pomoCategoryId,
      item.position,
      now,
    ],
  });
  counts.habits++;

  // All goals are habit-linked. Target = days in period that hit dailyTarget.
  // yearly = weeklyDays * 52; monthly = autoSplit(yearly, 12); weekly = weeklyDays.
  const yearTarget = item.weeklyDays * 52;
  const monthSplits = autoSplit(yearTarget, 12);

  const yearGoalId = nanoid();
  await client.execute({
    sql: `INSERT INTO goals
          (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
          VALUES (?, 'year', ?, NULL, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
    args: [yearGoalId, YEAR, item.name, item.emoji, item.color, yearTarget, habitId, item.position, now],
  });
  counts.yearGoals++;

  for (let m = CURRENT_MONTH_IDX; m < 12; m++) {
    const monthKey = `${YEAR}-${String(m + 1).padStart(2, "0")}`;
    await client.execute({
      sql: `INSERT INTO goals
            (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
            VALUES (?, 'month', ?, ?, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
      args: [
        nanoid(), monthKey, yearGoalId, item.name, item.emoji, item.color,
        monthSplits[m], habitId, item.position, now,
      ],
    });
    counts.monthGoals++;
  }

  await client.execute({
    sql: `INSERT INTO goals
          (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
          VALUES (?, 'week', ?, NULL, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
    args: [
      nanoid(), CURRENT_WEEK_KEY, item.name, item.emoji, item.color,
      item.weeklyDays, habitId, item.position, now,
    ],
  });
  counts.weekGoals++;
}

console.log(`\nSeeded:`);
if (arg === "prod") {
  console.log(`  rows deleted (pre-mirror): ${counts.deleted}`);
  console.log(`  pomodoro categories:       (reused existing prod ids)`);
} else {
  console.log(`  pomodoro categories:       ${counts.categories}`);
}
console.log(`  habits:                    ${counts.habits}`);
console.log(`  yearly goals:              ${counts.yearGoals}`);
console.log(`  monthly goals:             ${counts.monthGoals}  (May-Dec for each)`);
console.log(`  weekly goals:              ${counts.weekGoals}  (W21 only)`);
console.log(
  `  TOTAL INSERTED:            ${counts.categories + counts.habits + counts.yearGoals + counts.monthGoals + counts.weekGoals}`,
);
