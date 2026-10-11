import "server-only";
import { computeTarget } from "./engine";
import { selectOutfit } from "./select";
import { fetchDayWeather } from "./weather";
import { fetchClimatology } from "./climatology";
import { getCachedClimatology, getProfile, listWardrobe, putCachedClimatology, type ProfileRow } from "./repo";
import { addDays, localDate, planningDate } from "./dates";
import { MOCK_CLIMATOLOGY, mockDayWeather } from "./mock-weather";
import type { Climatology, DayWeather, Occasion, Recommendation, WardrobeItem } from "./types";

export interface PlanResult {
  date: string;
  occasion: Occasion;
  profile: ProfileRow;
  weather: DayWeather;
  climatology: Climatology | null;
  recommendation: Recommendation;
  wardrobe: WardrobeItem[];
}

export class DateOutOfRangeError extends Error {}

export async function getClimatologySafe(lat: number, lon: number, date: string): Promise<Climatology | null> {
  // Cache per ~10 km grid cell and calendar week.
  const d = new Date(`${date}T12:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.floor((d.getTime() - start) / (7 * 86_400_000));
  if (process.env.LEYRD_MOCK_WEATHER === "1") return MOCK_CLIMATOLOGY;
  const cellLat = Math.round(lat * 10) / 10;
  const cellLon = Math.round(lon * 10) / 10;
  const key = `${cellLat.toFixed(1)},${cellLon.toFixed(1)}:w${week}`;
  try {
    const cached = await getCachedClimatology(key);
    if (cached) return cached;
    const fresh = await fetchClimatology(cellLat, cellLon, date);
    await putCachedClimatology(key, fresh);
    return fresh;
  } catch (err) {
    console.error("[climatology] unavailable:", (err as Error).message);
    return null;
  }
}

export async function buildPlan(
  userId: string,
  opts: { occasion?: Occasion; excludeIds?: string[]; date?: string } = {},
): Promise<PlanResult | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const today = localDate(profile.timezone);
  if (opts.date && (opts.date < addDays(today, -1) || opts.date > addDays(today, 14))) {
    throw new DateOutOfRangeError("Date must be within the forecast window (yesterday to 14 days ahead)");
  }
  const date = opts.date ?? planningDate(profile.timezone, profile.returnTime);
  const occasion = opts.occasion ?? profile.defaultOccasion;
  const [wardrobe, weather, climatology] = await Promise.all([
    listWardrobe(userId),
    process.env.LEYRD_MOCK_WEATHER === "1"
      ? Promise.resolve(mockDayWeather(date, profile.leaveTime, profile.returnTime))
      : fetchDayWeather(profile.lat, profile.lon, profile.timezone, profile.leaveTime, profile.returnTime, date),
    getClimatologySafe(profile.lat, profile.lon, date),
  ]);
  const target = computeTarget(weather, profile, climatology);
  const recommendation = selectOutfit(target, wardrobe, occasion, {
    excludeIds: opts.excludeIds,
    now: new Date(),
    date,
  });
  return { date, occasion, profile, weather, climatology, recommendation, wardrobe };
}
