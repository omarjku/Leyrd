import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  // Defence in depth against CSRF on our JSON API (Auth.js routes have their own tokens).
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth") && !SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
    }
    if (!(req.headers.get("content-type") ?? "").includes("application/json") && req.method !== "DELETE") {
      return NextResponse.json({ error: "expected application/json" }, { status: 415 });
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)"],
};
