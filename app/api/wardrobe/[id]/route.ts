import { NextResponse } from "next/server";
import { deleteItem, updateItem, type ItemPatch } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { itemPatchSchema, uuidSchema } from "@/lib/validation";

const DEFAULT_HOURS: Record<string, number> = { in_wash: 10, drying: 12, unavailable: 24 * 7 };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return badRequest("Invalid id");
  const parsed = itemPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid patch", parsed.error.issues);
  const { statusHours, worn, ...rest } = parsed.data;
  const patch: ItemPatch = { ...rest };
  if (rest.status) {
    if (rest.status === "clean") patch.statusUntil = null;
    else {
      const hours = statusHours ?? DEFAULT_HOURS[rest.status] ?? 10;
      patch.statusUntil = new Date(Date.now() + hours * 3_600_000).toISOString();
    }
  }
  if (worn) patch.lastWorn = new Date().toISOString();
  const item = await updateItem(u.userId, id, patch);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return badRequest("Invalid id");
  const ok = await deleteItem(u.userId, id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
