// Deterministic weather for local development and end-to-end tests
// (enabled with LEYRD_MOCK_WEATHER=1; never used in production).
import type { Climatology, DayWeather, WeatherWindow } from "./types";

export function mockDayWeather(date: string, leaveTime: string, returnTime: string): DayWeather {
  const hourly = Array.from({ length: 24 }, (_, h) => Math.round((7 + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI)) * 10) / 10);
  const rain = Array.from({ length: 24 }, (_, h) => (h >= 15 && h <= 19 ? 60 : 10));
  const at = (t: string): WeatherWindow => {
    const h = parseInt(t, 10);
    return { tempC: hourly[h] + 2, feelsLikeC: hourly[h], windKph: 18, precipMm: rain[h] > 50 ? 1.2 : 0, precipProb: rain[h], humidityPct: 75, uvIndex: 2 };
  };
  const morning = at(leaveTime);
  const evening = at(returnTime);
  return {
    date,
    morning,
    evening,
    worst: {
      ...morning,
      feelsLikeC: Math.min(morning.feelsLikeC, evening.feelsLikeC),
      precipProb: Math.max(...rain),
      precipMm: 1.2,
      windKph: 18,
    },
    hourlyFeelsLikeC: hourly,
    hourlyPrecipProb: rain,
  };
}

export const MOCK_CLIMATOLOGY: Climatology = {
  years: 10,
  p10FeelsLikeC: 2.5,
  medianFeelsLikeC: 8,
  stdFeelsLikeC: 3.5,
  wetDayFreq: 0.3,
};
