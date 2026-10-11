import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    name: z.string().trim().min(1).max(60),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
  })
  .strict();

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);
  const rows = await db()<{ id: string }[]>`
    INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!rows[0]) {
    return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
