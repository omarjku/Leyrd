import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by middleware and the full auth setup.
// Keep DB and bcrypt out of this file.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/register") ||
        pathname.startsWith("/api/health");
      if (isPublic || auth?.user) return true;
      // API callers get a 401 instead of a redirect to the login page.
      if (pathname.startsWith("/api/")) return Response.json({ error: "unauthorized" }, { status: 401 });
      return false;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
        (session.user as { sv?: number }).sv = typeof token.sv === "number" ? token.sv : 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
