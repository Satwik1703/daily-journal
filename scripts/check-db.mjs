import { createClient } from "@libsql/client";

const c = createClient({ url: "file:./local.db" });

const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("Tables:");
for (const r of tables.rows) console.log("  -", r.name);

const entries = await c.execute("SELECT date, gratitude_1, energy, mood, sleep_quality, tomorrow_plan, updated_at FROM journal_entries ORDER BY date");
console.log(`\njournal_entries rows: ${entries.rows.length}`);
for (const r of entries.rows) {
  console.log(JSON.stringify(r));
}
