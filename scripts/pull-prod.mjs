// Mirror prod Turso → local.db. Destructive on local; backs up first.
// Usage (PowerShell):
//   Get-Content .env.production.local | ForEach-Object {
//     if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
//       Set-Item -Path "Env:\$($matches[1])" -Value $matches[2].Trim('"')
//     }
//   }
//   node scripts/pull-prod.mjs

import { createClient } from "@libsql/client/node";
import fs from "node:fs";
import path from "node:path";

const PROD_URL = process.env.TURSO_DATABASE_URL;
const PROD_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!PROD_URL) throw new Error("TURSO_DATABASE_URL missing — load .env.production.local first.");

const LOCAL_PATH = path.resolve("local.db");
if (fs.existsSync(LOCAL_PATH)) {
  const bak = `${LOCAL_PATH}.bak-${Date.now()}`;
  fs.copyFileSync(LOCAL_PATH, bak);
  console.log("Local backed up to", bak);
}

const prod = createClient({ url: PROD_URL, authToken: PROD_TOKEN });
const local = createClient({ url: `file:${LOCAL_PATH}` });

const tablesRes = await prod.execute(
  "SELECT name FROM sqlite_master WHERE type='table' " +
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%__drizzle%' " +
    "AND name NOT LIKE 'libsql_%'",
);
const tables = tablesRes.rows.map((r) => r.name);
console.log(`Found ${tables.length} tables on prod.`);

// Disable FK checks while we wipe-and-load so cascading FKs don't trip us up.
await local.execute("PRAGMA foreign_keys = OFF");

// Wipe local tables in reverse-creation order (best-effort — disabling FKs
// also helps when ordering is wrong).
for (const t of [...tables].reverse()) {
  try {
    await local.execute(`DELETE FROM "${t}"`);
  } catch (e) {
    console.warn(`  ! failed to clear ${t}:`, e?.message ?? e);
  }
}

// Load row-by-row, table-by-table.
for (const t of tables) {
  const data = await prod.execute(`SELECT * FROM "${t}"`);
  if (data.rows.length === 0) {
    console.log(`  ${t}: empty`);
    continue;
  }
  const cols = data.columns;
  const placeholders = cols.map(() => "?").join(",");
  const sql = `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`;
  let ok = 0;
  let failed = 0;
  for (const row of data.rows) {
    try {
      await local.execute({ sql, args: cols.map((c) => row[c]) });
      ok++;
    } catch (e) {
      failed++;
      if (failed <= 3) console.warn(`  ! ${t} row insert failed:`, e?.message ?? e);
    }
  }
  console.log(`  ${t}: ${ok}/${data.rows.length} rows${failed ? ` (${failed} failed)` : ""}`);
}

await local.execute("PRAGMA foreign_keys = ON");
console.log("Done.");
