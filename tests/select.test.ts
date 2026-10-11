import { describe, expect, it } from "vitest";
import { BAND_TARGETS } from "../lib/engine";
import { CARRY_OUTER_NOTE, DEFICIT_WARNING, UMBRELLA_WARNING, selectOutfit } from "../lib/select";
import { CATALOG_BY_KIND } from "../lib/catalog";
import type { Band, LayerTarget, WardrobeItem } from "../lib/types";

const NOW = new Date("2026-10-11T06:00:00Z");

let seq = 0;
function item(kind: string, over: Partial<WardrobeItem> = {}): WardrobeItem {
  const c = CATALOG_BY_KIND[kind];
  if (!c) throw new Error(`unknown kind ${kind}`);
  return {
    id: over.id ?? `${kind}-${++seq}`,
    name: c.label.toLowerCase(),
    slot: c.slot,
    kind,
    warmth: c.warmth,
    waterproof: c.waterproof,
    windproof: c.windproof,
    occasions: [...c.occasions],
    status: "clean",
    statusUntil: null,
    lastWorn: null,
    ...over,
  };
}

function target(band: Band, over: Partial<LayerTarget> = {}): LayerTarget {
  const b = BAND_TARGETS[band];
  const slots = { ...b.slots, ...over.slots };
  const accessories = over.accessories ?? [...b.accessories];
  return {
    band,
    adjustedTempC: 0,
    slots,
    accessories,
    totalWarmth: slots.base + slots.mid + slots.outer + 0.5 * accessories.filter((a) => ["scarf", "gloves", "beanie"].includes(a)).length,
    needsWaterproof: false,
    umbrella: false,
    carryOuter: false,
    sunProtection: false,
    confidence: 0.85,
    reasons: [],
    ...over,
  };
}

const pickFor = (r: ReturnType<typeof selectOutfit>, slot: string) => r.outfit.find((p) => p.slot === slot);

describe("selectOutfit: basic picks", () => {
  it("cold day: thermal, fleece, winter parka", () => {
    const wardrobe = [
      item("tshirt"),
      item("thermal", { name: "thermal" }),
      item("sweater"),
      item("fleece", { name: "fleece" }),
      item("light_jacket"),
      item("winter_coat", { name: "winter parka" }),
      item("scarf", { name: "grey scarf" }),
      item("gloves", { name: "gloves" }),
    ];
    const r = selectOutfit(target("cold"), wardrobe, "uni", { now: NOW });
    expect(r.headline).toBe("3 layers: thermal, fleece, winter parka");
    expect(r.layerCount).toBe(3);
    expect(r.achievedWarmth).toBe(9);
    expect(r.warnings).toEqual([]);
    expect(r.date).toBe("2026-10-11");
    expect(r.outfit.filter((p) => p.slot === "accessory").map((p) => p.item?.name)).toEqual(["grey scarf", "gloves"]);
  });

  it("hot day: just the lightest base", () => {
    const r = selectOutfit(target("hot"), [item("thermal"), item("tshirt"), item("fleece")], "casual", { now: NOW });
    expect(r.layerCount).toBe(1);
    expect(r.headline).toBe("1 layer: t-shirt");
    expect(r.outfit).toHaveLength(1);
    expect(r.achievedWarmth).toBe(0);
  });

  it("uses opts.date when given", () => {
    const r = selectOutfit(target("hot"), [item("tshirt")], "casual", { now: NOW, date: "2026-10-12" });
    expect(r.date).toBe("2026-10-12");
  });

  it("prefers warmth ≥ target on ties, then least recently worn", () => {
    // mild mid target 2: cardigan 1.5 vs (hypothetical) 2.5 mid → tie on distance, warmer wins
    const warm = item("sweater", { id: "warm", warmth: 2.5 });
    const cool = item("cardigan", { id: "cool" });
    expect(pickFor(selectOutfit(target("mild"), [item("long_sleeve"), cool, warm], "uni", { now: NOW }), "mid")?.item?.id).toBe("warm");

    const recent = item("sweater", { id: "recent", lastWorn: "2026-10-10T08:00:00Z" });
    const older = item("sweater", { id: "older", lastWorn: "2026-10-01T08:00:00Z" });
    const never = item("sweater", { id: "never", lastWorn: null });
    const r = selectOutfit(target("mild"), [item("long_sleeve"), recent, older, never], "uni", { now: NOW });
    expect(pickFor(r, "mid")?.item?.id).toBe("never");
    const r2 = selectOutfit(target("mild"), [item("long_sleeve"), recent, older], "uni", { now: NOW });
    expect(pickFor(r2, "mid")?.item?.id).toBe("older");
  });
});

