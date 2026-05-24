import { createClient } from "@libsql/client/node";
import path from "node:path";

const local = createClient({ url: `file:${path.resolve("local.db")}` });

async function q(sql, args = []) {
  const r = await local.execute({ sql, args });
  return r.rows;
}

console.log("\n=== Counts by (period, periodKey) ===");
const counts = await q(
  `SELECT period, period_key as periodKey, COUNT(*) as n,
          SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) as active
   FROM goals
   GROUP BY period, period_key
   ORDER BY period, period_key`,
);
for (const r of counts) {
  console.log(`  ${r.period} ${r.periodKey}: ${r.n} total, ${r.active} active`);
}

console.log("\n=== Weekly W21 (current) ===");
const w21 = await q(
  `SELECT title, status, archived_at, habit_id
   FROM goals WHERE period='week' AND period_key='2026-W21'
   ORDER BY title`,
);
for (const r of w21) console.log(`  ${r.title} | status=${r.status} archived=${r.archived_at} habit_id=${r.habit_id}`);

console.log("\n=== Weekly W22 ===");
const w22 = await q(
  `SELECT title, status, archived_at, habit_id
   FROM goals WHERE period='week' AND period_key='2026-W22'
   ORDER BY title`,
);
for (const r of w22) console.log(`  ${r.title} | status=${r.status} archived=${r.archived_at} habit_id=${r.habit_id}`);

console.log("\n=== Distinct weekly period_keys ===");
const wkeys = await q(`SELECT DISTINCT period_key FROM goals WHERE period='week' ORDER BY period_key`);
console.log("  " + wkeys.map((r) => r.periodKey).join(", "));
