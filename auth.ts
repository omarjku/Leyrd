import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

// Dummy hash so unknown emails cost the same as wrong passwords.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("leyrd-timing-equaliser", 12));

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const ip = clientIpFromHeaders(request?.headers);
        if (!rateLimit(`login:${ip}`, 10, 60_000) || !rateLimit(`login:${email}`, 30, 60_000)) {
          throw new TooManyAttempts();
        }
        const sql = db();
        const rows = await sql<
          { id: string; email: string; name: string | null; password_hash: string | null; session_version: number }[]
        >`SELECT id, email, name, password_hash, session_version FROM users WHERE email = ${email}`;
        const user = rows[0];
        const ok = await bcrypt.compare(password, user?.password_hash ?? getDummyHash());
        if (!user || !user.password_hash || !ok) return null;
        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.session_version };
      },
    }),
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: false })] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;
      const sql = db();
      // Google proves ownership of the email. If an unverified password account was
      // registered with this email by someone else, drop its password (pre-hijack defence).
      await sql`
        INSERT INTO users (email, name, image, email_verified)
        VALUES (${email}, ${profile.name ?? null}, ${(profile.picture as string | undefined) ?? null}, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = CASE WHEN users.email_verified THEN users.password_hash ELSE NULL END,
          -- Invalidate any session issued to whoever registered the unverified account.
          session_version = users.session_version + CASE WHEN users.email_verified THEN 0 ELSE 1 END,
          email_verified = true,
          name = COALESCE(users.name, EXCLUDED.name),
          image = COALESCE(EXCLUDED.image, users.image)`;
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && token.email) {
        const rows = await db()<{ id: string; session_version: number }[]>`
          SELECT id, session_version FROM users WHERE email = ${token.email.toLowerCase()}`;
        if (rows[0]) {
          token.uid = rows[0].id;
          token.sv = rows[0].session_version;
        }
      } else if (user?.id) {
        token.uid = user.id;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: { id: string; sv: number; email?: string | null; name?: string | null; image?: string | null };
  }
}
