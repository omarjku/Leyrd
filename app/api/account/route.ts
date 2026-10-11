import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/repo";
import { requireUserId } from "@/lib/session";

export async function DELETE() {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  await deleteUser(u.userId);
  return NextResponse.json({ ok: true });
}
