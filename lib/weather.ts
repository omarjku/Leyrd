// Open-Meteo forecast → DayWeather for the user's commute windows.

import type { DayWeather, WeatherWindow } from "./types";

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const HOURLY_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "wind_speed_10m",
  "precipitation",
  "precipitation_probability",
  "relative_humidity_2m",
  "uv_index",
] as const;

type HourlyVar = (typeof HOURLY_VARS)[number];

export interface OpenMeteoForecast {
  hourly?: { time?: string[] } & Partial<Record<HourlyVar, (number | null)[]>>;
}

/** Today's date (YYYY-MM-DD) in an IANA timezone. */
export function localDate(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseHour(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  const h = Number(m[1]);
  if (h < 0 || h > 23) throw new Error(`Invalid hour in "${hhmm}"`);
  return h;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Pure parser: picks `date` out of an Open-Meteo hourly forecast and builds the
 * morning (leave hour + next hour, averaged), evening (return hour) and worst-case
 * windows. Feels-like/temp/wind/humidity come from the two commute windows only;
 * precipitation, precip probability and UV are the max over leave→return hours.
 */
export function parseForecast(json: unknown, date: string, leaveTime: string, returnTime: string): DayWeather {
  const hourly = (json as OpenMeteoForecast | null)?.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) throw new Error("Open-Meteo forecast: missing hourly data");

  const start = times.findIndex((t) => t.startsWith(`${date}T`));
  if (start < 0) throw new Error(`Open-Meteo forecast: no hourly data for ${date}`);
  const count = times.filter((t) => t.startsWith(`${date}T`)).length;
  if (count < 24) throw new Error(`Open-Meteo forecast: only ${count} hours for ${date}`);

  const series = (v: HourlyVar): (number | null)[] => hourly[v] ?? [];
  const at = (v: HourlyVar, idx: number, fallback = 0): number => {
    const x = series(v)[idx];
    return typeof x === "number" && Number.isFinite(x) ? x : fallback;
  };
  const feelsAt = (idx: number): number => {
    const x = series("apparent_temperature")[idx];
    return typeof x === "number" && Number.isFinite(x) ? x : at("temperature_2m", idx);
  };

  const windowAt = (idxs: number[]): WeatherWindow => {
    const valid = idxs.filter((i) => i >= 0 && i < times.length);
    const avg = (f: (i: number) => number): number => r1(valid.reduce((s, i) => s + f(i), 0) / valid.length);
    return {
      tempC: avg((i) => at("temperature_2m", i)),
      feelsLikeC: avg(feelsAt),
      windKph: avg((i) => at("wind_speed_10m", i)),
      precipMm: avg((i) => at("precipitation", i)),
      precipProb: Math.round(avg((i) => at("precipitation_probability", i))),
      humidityPct: Math.round(avg((i) => at("relative_humidity_2m", i))),
      uvIndex: avg((i) => at("uv_index", i)),
    };
  };

  const leaveHour = parseHour(leaveTime);
  const returnHour = parseHour(returnTime);
  const leaveIdx = start + leaveHour;
  const returnIdx = start + returnHour;

  const morning = windowAt([leaveIdx, leaveIdx + 1]);
  const evening = windowAt([returnIdx]);

  // Hours spent out of the house: leave→return inclusive (to midnight if return < leave).
  const lastHour = returnHour >= leaveHour ? returnHour : 23;
  const span: number[] = [];
  for (let h = leaveHour; h <= lastHour; h++) span.push(start + h);
  const maxOver = (v: HourlyVar): number => Math.max(...span.map((i) => at(v, i)));

  const worst: WeatherWindow = {
    tempC: Math.min(morning.tempC, evening.tempC),
    feelsLikeC: Math.min(morning.feelsLikeC, evening.feelsLikeC),
    windKph: Math.max(morning.windKph, evening.windKph),
    precipMm: r1(Math.max(maxOver("precipitation"), morning.precipMm, evening.precipMm)),
    precipProb: Math.round(Math.max(maxOver("precipitation_probability"), morning.precipProb, evening.precipProb)),
    humidityPct: Math.max(morning.humidityPct, evening.humidityPct),
    uvIndex: r1(Math.max(maxOver("uv_index"), morning.uvIndex, evening.uvIndex)),
  };

  const day = Array.from({ length: 24 }, (_, h) => start + h);
  return {
    date,
    morning,
    evening,
    worst,
    hourlyFeelsLikeC: day.map((i) => r1(feelsAt(i))),
    hourlyPrecipProb: day.map((i) => Math.round(at("precipitation_probability", i))),
  };
}

export function buildForecastUrl(lat: number, lon: number, timezone: string, date?: string): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY_VARS.join(","),
    timezone,
  });
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
  } else {
    params.set("forecast_days", "2");
  }
  return `${FORECAST_URL}?${params.toString()}`;
}

export async function fetchDayWeather(
  lat: number,
  lon: number,
  timezone: string,
  leaveTime: string,
  returnTime: string,
  date?: string,
): Promise<DayWeather> {
  const url = buildForecastUrl(lat, lon, timezone, date);
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new Error(`Open-Meteo forecast request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo forecast error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: unknown = await res.json();
  return parseForecast(json, date ?? localDate(timezone), leaveTime, returnTime);
}
