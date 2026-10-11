import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chatEnabled, runChat, withinChatBudget } from "@/lib/chat";
import { localDate, planningDate } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";
import { getProfile } from "@/lib/repo";
import { badRequest, requireUserId } from "@/lib/session";
import { occasionSchema } from "@/lib/validation";

export const maxDuration = 60;

const schema = z
  .object({
    messages: z
      .array(
        z.union([
          z.object({ role: z.literal("user"), content: z.string().min(1).max(1000) }).strict(),
          z.object({ role: z.literal("assistant"), content: z.string().min(1).max(8000) }).strict(),
        ]),
      )
      .min(1)
      .max(20),
    occasion: occasionSchema.optional(),
  })
  .strict();

export async function POST(req: Request) {
  const u = await requireUserId();
  if ("error" in u) return u.error;
  if (!chatEnabled()) {
    return NextResponse.json(
      { error: "AI chat is not configured yet. Use the buttons on each item to swap or mark it as in the wash." },
      { status: 503 },
    );
  }
  if (!rateLimit(`chat:${u.userId}`, 20, 60_000) || !rateLimit(`chat-day:${u.userId}`, 300, 86_400_000)) {
    return NextResponse.json({ error: "You're sending messages too fast. Wait a minute." }, { status: 429 });
  }
  if (!withinChatBudget(u.userId)) {
    return NextResponse.json(
      { error: "Today's AI chat limit is reached. The buttons on each item still re-plan your outfit." },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid chat request", parsed.error.issues);
  const history = parsed.data.messages.slice(-20);
  if (history[0]?.role !== "user") history.shift();
  if (history.length === 0 || history[history.length - 1].role !== "user") return badRequest("Last message must be from the user");
  try {
    const profile = await getProfile(u.userId);
    if (!profile) return NextResponse.json({ error: "Finish onboarding first" }, { status: 409 });
    const result = await runChat(u.userId, history, {
      occasion: parsed.data.occasion,
      today: localDate(profile.timezone),
      planningDate: planningDate(profile.timezone, profile.returnTime),
    });
    const plan = result.plan
      ? (({ profile, wardrobe, ...rest }) => ({ ...rest, calibrationOffsetC: profile.calibrationOffsetC, city: profile.city }))(
          result.plan,
        )
      : null;
    return NextResponse.json({ reply: result.reply, plan, wardrobeChanged: result.wardrobeChanged });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The AI is busy right now. Try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[chat] invalid ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "AI chat is misconfigured." }, { status: 503 });
    }
    console.error("[chat]", err);
    return NextResponse.json({ error: "Chat failed. Try again." }, { status: 502 });
  }
}
