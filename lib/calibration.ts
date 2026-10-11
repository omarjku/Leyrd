// Personal calibration: nudges the user's feels-like offset from feedback.

import type { FeedbackRating } from "./types";

export const CALIBRATION_STEP_C = 0.5;
export const CALIBRATION_LIMIT_C = 4;
/** Feedback after very short exposure says little about clothing. */
export const MIN_OUTDOOR_MINUTES_FOR_FEEDBACK = 15;

/**
 * "cold" lowers the offset (so the engine dresses warmer next time), "warm"
 * raises it, "right" leaves it unchanged. Clamped to ±4 and rounded to 0.1.
 */
export function applyFeedback(offset: number, rating: FeedbackRating, outdoorMinutes: number): number {
  if (outdoorMinutes < MIN_OUTDOOR_MINUTES_FOR_FEEDBACK) return offset;
  let next = offset;
  if (rating === "cold") next -= CALIBRATION_STEP_C;
  else if (rating === "warm") next += CALIBRATION_STEP_C;
  next = Math.min(CALIBRATION_LIMIT_C, Math.max(-CALIBRATION_LIMIT_C, next));
  const r = Math.round(next * 10) / 10;
  return r === 0 ? 0 : r;
}
