import { NextResponse } from "next/server";
import { z } from "zod";
import { addItems, countWardrobe, listWardrobe } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { newItemSchema } from "@/lib/validation";

export async function GET() {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  return NextResponse.json({ items: await listWardrobe(u.userId) });
}

export async function POST(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const parsed = z.object({ items: z.array(newItemSchema).min(1).max(50) }).strict().safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest("Invalid items", parsed.error.issues);
  if ((await countWardrobe(u.userId)) + parsed.data.items.length > 300) {
    return badRequest("Wardrobe limit reached (300 items)");
  }
  await addItems(u.userId, parsed.data.items);
  return NextResponse.json({ items: await listWardrobe(u.userId) }, { status: 201 });
}
