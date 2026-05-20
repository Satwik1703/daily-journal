// Habit + goal seed for the Habit_Log app.
//
// Two modes:
//
//  - LOCAL (target=local): inserts 6 pomodoro categories + 9 habits +
//    14 yearly + 8*14 monthly + 14 weekly goals into a *fresh* local.db.
//    Errors on a non-empty DB.
//
//  - PROD (target=prod): destructive mirror of the above onto Turso. Wipes
//    the 5 goal/habit tables first (preserves journal entries + pomodoro
//    sessions). Renames any existing pomodoro_categories row "Creative" →
//    "Create" so the new Create-linked goals find their category, then
//    skips inserting categories (reuses prod's existing ids).
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

// ---------- Master ordered list of all 13 items ----------
// `kind`: "habit" (binary tick) | "pomo" (auto from pomodoro_sessions)
//        | "number" (manual delta logging).
// `position` follows user's chosen display order. Habits use the same global
// index for /habits sort order (gaps OK).
const ITEMS = [
  { position:  0, kind: "habit",  name: "Wake up at 8",     emoji: "☀️", color: "#0ea5e9", weekly: 3 },
  { position:  1, kind: "habit",  name: "Journal",          emoji: "✍️", color: "#10b981", weekly: 5 },
  { position:  2, kind: "habit",  name: "Gym",              emoji: "🏋️", color: "#10b981", weekly: 5 },
  { position:  3, kind: "habit",  name: "Pray",             emoji: "🙏", color: "#f59e0b", weekly: 3 },
  { position:  4, kind: "habit",  name: "Mantra",           emoji: "🕉️", color: "#a855f7", weekly: 5 },
  { position:  5, kind: "pomo",   name: "Work",             emoji: "💼", color: "#0ea5e9", categoryName: "Work",   metric: "sessions", weekly: 20 },
  { position:  6, kind: "habit",  name: "Meditate 5 min",   emoji: "🧘", color: "#a855f7", weekly: 3 },
  { position:  7, kind: "pomo",   name: "Study",            emoji: "📖", color: "#0ea5e9", categoryName: "Study",  metric: "sessions", weekly: 5 },
  { position:  8, kind: "number", name: "Walk (5k)",        emoji: "👟", color: "#84cc16", unit: "steps", weekly: 25000 },
  { position:  9, kind: "number", name: "Read (5 pages)",   emoji: "📚", color: "#ec4899", unit: "pages", weekly: 25 },
  { position: 10, kind: "habit",  name: "No junk",          emoji: "🥗", color: "#f43f5e", weekly: 5 },
  { position: 11, kind: "pomo",   name: "Create",           emoji: "🎨", color: "#f59e0b", categoryName: "Create", metric: "sessions", weekly: 2 },
  { position: 12, kind: "habit",  name: "Brush + Skincare", emoji: "🪥", color: "#0ea5e9", weekly: 5 },
  { position: 13, kind: "habit",  name: "Sleep before 12",  emoji: "😴", color: "#64748b", weekly: 3 },
];

// ---------- Pomodoro categories ----------
// Same as DEFAULT_CATEGORIES from src/lib/pomodoro-meta.ts, but "Creative"
// renamed to "Create" so the goal title and category name match.
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

let counts = { categories: 0, habits: 0, yearGoals: 0, monthGoals: 0, weekGoals: 0, deleted: 0 };

const categoryIdByName = new Map();

if (arg === "prod") {
  // ---------- 1a) Mirror mode: wipe + reuse categories ----------
  // Rename any pre-existing "Creative" category to "Create" so goal inserts
  // find a matching prod category id by name.
  const renamed = await client.execute({
    sql: `UPDATE pomodoro_categories SET name='Create' WHERE name='Creative'`,
  });
  if ((renamed.rowsAffected ?? 0) > 0) {
    console.log(`  renamed Creative -> Create (${renamed.rowsAffected} row)`);
  }

  // FK-safe order: goal_progress + goal_checklist cascade off goals; we
  // delete them first explicitly anyway. habit_logs FK off habits cascades
  // but we delete them up-front for clarity.
  const tablesToWipe = ["goal_progress", "goal_checklist", "goals", "habit_logs", "habits"];
  for (const t of tablesToWipe) {
    const r = await client.execute({ sql: `DELETE FROM ${t}` });
    counts.deleted += r.rowsAffected ?? 0;
    console.log(`  wiped ${t}: ${r.rowsAffected ?? 0} rows`);
  }

  // Build category map from existing prod categories — no new inserts.
  const cats = await client.execute(`SELECT id, name FROM pomodoro_categories`);
  for (const row of cats.rows) {
    categoryIdByName.set(row.name, row.id);
  }
  for (const required of ["Work", "Study", "Create"]) {
    if (!categoryIdByName.has(required)) {
      throw new Error(`Prod missing required category: ${required}`);
    }
  }
  console.log(`  reusing prod pomodoro_categories: ${categoryIdByName.size}`);
} else {
  // ---------- 1b) Local mode: insert categories fresh ----------
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

// ---------- 2) Per-item: create habit row (if needed) + year/month/week goals ----------
for (const item of ITEMS) {
  const yearTarget = item.weekly * 52;
  const pos = item.position;

  // Habit row (only for habit-linked items)
  let habitId = null;
  if (item.kind === "habit") {
    habitId = nanoid();
    await client.execute({
      sql: `INSERT INTO habits (id, name, emoji, color, cadence, position, created_at)
            VALUES (?, ?, ?, ?, 'daily', ?, ?)`,
      args: [habitId, item.name, item.emoji, item.color, pos, now],
    });
    counts.habits++;
  }

  let pomoCategoryId = null;
  if (item.kind === "pomo") {
    pomoCategoryId = categoryIdByName.get(item.categoryName);
    if (!pomoCategoryId) throw new Error(`Missing pomo category: ${item.categoryName}`);
  }

  const goalType = item.kind === "habit" ? "habit" : item.kind === "pomo" ? "pomodoro" : "number";
  const unit = item.kind === "number" ? item.unit
             : item.kind === "pomo" && item.metric === "minutes" ? "min"
             : null;

  // Year goal
  const yearGoalId = nanoid();
  await client.execute({
    sql: `INSERT INTO goals
          (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
          VALUES (?, 'year', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    args: [
      yearGoalId, YEAR, item.name, item.emoji, item.color, goalType,
      yearTarget, unit, habitId, pomoCategoryId, item.metric ?? null, pos, now,
    ],
  });
  counts.yearGoals++;

  // Monthly children (May-Dec only) via largest-remainder split.
  const monthSplits = autoSplit(yearTarget, 12);
  for (let m = CURRENT_MONTH_IDX; m < 12; m++) {
    const monthKey = `${YEAR}-${String(m + 1).padStart(2, "0")}`;
    await client.execute({
      sql: `INSERT INTO goals
            (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
            VALUES (?, 'month', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      args: [
        nanoid(), monthKey, yearGoalId, item.name, item.emoji, item.color, goalType,
        monthSplits[m], unit, habitId, pomoCategoryId, item.metric ?? null, pos, now,
      ],
    });
    counts.monthGoals++;
  }

  // Weekly goal for current W21
  await client.execute({
    sql: `INSERT INTO goals
          (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
          VALUES (?, 'week', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    args: [
      nanoid(), CURRENT_WEEK_KEY, item.name, item.emoji, item.color, goalType,
      item.weekly, unit, habitId, pomoCategoryId, item.metric ?? null, pos, now,
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
console.log(`  TOTAL INSERTED:            ${counts.categories + counts.habits + counts.yearGoals + counts.monthGoals + counts.weekGoals}`);
