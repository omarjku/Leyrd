import { NextResponse } from "next/server";
import { z } from "zod";
import { addItems, countWardrobe, getProfile, upsertProfile } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { newItemSchema, profileSchema } from "@/lib/validation";

export async function GET() {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const profile = await getProfile(u.userId);
  return NextResponse.json({ profile });
}

const putSchema = z
  .object({
    profile: profileSchema,
    /** Items to add (onboarding checklist). Only accepted while wardrobe is empty. */
    items: z.array(newItemSchema).max(100).optional(),
    completeOnboarding: z.boolean().optional(),
  })
  .strict();

export async function PUT(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid profile", parsed.error.issues);
  const { profile, items, completeOnboarding } = parsed.data;
  await upsertProfile(u.userId, profile, completeOnboarding ?? false);
  if (items && items.length > 0 && (await countWardrobe(u.userId)) === 0) {
    await addItems(u.userId, items);
  }
  return NextResponse.json({ profile: await getProfile(u.userId) });
}
