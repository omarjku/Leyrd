// Open-Meteo historical archive → feels-like climatology for this time of year.

import type { Climatology } from "./types";

export const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
/** Days either side of the target month/day included in each year's sample. */
export const WINDOW_DAYS = 7;
export const WET_DAY_MM = 1;

export interface OpenMeteoDaily {
  daily?: {
    time?: string[];
    apparent_temperature_min?: (number | null)[];
    apparent_temperature_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

const DAY_MS = 86_400_000;

function parseDate(d: string): { y: number; m: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) throw new Error(`Invalid date "${d}", expected YYYY-MM-DD`);
  return { y: Number(m[1]), m: Number(m[2]), day: Number(m[3]) };
}

/** Linear-interpolated percentile (p in 0..1) of a sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Archive range: `years` full calendar years ending the year before `date` (never in the future). */
export function archiveRange(date: string, years: number, now: Date = new Date()): { start: string; end: string } {
  const endYear = Math.min(parseDate(date).y, now.getUTCFullYear()) - 1;
  return { start: `${endYear - years + 1}-01-01`, end: `${endYear}-12-31` };
}

/**
 * Pure: from an archive `daily` response, keep days within ±7 days of the
 * month/day of `date` in each year, and summarise a "morning-ish" feels-like
 * (0.7·min + 0.3·max) plus wet-day frequency.
 */
export function computeClimatology(dailyJson: unknown, date: string, years: number): Climatology {
  const daily = (dailyJson as OpenMeteoDaily | null)?.daily;
  const times = daily?.time;
  if (!daily || !Array.isArray(times)) throw new Error("Open-Meteo archive: missing daily data");
  const { m, day } = parseDate(date);

  const feels: number[] = [];
  let precipDays = 0;
  let wetDays = 0;

  times.forEach((t, i) => {
    const d = parseDate(t);
    const ts = Date.UTC(d.y, d.m - 1, d.day);
    // Distance to the target month/day in this, the previous and the next year (handles year wrap).
    const dist = Math.min(
      ...[d.y - 1, d.y, d.y + 1].map((y) => Math.abs(ts - Date.UTC(y, m - 1, day)) / DAY_MS),
    );
    if (dist > WINDOW_DAYS) return;

    const lo = daily.apparent_temperature_min?.[i];
    const hi = daily.apparent_temperature_max?.[i];
    if (typeof lo === "number" && typeof hi === "number") feels.push(0.7 * lo + 0.3 * hi);

    const p = daily.precipitation_sum?.[i];
    if (typeof p === "number") {
      precipDays++;
      if (p >= WET_DAY_MM) wetDays++;
    }
  });

  if (feels.length === 0) throw new Error(`Open-Meteo archive: no usable days around ${date}`);

  const sorted = [...feels].sort((a, b) => a - b);
  const mean = feels.reduce((s, x) => s + x, 0) / feels.length;
  const variance = feels.reduce((s, x) => s + (x - mean) ** 2, 0) / feels.length;

  return {
    years,
    p10FeelsLikeC: r1(percentile(sorted, 0.1)),
    medianFeelsLikeC: r1(percentile(sorted, 0.5)),
    stdFeelsLikeC: r1(Math.sqrt(variance)),
    wetDayFreq: precipDays > 0 ? Math.round((wetDays / precipDays) * 100) / 100 : 0,
  };
}

export function buildArchiveUrl(lat: number, lon: number, date: string, years: number, now?: Date): string {
  const { start, end } = archiveRange(date, years, now);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: start,
    end_date: end,
    daily: "apparent_temperature_min,apparent_temperature_max,precipitation_sum",
    timezone: "auto",
  });
  return `${ARCHIVE_URL}?${params.toString()}`;
}

export async function fetchClimatology(lat: number, lon: number, date: string, years = 10): Promise<Climatology> {
  const url = buildArchiveUrl(lat, lon, date, years);
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(`Open-Meteo archive request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo archive error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: unknown = await res.json();
  return computeClimatology(json, date, years);
}
