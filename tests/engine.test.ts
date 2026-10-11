import { describe, expect, it } from "vitest";
import { BAND_TARGETS, bandFor, computeTarget } from "../lib/engine";
import type { Climatology, DayWeather, Profile, WeatherWindow } from "../lib/types";

function win(over: Partial<WeatherWindow> = {}): WeatherWindow {
  return { tempC: 10, feelsLikeC: 9, windKph: 10, precipMm: 0, precipProb: 0, humidityPct: 60, uvIndex: 1, ...over };
}

function day(worst: Partial<WeatherWindow> = {}, morning?: Partial<WeatherWindow>, evening?: Partial<WeatherWindow>): DayWeather {
  const w = win(worst);
  return {
    date: "2026-10-11",
    morning: win({ ...w, ...morning }),
    evening: win({ ...w, ...evening }),
    worst: w,
    hourlyFeelsLikeC: Array(24).fill(w.feelsLikeC),
    hourlyPrecipProb: Array(24).fill(w.precipProb),
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    city: "Linz",
    lat: 48.3069,
    lon: 14.2858,
    timezone: "Europe/Vienna",
    leaveTime: "07:30",
    returnTime: "18:00",
    commuteMode: "walk",
    outdoorMinutes: 40,
    thermalType: "neutral",
    defaultOccasion: "uni",
    calibrationOffsetC: 0,
    ...over,
  };
}

function clim(over: Partial<Climatology> = {}): Climatology {
  return { years: 10, p10FeelsLikeC: -5, medianFeelsLikeC: 9, stdFeelsLikeC: 4, wetDayFreq: 0.1, ...over };
}

describe("bandFor", () => {
  it.each([
    [30, "hot"],
    [25, "hot"],
    [24.9, "warm"],
    [18, "warm"],
    [17.9, "mild"],
    [12, "mild"],
    [11.9, "cool"],
    [6, "cool"],
    [5.9, "cold"],
    [0, "cold"],
    [-0.1, "freezing"],
    [-15, "freezing"],
  ] as const)("%s°C → %s", (t, band) => {
    expect(bandFor(t)).toBe(band);
  });
});

describe("computeTarget: bands and slot targets", () => {
  it("cold day gets full layering with scarf + gloves", () => {
    const t = computeTarget(day({ feelsLikeC: 4 }), profile(), null);
    expect(t.band).toBe("cold");
    expect(t.adjustedTempC).toBe(4);
    expect(t.slots).toEqual({ base: 2, mid: 3, outer: 3 });
    expect(t.accessories).toEqual(["scarf", "gloves"]);
    expect(t.totalWarmth).toBe(9);
    expect(t.reasons[0]).toBe("Feels like 4°C at 07:30");
  });

  it("freezing adds a beanie", () => {
    const t = computeTarget(day({ feelsLikeC: -3 }), profile(), null);
    expect(t.band).toBe("freezing");
    expect(t.accessories).toEqual(["scarf", "gloves", "beanie"]);
    expect(t.totalWarmth).toBe(9.5);
    expect(t.reasons[0]).toBe("Feels like −3°C at 07:30");
  });

  it("hot day has nothing to layer", () => {
    const t = computeTarget(day({ feelsLikeC: 28, uvIndex: 3 }), profile(), null);
    expect(t.band).toBe("hot");
    expect(t.slots).toEqual({ base: 0, mid: 0, outer: 0 });
    expect(t.totalWarmth).toBe(0);
  });

  it("matches BAND_TARGETS for every band", () => {
    for (const [feels, band] of [[26, "hot"], [20, "warm"], [15, "mild"], [9, "cool"], [3, "cold"], [-4, "freezing"]] as const) {
      const t = computeTarget(day({ feelsLikeC: feels }), profile(), null);
      expect(t.band).toBe(band);
      expect(t.slots).toEqual(BAND_TARGETS[band].slots);
    }
  });

  it("names the evening when the evening is the colder window", () => {
    const w = day({ feelsLikeC: 3 }, { feelsLikeC: 8 }, { feelsLikeC: 3 });
    expect(computeTarget(w, profile(), null).reasons[0]).toBe("Feels like 3°C at 18:00");
  });

  it("is deterministic", () => {
    const w = day({ feelsLikeC: 7, windKph: 30, precipProb: 60 });
    expect(computeTarget(w, profile(), clim())).toEqual(computeTarget(w, profile(), clim()));
  });
});

