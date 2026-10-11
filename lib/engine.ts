// Layer engine: turns a day's weather + the user's profile (+ optional local
// climatology) into a per-slot warmth target. Pure and deterministic.

import type { Band, Climatology, DayWeather, LayerTarget, Profile } from "./types";

export interface BandTarget {
  slots: { base: number; mid: number; outer: number };
  accessories: string[];
}

/** Per-slot target warmth by band (base 0-2, mid 0-3, outer 0-3). */
export const BAND_TARGETS: Record<Band, BandTarget> = {
  hot: { slots: { base: 0, mid: 0, outer: 0 }, accessories: [] },
  warm: { slots: { base: 0, mid: 1, outer: 0 }, accessories: [] },
  mild: { slots: { base: 1, mid: 2, outer: 1 }, accessories: [] },
  cool: { slots: { base: 2, mid: 2, outer: 2 }, accessories: ["scarf"] },
  cold: { slots: { base: 2, mid: 3, outer: 3 }, accessories: ["scarf", "gloves"] },
  freezing: { slots: { base: 2, mid: 3, outer: 3 }, accessories: ["scarf", "gloves", "beanie"] },
};

/** Lower edges of each band (°C), warmest first. Below the last edge is "freezing". */
const BAND_EDGES: { band: Band; min: number }[] = [
  { band: "hot", min: 25 },
  { band: "warm", min: 18 },
  { band: "mild", min: 12 },
  { band: "cool", min: 6 },
  { band: "cold", min: 0 },
];

/** Accessories that add warmth (0.5 each) to the total. */
export const WARM_ACCESSORIES = ["scarf", "gloves", "beanie"];

export function bandFor(adjusted: number): Band {
  for (const { band, min } of BAND_EDGES) {
    if (adjusted >= min) return band;
  }
  return "freezing";
}

const round1 = (n: number): number => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
};

/** "−2°C" / "+1.5°C" with a typographic minus; whole numbers without decimals. */
function fmtDelta(n: number, fixed = false): string {
  const sign = n < 0 ? "−" : "+";
  const abs = Math.abs(n);
  const body = fixed ? abs.toFixed(1) : String(round1(abs));
  return `${sign}${body}°C`;
}

function fmtTemp(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "−" : ""}${Math.abs(r)}°C`;
}

export function computeTarget(
  weather: DayWeather,
  profile: Profile,
  clim: Climatology | null,
): LayerTarget {
  const { worst, morning, evening } = weather;
  const reasons: string[] = [];

  // --- Adjusted feels-like -------------------------------------------------
  const coldestIsEvening = evening.feelsLikeC < morning.feelsLikeC;
  const when = coldestIsEvening ? profile.returnTime : profile.leaveTime;
  reasons.push(`Feels like ${fmtTemp(worst.feelsLikeC)} at ${when}`);

  let adjusted = worst.feelsLikeC;
  const adjustmentReasons: string[] = [];

  if (worst.windKph > 25) {
    adjusted -= 2;
    adjustmentReasons.push(`Wind ${Math.round(worst.windKph)} km/h: ${fmtDelta(-2)}`);
  }
  if (profile.commuteMode === "bike") {
    adjusted -= 2;
    adjustmentReasons.push(`You bike: ${fmtDelta(-2)}`);
  }
  if (profile.thermalType === "runs_cold") {
    adjusted -= 1.5;
    adjustmentReasons.push(`You run cold: ${fmtDelta(-1.5)}`);
  } else if (profile.thermalType === "runs_hot") {
    adjusted += 1.5;
    adjustmentReasons.push(`You run hot: ${fmtDelta(1.5)}`);
  }
  if (profile.calibrationOffsetC !== 0) {
    adjusted += profile.calibrationOffsetC;
    adjustmentReasons.push(`Your feedback so far: ${fmtDelta(profile.calibrationOffsetC, true)}`);
  }
  adjusted = round1(adjusted);

  const band = bandFor(adjusted);
  const base = BAND_TARGETS[band];
  const slots = { ...base.slots };
  const accessories = [...base.accessories];

  // --- Climatology temperature floors ------------------------------------
  const climReasons: string[] = [];
  if (clim) {
    let raised = false;
    if (adjusted <= clim.p10FeelsLikeC + 2 && slots.outer < 1) {
      slots.outer = 1;
      raised = true;
    }
    if (adjusted <= clim.p10FeelsLikeC + 3 && slots.mid < 2) {
      slots.mid = 2;
      raised = true;
    }
    if (raised) climReasons.push("near the cold tail for this time of year");
  }

  // --- Rain ----------------------------------------------------------------
  let needsWaterproof = false;
  let umbrella = false;
  const rainReasons: string[] = [];
  const rainy = worst.precipProb >= 50 || worst.precipMm >= 1;
  if (rainy) {
    if (slots.outer > 0) needsWaterproof = true;
    else umbrella = true;
    if (worst.precipProb >= 50) rainReasons.push(`${Math.round(worst.precipProb)}% chance of rain`);
    else rainReasons.push(`${round1(worst.precipMm)} mm of rain expected`);
  }
  if (clim && clim.wetDayFreq >= 0.25 && worst.precipProb >= 20 && !needsWaterproof && !umbrella) {
    if (slots.outer > 0) needsWaterproof = true;
    else umbrella = true;
    climReasons.push(`it rains on ${Math.round(clim.wetDayFreq * 100)}% of days this time of year`);
  }

  // --- Sun -----------------------------------------------------------------
  let sunProtection = false;
  const otherReasons: string[] = [];
  if (worst.uvIndex >= 6) {
    sunProtection = true;
    accessories.push("sunglasses");
    if (worst.uvIndex >= 8) accessories.push("cap");
    otherReasons.push(`UV index ${Math.round(worst.uvIndex)}: sun protection`);
  }

  // --- Humidity ------------------------------------------------------------
  if (worst.humidityPct > 80 && (band === "warm" || band === "hot")) {
    otherReasons.push("humid: keep the base light");
  }

  // --- Short exposure ------------------------------------------------------
  const carryOuter = profile.outdoorMinutes < 20 && slots.outer > 0;
  if (carryOuter) otherReasons.push(`Only ${profile.outdoorMinutes} min outside: carry the outer layer`);

  // --- Confidence ----------------------------------------------------------
  let confidence = 0.85;
  if (BAND_EDGES.some(({ min }) => Math.abs(adjusted - min) <= 1)) confidence -= 0.1;
  if (clim && clim.stdFeelsLikeC > 0) {
    const z = Math.abs(adjusted - clim.medianFeelsLikeC) / clim.stdFeelsLikeC;
    if (z > 1.5) confidence -= 0.1;
  }
  if (Math.abs(morning.feelsLikeC - evening.feelsLikeC) > 6) confidence -= 0.05;
  confidence = Math.round(Math.min(0.95, Math.max(0.5, confidence)) * 100) / 100;

  const warmAccessoryCount = accessories.filter((a) => WARM_ACCESSORIES.includes(a)).length;
  const totalWarmth = slots.base + slots.mid + slots.outer + 0.5 * warmAccessoryCount;

  reasons.push(...adjustmentReasons, ...rainReasons, ...climReasons, ...otherReasons);

  return {
    band,
    adjustedTempC: adjusted,
    slots,
    accessories,
    totalWarmth,
    needsWaterproof,
    umbrella,
    carryOuter,
    sunProtection,
    confidence,
    reasons,
  };
}
