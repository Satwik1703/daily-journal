import { createClient } from "@libsql/client";

const c = createClient({ url: "file:./local.db" });

const tables = await c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'pomo%' ORDER BY name",
);
console.log("Pomodoro tables:");
for (const r of tables.rows) console.log("  -", r.name);

const cats = await c.execute(
  "SELECT name, color, emoji, position FROM pomodoro_categories ORDER BY position",
);
console.log(`\npomodoro_categories rows: ${cats.rows.length}`);
for (const r of cats.rows) console.log("  -", r.name, r.color, r.emoji, "pos:", r.position);

const sessions = await c.execute(
  "SELECT date, duration_min, planned_min, source FROM pomodoro_sessions ORDER BY date",
);
console.log(`\npomodoro_sessions rows: ${sessions.rows.length}`);
for (const r of sessions.rows) console.log("  -", JSON.stringify(r));
