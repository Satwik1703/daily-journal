// Extend weekly goal clones for habit-linked goals from the current ISO week
// through end of year. Idempotent — skips weeks where a clone already exists
// for the same (habitId, periodKey). Matches the reverse-cascade convention
// from seed-protein-handgrip.mjs.
//
// Usage:
//   node scripts/extend-weekly-goals.mjs            # local.db
//   node scripts/extend-weekly-goals.mjs prod       # Turso (load env first)

import { createClient } from "@libsql/client/node";
import { customAlphabet } from "nanoid";
import path from "node:path";

const id12 = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

const mode = process.argv[2] === "prod" ? "prod" : "local";
const client =
  mode === "prod"
    ? createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
    : createClient({ url: `file:${path.resolve("local.db")}` });

if (mode === "prod" && !process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL missing — load .env.production.local first.");
}

// --- date helpers (mirror src/lib/dates.ts) ---
function pad2(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function parseYMD(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function isoWeekKey(d) {
  const x = new Date(d);
  const isoDay = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() + 4 - isoDay);
  const isoYear = x.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Thu = new Date(isoYear, 0, 4 + (4 - jan4IsoDay));
  const weekNo = 1 + Math.round((x.getTime() - week1Thu.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${pad2(weekNo)}`;
}
function thursdayOfIsoWeekKey(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid week key: ${key}`);
  const isoYear = Number(m[1]);
  const weekNo = Number(m[2]);
  const jan4 = new Date(isoYear, 0, 4);
  const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const week1Thu = new Date(isoYear, 0, 4 + (4 - jan4IsoDay));
  const t = new Date(week1Thu);
  t.setDate(t.getDate() + (weekNo - 1) * 7);
  return t;
}
function monthOfThursday(key) {
  const t = thursdayOfIsoWeekKey(key);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}
function enumerateWeeksThrough(currentKey, endKey) {
  const out = [];
  let k = currentKey;
  const seen = new Set();
  while (true) {
    if (seen.has(k)) break;
    seen.add(k);
    out.push(k);
    if (k === endKey) break;
    if (out.length > 110) break; // safety
    const t = thursdayOfIsoWeekKey(k);
    const nextThu = addDays(t, 7);
    k = isoWeekKey(nextThu);
  }
  return out;
}

// --- step 1: pick the "source" weekly goals (current display week's clones). ---
const today = new Date();
const todaySun = addDays(today, -today.getDay()); // Sun of display week
const todayThu = addDays(todaySun, 4);
const startWeekKey = isoWeekKey(todayThu);          // e.g. 2026-W22
const yearStr = String(todayThu.getFullYear());
const endWeekKey = `${yearStr}-W53`; // safety; enumerator stops at real year-end

// Source week = the most recent weekly periodKey BEFORE startWeekKey that has
// any habit-linked weekly goals. Falls back to startWeekKey-1 when no clones
// exist for the current week (typical).
const sourceCandidate = isoWeekKey(addDays(thursdayOfIsoWeekKey(startWeekKey), -7));

const sourceWeekKey = sourceCandidate;
console.log(`Mode: ${mode}`);
console.log(`Source week: ${sourceWeekKey}`);
console.log(`Target: ${startWeekKey} → end of ${yearStr}`);

const sourceRows = await client.execute({
  sql: `SELECT id, title, emoji, color, type, target_value, unit, habit_id,
               pomo_category_id, pomo_metric, parent_id, pinned
        FROM goals
        WHERE period = 'week' AND period_key = ? AND archived_at IS NULL
          AND habit_id IS NOT NULL`,
  args: [sourceWeekKey],
});
console.log(`Source weekly goals: ${sourceRows.rows.length}`);
if (sourceRows.rows.length === 0) {
  console.log("Nothing to extend. Source week has no habit-linked weekly goals.");
  process.exit(0);
}

// Build map of (habitId → existing weekly periodKeys) to skip duplicates.
const existingRows = await client.execute({
  sql: `SELECT habit_id, period_key FROM goals
        WHERE period = 'week' AND archived_at IS NULL AND habit_id IS NOT NULL`,
});
const existing = new Map();
for (const r of existingRows.rows) {
  let s = existing.get(r.habit_id);
  if (!s) { s = new Set(); existing.set(r.habit_id, s); }
  s.add(r.period_key);
}

// Monthly-parent lookup: (habitId, periodKey=YYYY-MM) → monthly goal id
const monthlyRows = await client.execute({
  sql: `SELECT id, habit_id, period_key FROM goals
        WHERE period = 'month' AND archived_at IS NULL AND habit_id IS NOT NULL`,
});
const monthlyParent = new Map();
for (const r of monthlyRows.rows) {
  monthlyParent.set(`${r.habit_id}|${r.period_key}`, r.id);
}

const weeks = enumerateWeeksThrough(startWeekKey, endWeekKey).filter((w) => {
  // Stop when isoYear of the week's Thursday rolls past yearStr.
  return String(thursdayOfIsoWeekKey(w).getFullYear()) === yearStr;
});
console.log(`Weeks to consider: ${weeks.length} (${weeks[0]} → ${weeks[weeks.length - 1]})`);

let inserted = 0;
let skipped = 0;
for (const weekKey of weeks) {
  const monthKey = monthOfThursday(weekKey);
  for (const src of sourceRows.rows) {
    const hid = src.habit_id;
    const seen = existing.get(hid);
    if (seen && seen.has(weekKey)) { skipped++; continue; }
    const parentId = monthlyParent.get(`${hid}|${monthKey}`) ?? null;
    const newId = id12();
    await client.execute({
      sql: `INSERT INTO goals
            (id, period, period_key, parent_id, title, emoji, color, type,
             target_value, unit, habit_id, pomo_category_id, pomo_metric,
             status, finalized_at, reflection_note, reflection_rating,
             reflection_linked_date, reflection_saved_at, position,
             archived_at, created_at, pinned)
            VALUES (?, 'week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    'active', NULL, NULL, NULL, NULL, NULL,
                    0, NULL, unixepoch() * 1000, 0)`,
      args: [
        newId,
        weekKey,
        parentId,
        src.title,
        src.emoji ?? null,
        src.color,
        src.type,
        src.target_value,
        src.unit ?? null,
        hid,
        src.pomo_category_id ?? null,
        src.pomo_metric ?? null,
      ],
    });
    inserted++;
    if (!seen) existing.set(hid, new Set([weekKey])); else seen.add(weekKey);
  }
}
console.log(`\nInserted ${inserted} weekly clones, skipped ${skipped} existing.`);
