// Outfit selection: picks concrete wardrobe items that meet a LayerTarget.
// Pure: the only clock it reads is opts.now (defaulting to the current time).

import { CATALOG_BY_KIND, genericFor } from "./catalog";
import type { LayerTarget, Occasion, OutfitPick, Recommendation, WardrobeItem } from "./types";

export interface SelectOptions {
  excludeIds?: string[];
  now?: Date;
  /** YYYY-MM-DD for the recommendation; defaults to the ISO date of `now`. */
  date?: string;
}

type TorsoSlot = "base" | "mid" | "outer";
const TORSO: TorsoSlot[] = ["base", "mid", "outer"];

const SLOT_LABEL: Record<TorsoSlot, string> = {
  base: "base layer",
  mid: "mid layer",
  outer: "outer layer",
};

const WARM_ACCESSORIES = new Set(["scarf", "gloves", "beanie"]);

export const CARRY_OUTER_NOTE = "Carry it, you're outside < 20 min";
export const DEFICIT_WARNING = "Your clean clothes are lighter than today needs — add a layer";
export const UMBRELLA_WARNING = "Take an umbrella or rain shell";

/** Generic phrase for an accessory kind, e.g. "a scarf", "gloves". */
export function genericAccessory(kind: string): string {
  const plural = new Set(["gloves", "sunglasses"]);
  if (plural.has(kind)) return kind;
  const label = CATALOG_BY_KIND[kind]?.label.toLowerCase() ?? kind.replace(/_/g, " ");
  const noun = kind === "cap" ? "cap" : label;
  return /^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`;
}

export function isAvailable(item: WardrobeItem, now: Date): boolean {
  if (item.status === "clean") return true;
  if (item.statusUntil === null) return false;
  const until = Date.parse(item.statusUntil);
  return Number.isFinite(until) && until <= now.getTime();
}

function lastWornTime(item: WardrobeItem): number {
  if (!item.lastWorn) return -Infinity;
  const t = Date.parse(item.lastWorn);
  return Number.isFinite(t) ? t : -Infinity;
}

/** Comparator: closest warmth, then warmer-than-target, then occasion match, then least recently worn. */
function byFit(target: number, occasion: Occasion) {
  return (a: WardrobeItem, b: WardrobeItem): number => {
    const da = Math.abs(a.warmth - target);
    const db = Math.abs(b.warmth - target);
    if (da !== db) return da - db;
    const wa = a.warmth >= target ? 0 : 1;
    const wb = b.warmth >= target ? 0 : 1;
    if (wa !== wb) return wa - wb;
    const oa = a.occasions.includes(occasion) ? 0 : 1;
    const ob = b.occasions.includes(occasion) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const la = lastWornTime(a);
    const lb = lastWornTime(b);
    if (la !== lb) return la < lb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

function best(items: WardrobeItem[], target: number, occasion: Occasion): WardrobeItem | null {
  if (items.length === 0) return null;
  return [...items].sort(byFit(target, occasion))[0] ?? null;
}

export function selectOutfit(
  target: LayerTarget,
  wardrobe: WardrobeItem[],
  occasion: Occasion,
  opts: SelectOptions = {},
): Recommendation {
  const now = opts.now ?? new Date();
  const date = opts.date ?? now.toISOString().slice(0, 10);
  const exclude = new Set(opts.excludeIds ?? []);
  const available = wardrobe.filter((i) => !exclude.has(i.id) && isAvailable(i, now));
  const warnings: string[] = [];

  // Candidate pool per torso slot: occasion-appropriate items if any, else all.
  const pools = {} as Record<TorsoSlot, { items: WardrobeItem[]; fallback: boolean }>;
  for (const slot of TORSO) {
    const inSlot = available.filter((i) => i.slot === slot);
    const matching = inSlot.filter((i) => i.occasions.includes(occasion));
    pools[slot] = matching.length > 0 ? { items: matching, fallback: false } : { items: inSlot, fallback: true };
  }

  // --- Initial picks ---------------------------------------------------------
  const chosen: Record<TorsoSlot, WardrobeItem | null> = { base: null, mid: null, outer: null };
  const wanted: Record<TorsoSlot, boolean> = {
    base: true,
    mid: target.slots.mid > 0,
    outer: target.slots.outer > 0,
  };

  for (const slot of TORSO) {
    if (!wanted[slot]) continue;
    const t = target.slots[slot];
    const pool = pools[slot].items;
    let pick: WardrobeItem | null = null;
    if (slot === "outer" && target.needsWaterproof) {
      const adequate = pool.filter((i) => i.waterproof && i.warmth >= t - 0.5 && i.warmth <= t + 1);
      pick = best(adequate, t, occasion);
    }
    chosen[slot] = pick ?? best(pool, t, occasion);
  }

  // --- Deficit carry: upgrade outer, then mid --------------------------------
  const slotWarmth = (slot: TorsoSlot): number => {
    if (!wanted[slot]) return 0;
    const item = chosen[slot];
    return item ? item.warmth : target.slots[slot]; // a generic suggestion counts as meeting target
  };
  const targetSum = target.slots.base + target.slots.mid + target.slots.outer;
  const shortfall = (): number => targetSum - TORSO.reduce((s, slot) => s + slotWarmth(slot), 0);

  for (const slot of ["outer", "mid"] as const) {
    const current = chosen[slot];
    const gap = shortfall();
    if (gap < 1 || !current) continue;
    const warmer = pools[slot].items.filter((i) => i.warmth > current.warmth);
    const keepDry = slot === "outer" && target.needsWaterproof && current.waterproof;
    const upgrade =
      (keepDry ? best(warmer.filter((i) => i.waterproof), current.warmth + gap, occasion) : null) ??
      best(warmer, current.warmth + gap, occasion);
    if (upgrade) chosen[slot] = upgrade;
  }

  let deficitSlot: TorsoSlot | null = null;
  if (shortfall() >= 1) {
    // Suggest the slot that is furthest below its own target (mid wins ties).
    let worstGap = -Infinity;
    for (const slot of ["mid", "outer", "base"] as const) {
      const gap = target.slots[slot] - slotWarmth(slot);
      if (gap > worstGap) {
        worstGap = gap;
        deficitSlot = slot;
      }
    }
    const generic = genericFor(deficitSlot ?? "mid", target.slots[deficitSlot ?? "mid"]);
    warnings.push(`${DEFICIT_WARNING} (e.g. ${generic})`);
  }

  // --- Build torso picks -----------------------------------------------------
  const outfit: OutfitPick[] = [];
  for (const slot of TORSO) {
    if (!wanted[slot]) continue;
    const item = chosen[slot];
    const pick: OutfitPick = item
      ? { slot, item, generic: null }
      : { slot, item: null, generic: genericFor(slot, target.slots[slot]) };
    if (item && pools[slot].fallback) {
      warnings.push(`No ${occasion}-appropriate ${SLOT_LABEL[slot]} clean — using ${item.name.toLowerCase()}`);
    }
    if (!item) {
      warnings.push(`Nothing clean fits your ${SLOT_LABEL[slot]} — consider ${pick.generic}`);
    }
    if (slot === deficitSlot && item) {
      pick.note = `Add ${genericFor(slot, target.slots[slot])} if you have one`;
    }
    if (slot === "outer" && target.carryOuter) {
      pick.note = pick.note ? `${pick.note}. ${CARRY_OUTER_NOTE}` : CARRY_OUTER_NOTE;
    }
    outfit.push(pick);
  }

  // --- Accessories -----------------------------------------------------------
  const accessoryKinds = [...target.accessories];
  const outerItem = wanted.outer ? chosen.outer : null;
  const outerIsWaterproof = outerItem?.waterproof === true;
  const ownedUmbrella = best(
    available.filter((i) => i.slot === "accessory" && i.kind === "umbrella"),
    0,
    occasion,
  );
  let wantUmbrellaPick = target.umbrella;
  if (target.needsWaterproof && !outerIsWaterproof) {
    if (ownedUmbrella) wantUmbrellaPick = true;
    else if (!target.umbrella) warnings.push(UMBRELLA_WARNING);
  }
  if (wantUmbrellaPick && !accessoryKinds.includes("umbrella")) accessoryKinds.push("umbrella");

  let accessoryWarmth = 0;
  for (const kind of accessoryKinds) {
    const owned = available.filter((i) => i.slot === "accessory" && i.kind === kind);
    const matching = owned.filter((i) => i.occasions.includes(occasion));
    const item = best(matching.length > 0 ? matching : owned, 0, occasion);
    if (item) {
      outfit.push({ slot: "accessory", item, generic: null });
      accessoryWarmth += item.warmth;
    } else {
      outfit.push({ slot: "accessory", item: null, generic: genericAccessory(kind) });
      accessoryWarmth += WARM_ACCESSORIES.has(kind) ? 0.5 : 0;
    }
  }

  // --- Summary ---------------------------------------------------------------
  const torsoPicks = outfit.filter((p) => p.slot !== "accessory" && (p.item || p.generic));
  const layerCount = torsoPicks.length;

  const torsoWarmth = TORSO.reduce((sum, slot) => sum + slotWarmth(slot), 0);
  const achievedWarmth = Math.round((torsoWarmth + accessoryWarmth) * 10) / 10;

  const names = torsoPicks.map((p) => (p.item ? p.item.name : (p.generic ?? "")));
  const headline = `${layerCount} ${layerCount === 1 ? "layer" : "layers"}: ${names.join(", ")}`;

  return { date, occasion, target, outfit, layerCount, achievedWarmth, headline, warnings };
}