describe("computeTarget: adjustments", () => {
  it("strong wind costs 2°C", () => {
    const t = computeTarget(day({ feelsLikeC: 13, windKph: 30 }), profile(), null);
    expect(t.adjustedTempC).toBe(11);
    expect(t.band).toBe("cool");
    expect(t.reasons).toContain("Wind 30 km/h: −2°C");
  });

  it("wind of exactly 25 km/h does not count", () => {
    expect(computeTarget(day({ feelsLikeC: 13, windKph: 25 }), profile(), null).adjustedTempC).toBe(13);
  });

  it("biking costs another 2°C on top of wind", () => {
    const t = computeTarget(day({ feelsLikeC: 13, windKph: 30 }), profile({ commuteMode: "bike" }), null);
    expect(t.adjustedTempC).toBe(9);
    expect(t.reasons).toContain("You bike: −2°C");
  });

  it("thermal type shifts by 1.5°C either way", () => {
    const cold = computeTarget(day({ feelsLikeC: 13 }), profile({ thermalType: "runs_cold" }), null);
    expect(cold.adjustedTempC).toBe(11.5);
    expect(cold.band).toBe("cool");
    expect(cold.reasons).toContain("You run cold: −1.5°C");

    const hot = computeTarget(day({ feelsLikeC: 17 }), profile({ thermalType: "runs_hot" }), null);
    expect(hot.adjustedTempC).toBe(18.5);
    expect(hot.band).toBe("warm");
    expect(hot.reasons).toContain("You run hot: +1.5°C");
  });

  it("applies the personal calibration offset", () => {
    const t = computeTarget(day({ feelsLikeC: 13 }), profile({ calibrationOffsetC: -1 }), null);
    expect(t.adjustedTempC).toBe(12);
    expect(t.reasons).toContain("Your feedback so far: −1.0°C");
  });

  it("orders reasons: feels-like first, then adjustments", () => {
    const t = computeTarget(
      day({ feelsLikeC: 10, windKph: 30, precipProb: 60 }),
      profile({ commuteMode: "bike", thermalType: "runs_cold", calibrationOffsetC: -1 }),
      null,
    );
    expect(t.reasons.slice(0, 6)).toEqual([
      "Feels like 10°C at 07:30",
      "Wind 30 km/h: −2°C",
      "You bike: −2°C",
      "You run cold: −1.5°C",
      "Your feedback so far: −1.0°C",
      "60% chance of rain",
    ]);
    expect(t.adjustedTempC).toBe(3.5);
  });
});

describe("computeTarget: modifiers", () => {
  it("rain on a layered day needs a waterproof outer", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 60 }), profile(), null);
    expect(t.needsWaterproof).toBe(true);
    expect(t.umbrella).toBe(false);
    expect(t.reasons).toContain("60% chance of rain");
  });

  it("≥ 1 mm precipitation counts as rain even at low probability", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 20, precipMm: 1.2 }), profile(), null);
    expect(t.needsWaterproof).toBe(true);
  });

  it("49% and 0.9 mm is not rain", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 49, precipMm: 0.9 }), profile(), null);
    expect(t.needsWaterproof).toBe(false);
    expect(t.umbrella).toBe(false);
  });

  it("rain without an outer layer → umbrella instead", () => {
    const t = computeTarget(day({ feelsLikeC: 21, precipProb: 70 }), profile(), null);
    expect(t.band).toBe("warm");
    expect(t.needsWaterproof).toBe(false);
    expect(t.umbrella).toBe(true);
  });

  it("UV ≥ 6 adds sunglasses, ≥ 8 adds a cap", () => {
    const six = computeTarget(day({ feelsLikeC: 22, uvIndex: 6 }), profile(), null);
    expect(six.sunProtection).toBe(true);
    expect(six.accessories).toEqual(["sunglasses"]);
    expect(six.totalWarmth).toBe(1);

    const nine = computeTarget(day({ feelsLikeC: 22, uvIndex: 9 }), profile(), null);
    expect(nine.accessories).toEqual(["sunglasses", "cap"]);

    expect(computeTarget(day({ feelsLikeC: 22, uvIndex: 5 }), profile(), null).sunProtection).toBe(false);
  });

  it("humid warm day keeps the base light", () => {
    const t = computeTarget(day({ feelsLikeC: 22, humidityPct: 85 }), profile(), null);
    expect(t.reasons).toContain("humid: keep the base light");
    const cool = computeTarget(day({ feelsLikeC: 9, humidityPct: 85 }), profile(), null);
    expect(cool.reasons).not.toContain("humid: keep the base light");
  });

  it("short exposure carries the outer layer, only if there is one", () => {
    expect(computeTarget(day({ feelsLikeC: 9 }), profile({ outdoorMinutes: 10 }), null).carryOuter).toBe(true);
    expect(computeTarget(day({ feelsLikeC: 9 }), profile({ outdoorMinutes: 20 }), null).carryOuter).toBe(false);
    expect(computeTarget(day({ feelsLikeC: 21 }), profile({ outdoorMinutes: 10 }), null).carryOuter).toBe(false);
  });
});

