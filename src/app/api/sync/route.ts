import { NextRequest, NextResponse } from "next/server";
import { DISPATCH } from "@/lib/sync/dispatch";
import { getCurrentUser } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { kind?: string; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { kind, args } = body;
  if (!kind || typeof kind !== "string") {
    return NextResponse.json({ ok: false, error: "Missing kind" }, { status: 400 });
  }
  const action = DISPATCH[kind];
  if (!action) {
    return NextResponse.json({ ok: false, error: `Unknown kind: ${kind}` }, { status: 400 });
  }
  try {
    const result = await (action as (input: unknown) => Promise<unknown>)(args);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // libSQL/Drizzle wraps the real reason ("foreign key mismatch",
    // "no such column", a NOT NULL/UNIQUE violation, etc.) in `err.cause`.
    // The top-level message is just "Failed query: <sql> params: ...", which
    // is useless for diagnosis — surface the underlying cause too.
    let message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error ? (err.cause as unknown) : undefined;
    const causeMsg =
      cause instanceof Error ? cause.message : cause ? String(cause) : undefined;
    if (causeMsg && !message.includes(causeMsg)) {
      message = `${message} — ${causeMsg}`;
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