describe("selectOutfit: availability", () => {
  it("skips an item in the wash and chooses the next best", () => {
    const wardrobe = [
      item("thermal"),
      item("fleece", { id: "fleece", status: "in_wash", statusUntil: "2026-10-12T18:00:00Z" }),
      item("sweater", { id: "sweater" }),
      item("winter_coat"),
    ];
    const r = selectOutfit(target("cold"), wardrobe, "uni", { now: NOW });
    expect(pickFor(r, "mid")?.item?.id).toBe("sweater");
  });

  it("treats an item whose status has expired as clean again", () => {
    const wardrobe = [
      item("thermal"),
      item("fleece", { id: "fleece", status: "drying", statusUntil: "2026-10-11T05:00:00Z" }),
      item("sweater", { id: "sweater" }),
      item("winter_coat"),
    ];
    expect(pickFor(selectOutfit(target("cold"), wardrobe, "uni", { now: NOW }), "mid")?.item?.id).toBe("fleece");
    const earlier = new Date("2026-10-11T04:00:00Z");
    expect(pickFor(selectOutfit(target("cold"), wardrobe, "uni", { now: earlier }), "mid")?.item?.id).toBe("sweater");
  });

  it("unavailable without an expiry stays unavailable", () => {
    const wardrobe = [item("thermal"), item("fleece", { id: "fleece", status: "unavailable" }), item("sweater", { id: "sweater" })];
    expect(pickFor(selectOutfit(target("cold"), wardrobe, "uni", { now: NOW }), "mid")?.item?.id).toBe("sweater");
  });

  it("respects excludeIds", () => {
    const wardrobe = [item("thermal"), item("fleece", { id: "fleece" }), item("sweater", { id: "sweater" }), item("winter_coat")];
    const r = selectOutfit(target("cold"), wardrobe, "uni", { now: NOW, excludeIds: ["fleece"] });
    expect(pickFor(r, "mid")?.item?.id).toBe("sweater");
  });
});

describe("selectOutfit: occasion", () => {
  it("prefers occasion-appropriate items", () => {
    const wardrobe = [item("dress_shirt"), item("tshirt"), item("blazer", { id: "blazer" }), item("hoodie", { id: "hoodie" })];
    const r = selectOutfit(target("warm"), wardrobe, "work", { now: NOW });
    expect(pickFor(r, "mid")?.item?.id).toBe("blazer");
    expect(r.warnings).toEqual([]);
  });

  it("falls back with a warning when nothing in the slot suits the occasion", () => {
    const wardrobe = [item("long_sleeve"), item("hoodie", { name: "Hoodie", occasions: ["casual", "gym"] }), item("mid_jacket")];
    const r = selectOutfit(target("mild"), wardrobe, "uni", { now: NOW });
    expect(pickFor(r, "mid")?.item?.kind).toBe("hoodie");
    expect(r.warnings).toContain("No uni-appropriate mid layer clean — using hoodie");
  });
});

describe("selectOutfit: gaps and deficits", () => {
  it("suggests a generic item for a slot with nothing owned", () => {
    const r = selectOutfit(target("cool", { accessories: [] }), [item("thermal"), item("sweater")], "uni", { now: NOW });
    const outer = pickFor(r, "outer");
    expect(outer?.item).toBeNull();
    expect(outer?.generic).toBe("a mid-weight jacket");
    expect(r.layerCount).toBe(3);
    expect(r.achievedWarmth).toBe(6);
    expect(r.headline).toBe("3 layers: thermal base layer, sweater / jumper, a mid-weight jacket");
  });

  it("upgrades outer then mid to cover a short base layer", () => {
    const wardrobe = [
      item("tshirt"),
      item("sweater", { id: "sweater" }),
      item("fleece", { id: "fleece" }),
      item("mid_jacket", { id: "mid_jacket" }),
      item("puffer", { id: "puffer" }),
    ];
    const r = selectOutfit(target("cool", { accessories: [] }), wardrobe, "uni", { now: NOW });
    expect(pickFor(r, "outer")?.item?.id).toBe("puffer");
    expect(pickFor(r, "mid")?.item?.id).toBe("fleece");
    expect(r.achievedWarmth).toBe(6);
    expect(r.warnings.some((w) => w.startsWith(DEFICIT_WARNING))).toBe(false);
  });

  it("warns when clean clothes are too light even after upgrades", () => {
    const wardrobe = [item("tshirt"), item("cardigan"), item("light_jacket")];
    const r = selectOutfit(target("cold", { accessories: [] }), wardrobe, "casual", { now: NOW });
    const w = r.warnings.find((x) => x.startsWith(DEFICIT_WARNING));
    expect(w).toBeDefined();
    // outer is furthest below target (1 vs 3), so that's the suggestion
    expect(w).toContain("a winter coat");
    expect(r.achievedWarmth).toBe(2.5);
    expect(pickFor(r, "outer")?.note).toBe("Add a winter coat if you have one");
  });
});

