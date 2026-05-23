// Additive seed for Phase 7C: adds two new number-tracking habits
// (Protein and Hand grip) + their habit-linked goals (year + monthly + weekly
// cascade) covering the rest of 2026 starting from the current ISO week.
//
// Idempotent by habit name — skips if either habit already exists. Safe to
// re-run on local or prod.
//
// Usage:
//   node scripts/seed-protein-handgrip.mjs           # local.db
//   node scripts/seed-protein-handgrip.mjs prod      # prod Turso

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

// ---------- Date helpers (mirror src/lib/dates.ts conventions) ----------
function ymd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysUTC(d, n) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}
// ISO 8601 week key: YYYY-Www. Week containing Thursday is the canonical
// year for that week.
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to Thursday in current week
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
// Monday of the ISO week for a key like "2026-W21".
function weekStartMonday(weekKey) {
  const [yStr, wStr] = weekKey.split("-W");
  const year = Number(yStr);
  const week = Number(wStr);
  // Jan 4 is always in W01.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const week1Monday = addDaysUTC(jan4, -jan4Dow);
  return addDaysUTC(week1Monday, (week - 1) * 7);
}
function thursdayOfWeek(weekKey) {
  return addDaysUTC(weekStartMonday(weekKey), 3);
}
function nextWeekKey(weekKey) {
  const next = addDaysUTC(thursdayOfWeek(weekKey), 7);
  return isoWeekKey(next);
}
function enumerateWeeksThroughYear(currentKey, year) {
  const out = [currentKey];
  let k = currentKey;
  for (let i = 0; i < 60; i++) {
    const next = nextWeekKey(k);
    const thu = thursdayOfWeek(next);
    if (thu.getUTCFullYear() > year) break;
    out.push(next);
    k = next;
  }
  return out;
}
function monthKeyOfThursday(weekKey) {
  const thu = thursdayOfWeek(weekKey);
  return `${thu.getUTCFullYear()}-${String(thu.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------- Config ----------
// "Tomorrow" anchor. The ISO week containing it is the starting week.
const TODAY = new Date();
const TOMORROW = addDaysUTC(new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate())), 1);
const START_WEEK = isoWeekKey(TOMORROW);
const YEAR = TOMORROW.getUTCFullYear();
const now = Math.floor(Date.now() / 1000);

const ITEMS = [
  {
    name: "Protein",
    emoji: "🥩",
    color: "#dc2626",
    trackingKind: "number",
    dailyTarget: 90,
    unit: "grams",
    weeklyDays: 5,
  },
  {
    name: "Hand grip",
    emoji: "✊",
    color: "#7c3aed",
    trackingKind: "number",
    dailyTarget: 100,
    unit: "reps",
    weeklyDays: 5,
  },
];

const weekKeys = enumerateWeeksThroughYear(START_WEEK, YEAR);
console.log(`Start week: ${START_WEEK} (tomorrow = ${ymd(TOMORROW)})`);
console.log(`Year: ${YEAR}`);
console.log(`Weeks covered: ${weekKeys.length} (${weekKeys[0]} → ${weekKeys[weekKeys.length - 1]})`);

// Group weeks by their Thursday's month — matches the app's cascade convention.
const monthToWeeks = new Map();
for (const wk of weekKeys) {
  const mk = monthKeyOfThursday(wk);
  if (!monthToWeeks.has(mk)) monthToWeeks.set(mk, []);
  monthToWeeks.get(mk).push(wk);
}
console.log(`Months touched: ${monthToWeeks.size}`);

// Find max position currently in habits table → append after existing.
const maxPosRes = await client.execute(`SELECT COALESCE(MAX(position), -1) AS p FROM habits`);
let nextPosition = Number(maxPosRes.rows[0].p ?? -1) + 1;

const counts = { habits: 0, yearGoals: 0, monthGoals: 0, weekGoals: 0, skipped: 0 };

for (const item of ITEMS) {
  // Skip if habit with same name already present.
  const existing = await client.execute({
    sql: `SELECT id FROM habits WHERE name = ? LIMIT 1`,
    args: [item.name],
  });
  if (existing.rows.length > 0) {
    console.log(`  '${item.name}' already exists → skipping (id=${existing.rows[0].id})`);
    counts.skipped++;
    continue;
  }

  const habitId = nanoid();
  await client.execute({
    sql: `INSERT INTO habits
          (id, name, emoji, color, cadence, tracking_kind, daily_target, unit, pomo_category_id, position, created_at)
          VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, NULL, ?, ?)`,
    args: [
      habitId,
      item.name,
      item.emoji,
      item.color,
      item.trackingKind,
      item.dailyTarget,
      item.unit,
      nextPosition,
      now,
    ],
  });
  counts.habits++;
  console.log(`  + habit '${item.name}' (id=${habitId}, position=${nextPosition})`);
  nextPosition++;

  // Goals: habit-linked. Target = "days in period meeting dailyTarget".
  const yearTarget = item.weeklyDays * weekKeys.length;
  const yearGoalId = nanoid();
  await client.execute({
    sql: `INSERT INTO goals
          (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
          VALUES (?, 'year', ?, NULL, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
    args: [
      yearGoalId,
      String(YEAR),
      item.name,
      item.emoji,
      item.color,
      yearTarget,
      habitId,
      counts.habits,
      now,
    ],
  });
  counts.yearGoals++;

  // Monthly parents — target = weeklyDays * weeks_in_month (Thursday-rule).
  const monthIdByKey = new Map();
  for (const [monthKey, wks] of monthToWeeks) {
    const monthGoalId = nanoid();
    await client.execute({
      sql: `INSERT INTO goals
            (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
            VALUES (?, 'month', ?, ?, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
      args: [
        monthGoalId,
        monthKey,
        yearGoalId,
        item.name,
        item.emoji,
        item.color,
        item.weeklyDays * wks.length,
        habitId,
        counts.habits,
        now,
      ],
    });
    monthIdByKey.set(monthKey, monthGoalId);
    counts.monthGoals++;
  }

  // Weekly clones — target = weeklyDays.
  for (const wk of weekKeys) {
    const monthKey = monthKeyOfThursday(wk);
    const parentId = monthIdByKey.get(monthKey);
    await client.execute({
      sql: `INSERT INTO goals
            (id, period, period_key, parent_id, title, emoji, color, type, target_value, unit, habit_id, pomo_category_id, pomo_metric, status, position, created_at)
            VALUES (?, 'week', ?, ?, ?, ?, ?, 'habit', ?, NULL, ?, NULL, NULL, 'active', ?, ?)`,
      args: [
        nanoid(),
        wk,
        parentId,
        item.name,
        item.emoji,
        item.color,
        item.weeklyDays,
        habitId,
        counts.habits,
        now,
      ],
    });
    counts.weekGoals++;
  }
}

console.log(`\nSeeded:`);
console.log(`  habits:          ${counts.habits}`);
console.log(`  yearly goals:    ${counts.yearGoals}`);
console.log(`  monthly goals:   ${counts.monthGoals}`);
console.log(`  weekly goals:    ${counts.weekGoals}`);
console.log(`  habits skipped:  ${counts.skipped}`);
console.log(`  TOTAL INSERTED:  ${counts.habits + counts.yearGoals + counts.monthGoals + counts.weekGoals}`);
