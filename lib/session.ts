import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Returns the signed-in user id, or a 401 response to return directly. */
export async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  return { userId };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}
