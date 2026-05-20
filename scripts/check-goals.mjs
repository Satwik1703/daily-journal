import { createClient } from "@libsql/client";

const c = createClient({ url: "file:./local.db" });

const tables = await c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'goal%' ORDER BY name",
);
console.log("Goal tables:");
for (const r of tables.rows) console.log("  -", r.name);

const goals = await c.execute(
  "SELECT id, period, period_key, title, type, target_value, unit, status FROM goals ORDER BY period, period_key, position",
);
console.log(`\ngoals rows: ${goals.rows.length}`);
for (const r of goals.rows) console.log("  -", JSON.stringify(r));

const progress = await c.execute(
  "SELECT goal_id, date, delta, note FROM goal_progress ORDER BY date DESC LIMIT 20",
);
console.log(`\ngoal_progress rows (last 20): ${progress.rows.length}`);
for (const r of progress.rows) console.log("  -", JSON.stringify(r));

const checklist = await c.execute(
  "SELECT goal_id, text, done, position FROM goal_checklist ORDER BY goal_id, position",
);
console.log(`\ngoal_checklist rows: ${checklist.rows.length}`);
for (const r of checklist.rows) console.log("  -", JSON.stringify(r));
