import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPlan, DateOutOfRangeError } from "@/lib/recommend-service";
import { rateLimit } from "@/lib/rate-limit";
import { badRequest, requireUserId } from "@/lib/session";
import { occasionSchema, uuidSchema } from "@/lib/validation";

const schema = z
  .object({
    occasion: occasionSchema.optional(),
    excludeIds: z.array(uuidSchema).max(100).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  if (!rateLimit(`rec:${u.userId}`, 30, 60_000)) {
    return NextResponse.json({ error: "Slow down a little and try again in a minute." }, { status: 429 });
  }
  const parsed = schema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);
  try {
    const plan = await buildPlan(u.userId, parsed.data);
    if (!plan) return NextResponse.json({ error: "Finish onboarding first" }, { status: 409 });
    const { profile, wardrobe, ...rest } = plan;
    return NextResponse.json({ ...rest, calibrationOffsetC: profile.calibrationOffsetC, city: profile.city });
  } catch (err) {
    if (err instanceof DateOutOfRangeError) return badRequest(err.message);
    console.error("[recommend]", err);
    return NextResponse.json({ error: "Weather service unavailable, try again in a minute." }, { status: 502 });
  }
}
