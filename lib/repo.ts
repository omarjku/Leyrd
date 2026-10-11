import "server-only";
import { db } from "./db";
import type {
  Climatology,
  CommuteMode,
  ItemStatus,
  Occasion,
  Profile,
  Slot,
  ThermalType,
  WardrobeItem,
} from "./types";

export interface ProfileRow extends Profile {
  onboarded: boolean;
}

interface DbProfile {
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  leave_time: string;
  return_time: string;
  commute_mode: string;
  outdoor_minutes: number;
  thermal_type: string;
  default_occasion: string;
  calibration_offset_c: number;
  onboarded: boolean;
}

function toProfile(r: DbProfile): ProfileRow {
  return {
    city: r.city,
    lat: r.lat,
    lon: r.lon,
    timezone: r.timezone,
    leaveTime: r.leave_time,
    returnTime: r.return_time,
    commuteMode: r.commute_mode as CommuteMode,
    outdoorMinutes: r.outdoor_minutes,
    thermalType: r.thermal_type as ThermalType,
    defaultOccasion: r.default_occasion as Occasion,
    calibrationOffsetC: r.calibration_offset_c,
    onboarded: r.onboarded,
  };
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await db()<DbProfile[]>`SELECT * FROM profiles WHERE user_id = ${userId}`;
  return rows[0] ? toProfile(rows[0]) : null;
}

export async function upsertProfile(userId: string, p: Omit<Profile, "calibrationOffsetC">, onboarded: boolean) {
  await db()`
    INSERT INTO profiles (user_id, city, lat, lon, timezone, leave_time, return_time, commute_mode,
                          outdoor_minutes, thermal_type, default_occasion, onboarded, updated_at)
    VALUES (${userId}, ${p.city}, ${p.lat}, ${p.lon}, ${p.timezone}, ${p.leaveTime}, ${p.returnTime},
            ${p.commuteMode}, ${p.outdoorMinutes}, ${p.thermalType}, ${p.defaultOccasion}, ${onboarded}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      city = EXCLUDED.city, lat = EXCLUDED.lat, lon = EXCLUDED.lon, timezone = EXCLUDED.timezone,
      leave_time = EXCLUDED.leave_time, return_time = EXCLUDED.return_time,
      commute_mode = EXCLUDED.commute_mode, outdoor_minutes = EXCLUDED.outdoor_minutes,
      thermal_type = EXCLUDED.thermal_type, default_occasion = EXCLUDED.default_occasion,
      onboarded = profiles.onboarded OR EXCLUDED.onboarded, updated_at = now()`;
}

export async function setCalibration(userId: string, offset: number) {
  await db()`UPDATE profiles SET calibration_offset_c = ${offset}, updated_at = now() WHERE user_id = ${userId}`;
}

interface DbItem {
  id: string;
  name: string;
  slot: string;
  kind: string;
  warmth: number;
  waterproof: boolean;
  windproof: boolean;
  occasions: string[];
  status: string;
  status_until: Date | null;
  last_worn: Date | null;
}

function toItem(r: DbItem): WardrobeItem {
  return {
    id: r.id,
    name: r.name,
    slot: r.slot as Slot,
    kind: r.kind,
    warmth: r.warmth,
    waterproof: r.waterproof,
    windproof: r.windproof,
    occasions: r.occasions as Occasion[],
    status: r.status as ItemStatus,
    statusUntil: r.status_until ? r.status_until.toISOString() : null,
    lastWorn: r.last_worn ? r.last_worn.toISOString() : null,
  };
}

export async function listWardrobe(userId: string): Promise<WardrobeItem[]> {
  // Expire stale statuses lazily (e.g. "in the wash" timers that have run out).
  await db()`
    UPDATE wardrobe_items SET status = 'clean', status_until = NULL
    WHERE user_id = ${userId} AND status <> 'clean' AND status_until IS NOT NULL AND status_until <= now()`;
  const rows = await db()<DbItem[]>`
    SELECT id, name, slot, kind, warmth, waterproof, windproof, occasions, status, status_until, last_worn
    FROM wardrobe_items WHERE user_id = ${userId}
    ORDER BY CASE slot WHEN 'base' THEN 0 WHEN 'mid' THEN 1 WHEN 'outer' THEN 2 ELSE 3 END, warmth, name`;
  return rows.map(toItem);
}

export type NewItem = Omit<WardrobeItem, "id" | "status" | "statusUntil" | "lastWorn">;

export const WARDROBE_LIMIT = 300;

