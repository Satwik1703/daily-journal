import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const PUBLIC_PATH_PREFIXES = [
  "/auth/",
  "/api/auth/",
  "/_next/",
  "/icon",
  "/apple-icon",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon",
];

const PUBLIC_EXACT = new Set(["/auth", "/manifest.webmanifest", "/sw.js"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.search = "";
  if (pathname !== "/" && !pathname.startsWith("/api/")) {
    loginUrl.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
