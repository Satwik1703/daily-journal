import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * Route Handler (NOT a Server Component page). Destroys the current
 * session and redirects to the login roster.
 *
 * Why a route handler and not `page.tsx`: `destroySession()` calls
 * `cookies().delete()`, and Next 15+ disallows cookie mutation during
 * Server Component render. Only Server Actions, Route Handlers, and
 * Middleware may mutate cookies. Hitting the previous `page.tsx` threw
 * on every request. See:
 * https://nextjs.org/docs/app/api-reference/functions/cookies
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/auth/login", req.url));
}
