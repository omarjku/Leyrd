// Shared domain types. Keep this file dependency-free: it is imported by both
// server code (engine, API routes) and client components.

export type Slot = "base" | "mid" | "outer" | "accessory";
export const SLOTS: Slot[] = ["base", "mid", "outer", "accessory"];

export type ItemStatus = "clean" | "in_wash" | "drying" | "unavailable";

export type Occasion = "casual" | "uni" | "work" | "gym" | "formal";
export const OCCASIONS: Occasion[] = ["casual", "uni", "work", "gym", "formal"];

export type ThermalType = "runs_cold" | "neutral" | "runs_hot";
export type CommuteMode = "walk" | "bike" | "transit" | "car";

export interface WardrobeItem {
  id: string;
  name: string;
  slot: Slot;
  /** Catalog kind, e.g. "tshirt", "fleece", "winter_coat", "scarf". */
  kind: string;
  /**
   * Warmth on the per-slot scale from the engine spec:
   * base 0-2, mid 0-3, outer 0-3, accessory 0-1 (scarf/gloves/beanie 0.5).
   */
  warmth: number;
  waterproof: boolean;
  windproof: boolean;
  occasions: Occasion[];
  status: ItemStatus;
  /** ISO timestamp when a non-clean status expires back to clean. */
  statusUntil: string | null;
  lastWorn: string | null;
}

export interface Profile {
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  /** "HH:MM" local time. */
  leaveTime: string;
  returnTime: string;
  commuteMode: CommuteMode;
  /** Minutes spent outdoors on a typical day (commute both ways + walking). */
  outdoorMinutes: number;
  thermalType: ThermalType;
  defaultOccasion: Occasion;
  /** Personal calibration, °C added to feels-like. Capped at ±4. */
  calibrationOffsetC: number;
}

export interface WeatherWindow {
  tempC: number;
  feelsLikeC: number;
  windKph: number;
  precipMm: number;
  /** 0-100 */
  precipProb: number;
  humidityPct: number;
  uvIndex: number;
}

export interface DayWeather {
  date: string; // YYYY-MM-DD local
  /** Conditions around leave time. */
  morning: WeatherWindow;
  /** Conditions around return time. */
  evening: WeatherWindow;
  /** Worst case across the outdoor windows (coldest feels-like, max wind/rain/uv). */
  worst: WeatherWindow;
  /** Hourly feels-like for the day (24 entries, local hours), for the UI. */
  hourlyFeelsLikeC: number[];
  hourlyPrecipProb: number[];
}

export interface Climatology {
  /** Number of years sampled. */
  years: number;
  /** Feels-like daily-min-ish percentiles for this calendar window. */
  p10FeelsLikeC: number;
  medianFeelsLikeC: number;
  stdFeelsLikeC: number;
  /** Fraction (0-1) of days in the window with >= 1 mm precipitation. */
  wetDayFreq: number;
}

export type Band = "hot" | "warm" | "mild" | "cool" | "cold" | "freezing";

export interface LayerTarget {
  band: Band;
  adjustedTempC: number;
  /** Target warmth per slot, on the per-slot scale. */
  slots: { base: number; mid: number; outer: number };
  /** Accessory kinds recommended, e.g. ["scarf", "gloves"]. */
  accessories: string[];
  /** Sum of slot targets + 0.5 per warm accessory. */
  totalWarmth: number;
  needsWaterproof: boolean;
  umbrella: boolean;
  /** Exposure is short: carry the outer layer rather than wear it. */
  carryOuter: boolean;
  sunProtection: boolean;
  /** 0.5 - 0.95 */
  confidence: number;
  /** Human-readable reasons, most important first. */
  reasons: string[];
}

export interface OutfitPick {
  slot: Slot;
  /** Owned item chosen, or null if nothing owned/available fits. */
  item: WardrobeItem | null;
  /** Generic suggestion when no owned item fits (e.g. "a fleece"), else null. */
  generic: string | null;
  note?: string;
}

export interface Recommendation {
  date: string;
  occasion: Occasion;
  target: LayerTarget;
  outfit: OutfitPick[];
  /** Number of torso layers actually worn (base + mid + outer present). */
  layerCount: number;
  /** Achieved warmth of the selected outfit. */
  achievedWarmth: number;
  /** One-line headline, e.g. "3 layers: thermal, fleece, mid jacket". */
  headline: string;
  warnings: string[];
}

export type FeedbackRating = "cold" | "right" | "warm";
