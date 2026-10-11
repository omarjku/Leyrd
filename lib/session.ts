import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "./db";

/**
 * Signed-in user id, verified against the database: the user must still exist
 * and the token's session version must match (bumped when an account is
 * taken over by a verified Google sign-in). Returns null otherwise.
 */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const sv = (session.user as { sv?: number }).sv ?? 0;
  const rows = await db()<{ ok: number }[]>`SELECT 1 AS ok FROM users WHERE id = ${id} AND session_version = ${sv}`;
  return rows.length ? id : null;
}

/** Returns the signed-in user id, or a 401 response to return directly. */
export async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const userId = await currentUserId();
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  return { userId };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}