describe("selectOutfit: rain and accessories", () => {
  it("prefers a waterproof outer of adequate warmth", () => {
    const wardrobe = [item("thermal"), item("sweater"), item("mid_jacket", { id: "mid" }), item("trench", { id: "trench" })];
    const r = selectOutfit(target("cool", { accessories: [], needsWaterproof: true }), wardrobe, "uni", { now: NOW });
    expect(pickFor(r, "outer")?.item?.id).toBe("trench");
    expect(r.warnings).not.toContain(UMBRELLA_WARNING);
    expect(r.outfit.some((p) => p.item?.kind === "umbrella")).toBe(false);
  });

  it("keeps the outer waterproof when upgrading for a deficit", () => {
    const wardrobe = [item("tshirt"), item("sweater"), item("trench", { id: "trench" }), item("puffer", { id: "a-puffer" }), item("winter_coat", { id: "parka" })];
    const r = selectOutfit(target("cool", { accessories: [], needsWaterproof: true }), wardrobe, "uni", { now: NOW });
    expect(pickFor(r, "outer")?.item?.id).toBe("parka");
  });

  it("adds an owned umbrella when the outer is not waterproof", () => {
    const wardrobe = [item("thermal"), item("sweater"), item("mid_jacket"), item("umbrella", { id: "umb" })];
    const r = selectOutfit(target("cool", { accessories: [], needsWaterproof: true }), wardrobe, "uni", { now: NOW });
    expect(r.outfit.find((p) => p.slot === "accessory")?.item?.id).toBe("umb");
    expect(r.warnings).not.toContain(UMBRELLA_WARNING);
  });

  it("warns when there is neither a waterproof outer nor an umbrella", () => {
    const wardrobe = [item("thermal"), item("sweater"), item("mid_jacket"), item("umbrella", { status: "unavailable" })];
    const r = selectOutfit(target("cool", { accessories: [], needsWaterproof: true }), wardrobe, "uni", { now: NOW });
    expect(r.warnings).toContain(UMBRELLA_WARNING);
  });

  it("umbrella flag picks an owned umbrella, else a generic one", () => {
    const owned = selectOutfit(target("warm", { umbrella: true }), [item("tshirt"), item("light_shirt"), item("umbrella", { id: "umb" })], "uni", { now: NOW });
    expect(owned.outfit.find((p) => p.slot === "accessory")?.item?.id).toBe("umb");
    expect(owned.layerCount).toBe(2);

    const none = selectOutfit(target("warm", { umbrella: true }), [item("tshirt"), item("light_shirt")], "uni", { now: NOW });
    expect(none.outfit.find((p) => p.slot === "accessory")?.generic).toBe("an umbrella");
  });

  it("uses owned accessories and generic ones for the rest", () => {
    const wardrobe = [item("thermal"), item("fleece"), item("puffer"), item("scarf", { id: "scarf" })];
    const r = selectOutfit(target("freezing"), wardrobe, "uni", { now: NOW });
    const acc = r.outfit.filter((p) => p.slot === "accessory");
    expect(acc.map((p) => p.item?.id ?? p.generic)).toEqual(["scarf", "gloves", "a beanie"]);
    expect(r.achievedWarmth).toBe(9.5);
  });

  it("notes carrying the outer on short exposure", () => {
    const r = selectOutfit(target("cool", { accessories: [], carryOuter: true }), [item("thermal"), item("sweater"), item("mid_jacket")], "uni", { now: NOW });
    expect(pickFor(r, "outer")?.note).toBe(CARRY_OUTER_NOTE);
  });
});
