import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Local-preview escape hatch: set DEV_AUTH_BYPASS=1 (e.g. in the gitignored
// .env.development.local) to skip the sign-in gate when iterating on pages
// without Google OAuth credentials. Ignored outside development builds.
const skipAuthGate =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

const gate = auth((req) => {
  const { pathname, search } = req.nextUrl;

  // The login page must stay reachable without a session or sign-in loops.
  if (pathname === "/login") return NextResponse.next();

  if (!req.auth?.user) {
    // API callers get a JSON 401 instead of an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

// Next.js statically checks this file for a `proxy` function export, so it
// must be a plain function declaration rather than a conditional expression.
export function proxy(...args: Parameters<typeof gate>) {
  if (skipAuthGate) return NextResponse.next();
  return gate(...args);
}

export const config = {
  // Run on every request except NextAuth's own routes, Next.js internals,
  // and static files. Everything else - pages and API routes - requires
  // sign-in.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
