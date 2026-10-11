import { NextResponse } from "next/server";
import { z } from "zod";
import { applyFeedback } from "@/lib/calibration";
import { getFeedbackForDay, getProfile, markWorn, recordFeedback, setCalibration } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

const schema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rating: z.enum(["cold", "right", "warm"]),
    adjustedTempC: z.number().min(-60).max(60).nullable().optional(),
    itemIds: z.array(uuidSchema).max(20).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid feedback", parsed.error.issues);
  const profile = await getProfile(u.userId);
  if (!profile) return NextResponse.json({ error: "Finish onboarding first" }, { status: 409 });
  const { day, rating, adjustedTempC, itemIds } = parsed.data;
  // Re-rating the same day replaces the earlier rating instead of stacking.
  const previous = await getFeedbackForDay(u.userId, day);
  const base = previous ? previous.offset_before : profile.calibrationOffsetC;
  const next = applyFeedback(base, rating, profile.outdoorMinutes);
  await recordFeedback(u.userId, day, rating, base, next, adjustedTempC ?? null, { itemIds: itemIds ?? [] });
  await setCalibration(u.userId, next);
  if (itemIds?.length) await markWorn(u.userId, itemIds);
  return NextResponse.json({ calibrationOffsetC: next });
}
