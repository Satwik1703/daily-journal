import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const u = await db.execute("SELECT id, name, is_owner FROM users");
console.log("users:", JSON.stringify(u.rows));

const t = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','sessions','login_attempts','recovery_codes')",
);
console.log("auth tables:", t.rows.map((r) => r.name).join(","));

const je = await db.execute("PRAGMA table_info(journal_entries)");
console.log(
  "journal_entries cols:",
  je.rows.map((c) => c.name).join(","),
);

const la = await db.execute("PRAGMA table_info(login_attempts)");
console.log("login_attempts cols:", la.rows.map((c) => c.name).join(","));

const settings = await db.execute("PRAGMA table_info(settings)");
console.log("settings cols:", settings.rows.map((c) => c.name).join(","));

const habits = await db.execute(
  "SELECT COUNT(*) AS n, COUNT(CASE WHEN user_id = 'u_satwik_seed_001' THEN 1 END) AS sat FROM habits",
);
console.log("habits backfill:", JSON.stringify(habits.rows[0]));

const goals = await db.execute(
  "SELECT COUNT(*) AS n, COUNT(CASE WHEN user_id = 'u_satwik_seed_001' THEN 1 END) AS sat FROM goals",
);
console.log("goals backfill:", JSON.stringify(goals.rows[0]));
