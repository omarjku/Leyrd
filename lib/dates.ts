/** YYYY-MM-DD for `date` in the given IANA timezone. */
export function localDate(timezone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** "HH:MM" local time now in timezone. */
export function localTime(timezone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Which day to plan for: today until the user is home, then tomorrow. */
export function planningDate(timezone: string, returnTime: string, now: Date = new Date()): string {
  const today = localDate(timezone, now);
  return localTime(timezone, now) >= returnTime ? addDays(today, 1) : today;
}