/** Adds items atomically; returns false if the wardrobe limit would be exceeded. */
export async function addItems(userId: string, items: NewItem[], opts: { onlyIfEmpty?: boolean } = {}): Promise<boolean> {
  if (items.length === 0) return true;
  const sql = db();
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM wardrobe_items WHERE user_id = ${userId}`;
    if (opts.onlyIfEmpty && n > 0) return true;
    if (n + items.length > WARDROBE_LIMIT) return false;
    for (const i of items) {
      await tx`
        INSERT INTO wardrobe_items (user_id, name, slot, kind, warmth, waterproof, windproof, occasions)
        VALUES (${userId}, ${i.name}, ${i.slot}, ${i.kind}, ${i.warmth}, ${i.waterproof}, ${i.windproof},
                ${i.occasions as string[]})`;
    }
    return true;
  }) as Promise<boolean>;
}

export async function countWardrobe(userId: string): Promise<number> {
  const rows = await db()<{ n: number }[]>`SELECT count(*)::int AS n FROM wardrobe_items WHERE user_id = ${userId}`;
  return rows[0]?.n ?? 0;
}

export interface ItemPatch {
  name?: string;
  warmth?: number;
  waterproof?: boolean;
  windproof?: boolean;
  occasions?: Occasion[];
  status?: ItemStatus;
  statusUntil?: string | null;
  lastWorn?: string | null;
}

export async function updateItem(userId: string, id: string, patch: ItemPatch): Promise<WardrobeItem | null> {
  const sql = db();
  const current = await sql<DbItem[]>`
    SELECT id, name, slot, kind, warmth, waterproof, windproof, occasions, status, status_until, last_worn
    FROM wardrobe_items WHERE id = ${id} AND user_id = ${userId}`;
  if (!current[0]) return null;
  const c = toItem(current[0]);
  const n = { ...c, ...patch };
  const rows = await sql<DbItem[]>`
    UPDATE wardrobe_items SET
      name = ${n.name}, warmth = ${n.warmth}, waterproof = ${n.waterproof}, windproof = ${n.windproof},
      occasions = ${n.occasions as string[]}, status = ${n.status},
      status_until = ${n.statusUntil}, last_worn = ${n.lastWorn}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, name, slot, kind, warmth, waterproof, windproof, occasions, status, status_until, last_worn`;
  return rows[0] ? toItem(rows[0]) : null;
}

export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const r = await db()`DELETE FROM wardrobe_items WHERE id = ${id} AND user_id = ${userId}`;
  return r.count > 0;
}

export async function markWorn(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db()`UPDATE wardrobe_items SET last_worn = now() WHERE user_id = ${userId} AND id = ANY(${ids}::uuid[])`;
}

export async function recordFeedback(
  userId: string,
  day: string,
  rating: string,
  offsetBefore: number,
  offsetAfter: number,
  adjustedTempC: number | null,
  outfit: unknown,
) {
  await db()`
    INSERT INTO feedback (user_id, day, rating, offset_before, offset_after, adjusted_temp_c, outfit)
    VALUES (${userId}, ${day}, ${rating}, ${offsetBefore}, ${offsetAfter}, ${adjustedTempC}, ${db().json(outfit as never)})
    ON CONFLICT (user_id, day) DO UPDATE SET rating = EXCLUDED.rating, offset_after = EXCLUDED.offset_after,
      adjusted_temp_c = EXCLUDED.adjusted_temp_c, outfit = EXCLUDED.outfit, created_at = now()`;
}

export async function getFeedbackForDay(userId: string, day: string) {
  const rows = await db()<{ rating: string; offset_before: number; offset_after: number }[]>`
    SELECT rating, offset_before, offset_after FROM feedback WHERE user_id = ${userId} AND day = ${day}`;
  return rows[0] ?? null;
}

export async function recentFeedback(userId: string, limit = 14) {
  return db()<{ day: Date; rating: string; adjusted_temp_c: number | null; offset_after: number }[]>`
    SELECT day, rating, adjusted_temp_c, offset_after FROM feedback WHERE user_id = ${userId}
    ORDER BY day DESC LIMIT ${limit}`;
}

export async function getCachedClimatology(key: string): Promise<Climatology | null> {
  const rows = await db()<{ data: Climatology }[]>`
    SELECT data FROM climatology_cache WHERE key = ${key} AND fetched_at > now() - interval '30 days'`;
  return rows[0]?.data ?? null;
}

export async function putCachedClimatology(key: string, data: Climatology) {
  await db()`
    INSERT INTO climatology_cache (key, data) VALUES (${key}, ${db().json(data as never)})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`;
}

export async function deleteUser(userId: string) {
  await db()`DELETE FROM users WHERE id = ${userId}`;
}

export async function getUser(userId: string) {
  const rows = await db()<{ id: string; email: string; name: string | null }[]>`
    SELECT id, email, name FROM users WHERE id = ${userId}`;
  return rows[0] ?? null;
}
