// Quick read-back of seeded data.
import { createClient } from "@libsql/client";
const c = createClient({ url: "file:./local.db" });

const habits = await c.execute("SELECT name, emoji, color, position FROM habits ORDER BY position");
console.log(`habits (${habits.rows.length}):`);
for (const r of habits.rows) console.log("  " + String(r.position).padStart(2) + ". " + r.emoji + " " + r.name);

const cats = await c.execute("SELECT name, emoji, color, position FROM pomodoro_categories ORDER BY position");
console.log(`\npomodoro_categories (${cats.rows.length}):`);
for (const r of cats.rows) console.log("  " + r.emoji + " " + r.name);

const week = await c.execute(
  "SELECT title, emoji, type, target_value, unit, pomo_metric, position FROM goals WHERE period='week' AND period_key='2026-W21' ORDER BY position"
);
console.log(`\nweek W21 (${week.rows.length}):`);
for (const r of week.rows) {
  const unit = r.unit ? " " + r.unit : "";
  const metric = r.pomo_metric ? " (" + r.pomo_metric + ")" : "";
  console.log("  " + String(r.position).padStart(2) + ". " + r.emoji + " " + r.title + " [" + r.type + "] target=" + r.target_value + unit + metric);
}

const may = await c.execute(
  "SELECT title, target_value, unit, position FROM goals WHERE period='month' AND period_key='2026-05' ORDER BY position"
);
console.log(`\nmonth 2026-05 (${may.rows.length}):`);
for (const r of may.rows) {
  console.log("  " + String(r.position).padStart(2) + ". " + r.title + " target=" + r.target_value + (r.unit ? " " + r.unit : ""));
}

const year = await c.execute(
  "SELECT title, target_value, unit, position FROM goals WHERE period='year' AND period_key='2026' ORDER BY position"
);
console.log(`\nyear 2026 (${year.rows.length}):`);
for (const r of year.rows) {
  console.log("  " + String(r.position).padStart(2) + ". " + r.title + " target=" + r.target_value + (r.unit ? " " + r.unit : ""));
}
