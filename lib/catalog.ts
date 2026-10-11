import type { Occasion, Slot } from "./types";

export interface CatalogEntry {
  kind: string;
  label: string;
  slot: Slot;
  warmth: number;
  waterproof: boolean;
  windproof: boolean;
  occasions: Occasion[];
}

const ALL: Occasion[] = ["casual", "uni", "work", "gym", "formal"];
const EVERYDAY: Occasion[] = ["casual", "uni", "work"];

/** Checklist shown in onboarding. Warmth uses the engine spec's per-slot scale. */
export const CATALOG: CatalogEntry[] = [
  // Base layers (0-2)
  { kind: "tshirt", label: "T-shirt", slot: "base", warmth: 0, waterproof: false, windproof: false, occasions: ["casual", "uni", "gym"] },
  { kind: "polo", label: "Polo shirt", slot: "base", warmth: 0, waterproof: false, windproof: false, occasions: EVERYDAY },
  { kind: "long_sleeve", label: "Long-sleeve top", slot: "base", warmth: 1, waterproof: false, windproof: false, occasions: EVERYDAY },
  { kind: "dress_shirt", label: "Button-up shirt", slot: "base", warmth: 1, waterproof: false, windproof: false, occasions: ["uni", "work", "formal"] },
  { kind: "thermal", label: "Thermal base layer", slot: "base", warmth: 2, waterproof: false, windproof: false, occasions: ALL },
  { kind: "sports_top", label: "Sports top", slot: "base", warmth: 0, waterproof: false, windproof: false, occasions: ["gym"] },
  // Mid layers (0-3)
  { kind: "light_shirt", label: "Overshirt / flannel", slot: "mid", warmth: 1, waterproof: false, windproof: false, occasions: EVERYDAY },
  { kind: "cardigan", label: "Cardigan", slot: "mid", warmth: 1.5, waterproof: false, windproof: false, occasions: ["casual", "uni", "work", "formal"] },
  { kind: "sweater", label: "Sweater / jumper", slot: "mid", warmth: 2, waterproof: false, windproof: false, occasions: ["casual", "uni", "work", "formal"] },
  { kind: "hoodie", label: "Hoodie", slot: "mid", warmth: 2, waterproof: false, windproof: false, occasions: ["casual", "uni", "gym"] },
  { kind: "fleece", label: "Fleece", slot: "mid", warmth: 3, waterproof: false, windproof: false, occasions: ["casual", "uni", "gym"] },
  { kind: "blazer", label: "Blazer", slot: "mid", warmth: 1.5, waterproof: false, windproof: false, occasions: ["work", "formal"] },
  // Outer layers (0-3)
  { kind: "windbreaker", label: "Windbreaker", slot: "outer", warmth: 1, waterproof: false, windproof: true, occasions: ["casual", "uni", "gym"] },
  { kind: "rain_shell", label: "Rain shell", slot: "outer", warmth: 1, waterproof: true, windproof: true, occasions: ["casual", "uni", "work", "gym"] },
  { kind: "light_jacket", label: "Light jacket (denim, bomber)", slot: "outer", warmth: 1, waterproof: false, windproof: false, occasions: ["casual", "uni"] },
  { kind: "mid_jacket", label: "Mid-weight jacket", slot: "outer", warmth: 2, waterproof: false, windproof: true, occasions: ["casual", "uni", "work"] },
  { kind: "softshell", label: "Softshell jacket", slot: "outer", warmth: 2, waterproof: false, windproof: true, occasions: ["casual", "uni", "gym"] },
  { kind: "trench", label: "Trench / mac", slot: "outer", warmth: 1.5, waterproof: true, windproof: true, occasions: ["uni", "work", "formal"] },
  { kind: "wool_coat", label: "Wool coat", slot: "outer", warmth: 2.5, waterproof: false, windproof: true, occasions: ["uni", "work", "formal"] },
  { kind: "puffer", label: "Puffer jacket", slot: "outer", warmth: 3, waterproof: false, windproof: true, occasions: ["casual", "uni"] },
  { kind: "winter_coat", label: "Winter parka", slot: "outer", warmth: 3, waterproof: true, windproof: true, occasions: ["casual", "uni", "work"] },
  // Accessories (warm ones 0.5, others 0)
  { kind: "scarf", label: "Scarf", slot: "accessory", warmth: 0.5, waterproof: false, windproof: false, occasions: ALL },
  { kind: "gloves", label: "Gloves", slot: "accessory", warmth: 0.5, waterproof: false, windproof: false, occasions: ALL },
  { kind: "beanie", label: "Beanie", slot: "accessory", warmth: 0.5, waterproof: false, windproof: false, occasions: ["casual", "uni", "gym"] },
  { kind: "cap", label: "Cap / sun hat", slot: "accessory", warmth: 0, waterproof: false, windproof: false, occasions: ["casual", "uni", "gym"] },
  { kind: "sunglasses", label: "Sunglasses", slot: "accessory", warmth: 0, waterproof: false, windproof: false, occasions: ALL },
  { kind: "umbrella", label: "Umbrella", slot: "accessory", warmth: 0, waterproof: true, windproof: false, occasions: ALL },
];

export const CATALOG_BY_KIND: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((c) => [c.kind, c]),
);

/** Generic noun for a missing slot at a given warmth, used when nothing owned fits. */
export function genericFor(slot: Slot, warmth: number): string {
  if (slot === "base") return warmth >= 2 ? "a thermal top" : warmth >= 1 ? "a long-sleeve top" : "a t-shirt";
  if (slot === "mid") return warmth >= 3 ? "a fleece" : warmth >= 2 ? "a sweater" : "a light overshirt";
  if (slot === "outer") return warmth >= 3 ? "a winter coat" : warmth >= 2 ? "a mid-weight jacket" : "a light jacket";
  return "an accessory";
}