describe("computeTarget: climatology floors", () => {
  it("within 2°C of p10 forces an outer layer and a 2-warmth mid", () => {
    const t = computeTarget(day({ feelsLikeC: 19 }), profile(), clim({ p10FeelsLikeC: 17.5, medianFeelsLikeC: 21, stdFeelsLikeC: 3 }));
    expect(t.band).toBe("warm");
    expect(t.slots).toEqual({ base: 0, mid: 2, outer: 1 });
    expect(t.totalWarmth).toBe(3);
    expect(t.reasons).toContain("near the cold tail for this time of year");
  });

  it("within 3°C (but not 2°C) only raises the mid layer", () => {
    const t = computeTarget(day({ feelsLikeC: 20.5 }), profile(), clim({ p10FeelsLikeC: 17.5, medianFeelsLikeC: 21, stdFeelsLikeC: 3 }));
    expect(t.slots).toEqual({ base: 0, mid: 2, outer: 0 });
  });

  it("far from the cold tail changes nothing", () => {
    const t = computeTarget(day({ feelsLikeC: 22 }), profile(), clim({ p10FeelsLikeC: 15, medianFeelsLikeC: 21, stdFeelsLikeC: 3 }));
    expect(t.slots).toEqual(BAND_TARGETS.warm.slots);
    expect(t.reasons).not.toContain("near the cold tail for this time of year");
  });

  it("frequent rain this time of year forces waterproof when some rain is forecast", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 30 }), profile(), clim({ wetDayFreq: 0.3 }));
    expect(t.needsWaterproof).toBe(true);
    expect(t.reasons).toContain("it rains on 30% of days this time of year");
  });

  it("wet climatology alone does not force rain gear on a dry forecast", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 10 }), profile(), clim({ wetDayFreq: 0.3 }));
    expect(t.needsWaterproof).toBe(false);
    expect(t.umbrella).toBe(false);
  });

  it("wet climatology does not duplicate a forecast rain reason", () => {
    const t = computeTarget(day({ feelsLikeC: 9, precipProb: 80 }), profile(), clim({ wetDayFreq: 0.4 }));
    expect(t.needsWaterproof).toBe(true);
    expect(t.reasons.some((r) => r.startsWith("it rains on"))).toBe(false);
  });
});

describe("computeTarget: confidence", () => {
  it("starts at 0.85", () => {
    expect(computeTarget(day({ feelsLikeC: 9 }), profile(), null).confidence).toBe(0.85);
  });

  it("drops near a band edge", () => {
    expect(computeTarget(day({ feelsLikeC: 12.5 }), profile(), null).confidence).toBe(0.75);
    expect(computeTarget(day({ feelsLikeC: 5.2 }), profile(), null).confidence).toBe(0.75);
  });

  it("drops when the day is unusual for the season", () => {
    const t = computeTarget(day({ feelsLikeC: 9 }), profile(), clim({ medianFeelsLikeC: 16, stdFeelsLikeC: 2 }));
    expect(t.confidence).toBe(0.75);
  });

  it("drops when morning and evening differ a lot, and stacks", () => {
    const w = day({ feelsLikeC: 12.5 }, { feelsLikeC: 12.5 }, { feelsLikeC: 20 });
    const t = computeTarget(w, profile(), clim({ medianFeelsLikeC: 22, stdFeelsLikeC: 2 }));
    expect(t.confidence).toBe(0.6);
    expect(t.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
