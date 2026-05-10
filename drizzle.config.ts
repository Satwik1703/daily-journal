import "dotenv/config";
import type { Config } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: url.startsWith("libsql://") ? process.env.TURSO_AUTH_TOKEN : undefined,
  },
} satisfies Config;
