import { z } from "zod";
import { OCCASIONS } from "./types";

export const occasionSchema = z.enum(OCCASIONS as [string, ...string[]]).transform((v) => v as (typeof OCCASIONS)[number]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");

export const profileSchema = z
  .object({
    city: z.string().trim().min(1).max(80),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    timezone: z.string().min(1).max(64).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "unknown timezone"),
    leaveTime: hhmm,
    returnTime: hhmm,
    commuteMode: z.enum(["walk", "bike", "transit", "car"]),
    outdoorMinutes: z.number().int().min(0).max(24 * 60),
    thermalType: z.enum(["runs_cold", "neutral", "runs_hot"]),
    defaultOccasion: occasionSchema,
  })
  .strict();

export const newItemSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    slot: z.enum(["base", "mid", "outer", "accessory"]),
    kind: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/),
    warmth: z.number().min(0).max(3),
    waterproof: z.boolean(),
    windproof: z.boolean(),
    occasions: z.array(occasionSchema).max(5),
  })
  .strict();

export const itemPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    warmth: z.number().min(0).max(3).optional(),
    waterproof: z.boolean().optional(),
    windproof: z.boolean().optional(),
    occasions: z.array(occasionSchema).max(5).optional(),
    status: z.enum(["clean", "in_wash", "drying", "unavailable"]).optional(),
    /** Hours until the status resets to clean. Ignored for status "clean". */
    statusHours: z.number().min(0).max(24 * 30).optional(),
    worn: z.boolean().optional(),
  })
  .strict();

export const uuidSchema = z.string().uuid();
