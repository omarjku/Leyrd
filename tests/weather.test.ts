import { afterEach, describe, expect, it, vi } from "vitest";
import { buildForecastUrl, fetchDayWeather, localDate, parseForecast } from "../lib/weather";
import { archiveRange, buildArchiveUrl, computeClimatology, fetchClimatology } from "../lib/climatology";

/** Two days of hourly data starting 2026-10-11T00:00 (local). */
function forecastFixture() {
  const time: string[] = [];
  const temperature_2m: (number | null)[] = [];
  const apparent_temperature: (number | null)[] = [];
  const wind_speed_10m: number[] = [];
  const precipitation: number[] = [];
  const precipitation_probability: number[] = [];
  const relative_humidity_2m: number[] = [];
  const uv_index: number[] = [];
  for (const date of ["2026-10-11", "2026-10-12"]) {
    const offset = date === "2026-10-12" ? 10 : 0;
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, "0")}:00`);
      temperature_2m.push(h + offset);
      apparent_temperature.push(h - 5 + offset);
      wind_speed_10m.push(h === 18 ? 32 : 10);
      precipitation.push(h === 12 ? 1.4 : 0);
      precipitation_probability.push(h === 12 ? 70 : h === 21 ? 95 : 10);
      relative_humidity_2m.push(h === 7 ? 90 : 60);
      uv_index.push(h === 13 ? 6.5 : 0);
    }
  }
  return {
    hourly: {
      time,
      temperature_2m,
      apparent_temperature,
      wind_speed_10m,
      precipitation,
      precipitation_probability,
      relative_humidity_2m,
      uv_index,
    },
  };
}

describe("parseForecast", () => {
  it("builds morning (leave hour + next), evening and worst windows", () => {
    const d = parseForecast(forecastFixture(), "2026-10-11", "07:30", "18:00");
    expect(d.date).toBe("2026-10-11");
    expect(d.morning.feelsLikeC).toBe(2.5); // avg of 07 (2) and 08 (3)
    expect(d.morning.tempC).toBe(7.5);
    expect(d.morning.humidityPct).toBe(75);
    expect(d.evening.feelsLikeC).toBe(13);
    expect(d.evening.windKph).toBe(32);
    expect(d.worst.feelsLikeC).toBe(2.5);
    expect(d.worst.tempC).toBe(7.5);
    expect(d.worst.windKph).toBe(32);
    // precip/uv: max over 07..18, so the 21:00 95% is ignored
    expect(d.worst.precipProb).toBe(70);
    expect(d.worst.precipMm).toBe(1.4);
    expect(d.worst.uvIndex).toBe(6.5);
    expect(d.worst.humidityPct).toBe(75);
  });

  it("returns 24 hourly entries for the requested date", () => {
    const d = parseForecast(forecastFixture(), "2026-10-12", "08:00", "17:00");
    expect(d.hourlyFeelsLikeC).toHaveLength(24);
    expect(d.hourlyPrecipProb).toHaveLength(24);
    expect(d.hourlyFeelsLikeC[0]).toBe(5);
    expect(d.hourlyFeelsLikeC[23]).toBe(28);
    expect(d.morning.feelsLikeC).toBe(13.5);
  });

  it("falls back to air temperature when feels-like is missing", () => {
    const f = forecastFixture();
    f.hourly.apparent_temperature[7] = null;
    const d = parseForecast(f, "2026-10-11", "07:00", "18:00");
    expect(d.morning.feelsLikeC).toBe(5); // avg of 7 (temp) and 3 (feels)
  });

  it("uses the next day's first hour for a 23:00 leave time", () => {
    const d = parseForecast(forecastFixture(), "2026-10-11", "23:00", "23:00");
    expect(d.morning.feelsLikeC).toBe(11.5); // avg(18, 5)
  });

  it("throws clearly on bad input", () => {
    expect(() => parseForecast({}, "2026-10-11", "07:00", "18:00")).toThrow(/missing hourly/);
    expect(() => parseForecast(forecastFixture(), "2026-10-20", "07:00", "18:00")).toThrow(/no hourly data for 2026-10-20/);
    expect(() => parseForecast(forecastFixture(), "2026-10-11", "7am", "18:00")).toThrow(/Invalid time/);
  });
});

describe("fetchDayWeather (mocked fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the right URL and parses the response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(forecastFixture()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const d = await fetchDayWeather(48.3069, 14.2858, "Europe/Vienna", "07:30", "18:00", "2026-10-11");
    expect(d.worst.feelsLikeC).toBe(2.5);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("timezone")).toBe("Europe/Vienna");
    expect(url.searchParams.get("start_date")).toBe("2026-10-11");
    expect(url.searchParams.get("end_date")).toBe("2026-10-11");
    expect(url.searchParams.get("hourly")).toContain("apparent_temperature");
    expect(url.searchParams.get("hourly")).toContain("uv_index");
  });

  it("throws a clear error on non-OK responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    await expect(fetchDayWeather(48.3, 14.3, "Europe/Vienna", "07:30", "18:00", "2026-10-11")).rejects.toThrow(
      /Open-Meteo forecast error 429/,
    );
  });

  it("uses forecast_days=2 without a date", () => {
    const url = new URL(buildForecastUrl(48.3, 14.3, "Europe/Vienna"));
    expect(url.searchParams.get("forecast_days")).toBe("2");
    expect(url.searchParams.has("start_date")).toBe(false);
  });

  it("localDate respects the timezone", () => {
    const t = new Date("2026-10-11T23:30:00Z");
    expect(localDate("Europe/Vienna", t)).toBe("2026-10-12");
    expect(localDate("America/New_York", t)).toBe("2026-10-11");
  });
});

/** Daily archive fixture: every day of 2023-2025, with controllable values near Oct 11. */
function archiveFixture(valueFor: (date: string) => { min: number; max: number; precip: number }) {
  const time: string[] = [];
  const apparent_temperature_min: number[] = [];
  const apparent_temperature_max: number[] = [];
  const precipitation_sum: number[] = [];
  for (let t = Date.UTC(2023, 0, 1); t <= Date.UTC(2025, 11, 31); t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const v = valueFor(d);
    time.push(d);
    apparent_temperature_min.push(v.min);
    apparent_temperature_max.push(v.max);
    precipitation_sum.push(v.precip);
  }
  return { daily: { time, apparent_temperature_min, apparent_temperature_max, precipitation_sum } };
}

describe("computeClimatology", () => {
  it("uses ±7 days around the month/day each year with 0.7·min + 0.3·max", () => {
    // Every in-window day: min 0, max 10 → 3. Out-of-window days are wildly different.
    const json = archiveFixture((d) => {
      const md = d.slice(5);
      const inWindow = md >= "10-04" && md <= "10-18";
      return inWindow ? { min: 0, max: 10, precip: md <= "10-07" ? 2 : 0 } : { min: 30, max: 40, precip: 50 };
    });
    const c = computeClimatology(json, "2026-10-11", 3);
    expect(c.years).toBe(3);
    expect(c.medianFeelsLikeC).toBe(3);
    expect(c.p10FeelsLikeC).toBe(3);
    expect(c.stdFeelsLikeC).toBe(0);
    // 4 wet days (Oct 4-7) of 15 per year
    expect(c.wetDayFreq).toBe(Math.round((4 / 15) * 100) / 100);
  });

  it("computes p10, median and std from a spread", () => {
    // feels-like = day offset from Oct 11 (−7..7) via min=max=offset
    const json = archiveFixture((d) => {
      const [y, m, day] = d.split("-").map(Number) as [number, number, number];
      const off = (Date.UTC(y, m - 1, day) - Date.UTC(y, 9, 11)) / 86_400_000;
      return { min: off, max: off, precip: 0 };
    });
    const c = computeClimatology(json, "2026-10-11", 3);
    expect(c.medianFeelsLikeC).toBe(0);
    expect(c.p10FeelsLikeC).toBe(-6); // 45 samples (−7..7 ×3), pos 4.4 → −6
    expect(c.stdFeelsLikeC).toBe(4.3); // sqrt(mean of k² for k=-7..7) = sqrt(18.67)
    expect(c.wetDayFreq).toBe(0);
  });

  it("wraps across the year boundary", () => {
    const json = archiveFixture((d) => {
      const md = d.slice(5);
      const inWindow = md >= "12-27" || md <= "01-10";
      return inWindow ? { min: -10, max: 0, precip: 0 } : { min: 20, max: 20, precip: 0 };
    });
    const c = computeClimatology(json, "2026-01-03", 3);
    expect(c.medianFeelsLikeC).toBe(-7);
    expect(c.p10FeelsLikeC).toBe(-7);
  });

  it("throws when no usable days are present", () => {
    expect(() => computeClimatology({ daily: { time: [] } }, "2026-10-11", 10)).toThrow(/no usable days/);
    expect(() => computeClimatology({}, "2026-10-11", 10)).toThrow(/missing daily/);
  });

  it("requests full years ending last year", async () => {
    expect(archiveRange("2026-10-11", 10, new Date("2026-10-11T00:00:00Z"))).toEqual({ start: "2016-01-01", end: "2025-12-31" });
    const url = new URL(buildArchiveUrl(48.3, 14.3, "2026-10-11", 10, new Date("2026-10-11T00:00:00Z")));
    expect(url.origin + url.pathname).toBe("https://archive-api.open-meteo.com/v1/archive");
    expect(url.searchParams.get("daily")).toBe("apparent_temperature_min,apparent_temperature_max,precipitation_sum");
  });

  it("fetchClimatology throws a clear error on non-OK responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(fetchClimatology(48.3, 14.3, "2026-10-11")).rejects.toThrow(/Open-Meteo archive error 500/);
    vi.unstubAllGlobals();
  });
});
