import { NextResponse } from "next/server";
import { z } from "zod";
import { applyFeedback } from "@/lib/calibration";
import { addDays, localDate, localTime } from "@/lib/dates";
import { getFeedbackForDay, getProfile, markWorn, recordFeedback, setCalibration } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

const schema = z
  .object({
    /** Date of the plan the user was looking at; outfit details only count if it is the day being rated. */
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    rating: z.enum(["cold", "right", "warm"]),
    adjustedTempC: z.number().min(-60).max(60).nullable().optional(),
    itemIds: z.array(uuidSchema).max(20).optional(),
  })
  .strict();

const clamp = (n: number) => Math.round(Math.max(-4, Math.min(4, n)) * 10) / 10 || 0;

export async function POST(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid feedback", parsed.error.issues);
  const profile = await getProfile(u.userId);
  if (!profile) return NextResponse.json({ error: "Finish onboarding first" }, { status: 409 });
  const { planDate, rating, adjustedTempC, itemIds } = parsed.data;

  // The day being rated is the one the user has already been out in:
  // today once they've left the house, otherwise yesterday.
  const today = localDate(profile.timezone);
  const day = localTime(profile.timezone) >= profile.leaveTime ? today : addDays(today, -1);
  const sameDay = planDate === day;

  const current = profile.calibrationOffsetC;
  const previous = await getFeedbackForDay(u.userId, day);
  // Re-rating a day replaces that day's own adjustment without discarding later ones.
  const base = previous ? clamp(current - (previous.offset_after - previous.offset_before)) : current;
  const next = applyFeedback(base, rating, profile.outdoorMinutes);
  await recordFeedback(u.userId, day, rating, base, next, sameDay ? (adjustedTempC ?? null) : null, {
    itemIds: sameDay ? (itemIds ?? []) : [],
  });
  await setCalibration(u.userId, next);
  if (sameDay && itemIds?.length) await markWorn(u.userId, itemIds);
  return NextResponse.json({ calibrationOffsetC: next, day });
}
