import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildPlan, type PlanResult } from "./recommend-service";
import { listWardrobe, updateItem } from "./repo";
import { OCCASIONS, type Occasion } from "./types";

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export const chatEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;
const STATUS_HOURS: Record<string, number> = { in_wash: 10, drying: 12, unavailable: 24 * 7 };

const TOOLS: BetaTool[] = [
  {
    name: "list_wardrobe",
    description:
      "List the user's wardrobe items with id, name, slot (base/mid/outer/accessory), warmth, waterproof, occasions and current status (clean/in_wash/drying/unavailable). Call this before changing an item's status so you use the right id.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_item_status",
    description:
      "Change an item's availability. Use when the user says something is in the wash, drying, lent out, lost, or back and clean. Non-clean statuses expire automatically after `hours` (default: in_wash 10h, drying 12h, unavailable 7 days).",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "Item id from list_wardrobe" },
        status: { type: "string", enum: ["clean", "in_wash", "drying", "unavailable"] },
        hours: { type: "number", minimum: 0, maximum: 720 },
      },
      required: ["item_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "get_plan",
    description:
      "Compute today's layer recommendation from the forecast, local climate history, the user's calibration, and currently available wardrobe items. Returns weather, target layers, the chosen outfit and warnings. Call again after any status change, occasion change, or when the user rejects an item (pass its id in exclude_item_ids).",
    input_schema: {
      type: "object",
      properties: {
        occasion: { type: "string", enum: OCCASIONS },
        exclude_item_ids: { type: "array", items: { type: "string" }, maxItems: 50 },
        date: { type: "string", description: "YYYY-MM-DD, defaults to the planning day" },
      },
      additionalProperties: false,
    },
  },
];

const SYSTEM = `You are Leyrd, a concise personal layer coach. You help the user decide how many layers to wear and which of their own clothes to put on, based on the forecast, local climate history, and their wardrobe.

How to work:
- Use get_plan for any outfit question; never invent weather or items. The engine's layer target is the source of truth; you choose how to explain it and may suggest swaps between owned, available items of similar warmth.
- When the user says an item is in the wash / drying / unavailable / back, call list_wardrobe to find it, set_item_status, then get_plan again and present the new outfit.
- When the user dislikes an item, call get_plan with that item in exclude_item_ids.
- "Social" context means the occasion and dress code (casual, uni, work, gym, formal). Ask which one only if it matters and is unclear.
- Answer in the user's language (English, German or Arabic). Keep replies short: one sentence of reasoning, then the outfit as a short list (base, mid, outer, accessories). Mention rain gear or carrying the jacket when the plan says so.`;

const toolInputs = {
  set_item_status: z.object({
    item_id: z.string().uuid(),
    status: z.enum(["clean", "in_wash", "drying", "unavailable"]),
    hours: z.number().min(0).max(720).optional(),
  }),
  get_plan: z.object({
    occasion: z.enum(OCCASIONS as [Occasion, ...Occasion[]]).optional(),
    exclude_item_ids: z.array(z.string().uuid()).max(50).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
};

function summarisePlan(p: PlanResult) {
  const r = p.recommendation;
  return {
    date: p.date,
    occasion: p.occasion,
    city: p.profile.city,
    weather: {
      morning: p.weather.morning,
      evening: p.weather.evening,
      worst: p.weather.worst,
    },
    climatology: p.climatology,
    target: r.target,
    outfit: r.outfit.map((o) => ({
      slot: o.slot,
      item: o.item ? { id: o.item.id, name: o.item.name, warmth: o.item.warmth, waterproof: o.item.waterproof } : null,
      generic: o.generic,
      note: o.note,
    })),
    layerCount: r.layerCount,
    headline: r.headline,
    warnings: r.warnings,
  };
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  reply: string;
  /** Latest plan computed during this turn, if any, for the UI to refresh. */
  plan: PlanResult | null;
  wardrobeChanged: boolean;
}

export async function runChat(userId: string, history: ChatTurn[], context: { occasion?: Occasion }): Promise<ChatResult> {
  const client = new Anthropic();
  let latestPlan: PlanResult | null = null;
  let wardrobeChanged = false;

  async function execute(block: BetaToolUseBlock): Promise<BetaToolResultBlockParam> {
    const result = (content: unknown, isError = false): BetaToolResultBlockParam => ({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(content),
      ...(isError ? { is_error: true } : {}),
    });
    try {
      if (block.name === "list_wardrobe") {
        const items = await listWardrobe(userId);
        return result(
          items.map((i) => ({
            id: i.id,
            name: i.name,
            slot: i.slot,
            kind: i.kind,
            warmth: i.warmth,
            waterproof: i.waterproof,
            occasions: i.occasions,
            status: i.status,
            status_until: i.statusUntil,
          })),
        );
      }
      if (block.name === "set_item_status") {
        const input = toolInputs.set_item_status.safeParse(block.input);
        if (!input.success) return result({ error: "invalid input", issues: input.error.issues }, true);
        const { item_id, status, hours } = input.data;
        const statusUntil =
          status === "clean" ? null : new Date(Date.now() + (hours ?? STATUS_HOURS[status]) * 3_600_000).toISOString();
        const item = await updateItem(userId, item_id, { status, statusUntil });
        if (!item) return result({ error: "item not found" }, true);
        wardrobeChanged = true;
        return result({ ok: true, item: { id: item.id, name: item.name, status: item.status, status_until: item.statusUntil } });
      }
      if (block.name === "get_plan") {
        const input = toolInputs.get_plan.safeParse(block.input ?? {});
        if (!input.success) return result({ error: "invalid input", issues: input.error.issues }, true);
        const plan = await buildPlan(userId, {
          occasion: input.data.occasion ?? context.occasion,
          excludeIds: input.data.exclude_item_ids,
          date: input.data.date,
        });
        if (!plan) return result({ error: "user has not finished onboarding" }, true);
        latestPlan = plan;
        return result(summarisePlan(plan));
      }
      return result({ error: `unknown tool ${block.name}` }, true);
    } catch (err) {
      console.error("[chat tool]", block.name, err);
      return result({ error: "tool failed, try again" }, true);
    }
  }

  const messages: BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can't help with that one.", plan: latestPlan, wardrobeChanged };
    }

    const toolUses = response.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "Done.", plan: latestPlan, wardrobeChanged };
    }

    messages.push({ role: "assistant", content: response.content });
    const results = await Promise.all(toolUses.map(execute));
    messages.push({ role: "user", content: results });
  }
  return { reply: "Done.", plan: latestPlan, wardrobeChanged };
}
