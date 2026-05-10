import { drizzle } from "drizzle-orm/libsql";
// Use the Node entry explicitly so `file:` URLs work in Next's server bundle.
// The default `@libsql/client` import sometimes resolves to the web entry under
// Turbopack, which only supports libsql:/wss:/ws:/https:/http: URLs.
import { createClient } from "@libsql/client/node";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";

const client = createClient({
  url,
  authToken: url.startsWith("libsql://") ? process.env.TURSO_AUTH_TOKEN : undefined,
});

export const db = drizzle(client, { schema });
