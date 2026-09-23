// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15 — THE DAY THE RACE IS RIDDEN ON: a latitude, a winter's day and a
// solar hour at which the sun is well up in a clear sky.
//
// The sun's arithmetic is the generic pool's (`lib/solar.ts`); what is this
// game's is only which day and which hours count. The declination is the
// textbook cosine of the day of the year, so a February map at 62°N is
// dealt the low, long-shadowed sun it would really have — and a draw whose
// latitude and day leave no hour of the band with the sun over the floor is
// simply drawn again.

import { daylightWindow } from "../lib/solar.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";

/** The sun's declination on a day of the year, degrees. */
export function declinationOf(dayOfYear: number): number {
  return -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
}

/** The hours of the rule's band in which the sun stands over its floor on
 * that day at that latitude, or null when there are none. */
export function sunWindow(latitude: number, dayOfYear: number): { min: number; max: number } | null {
  const w = daylightWindow(latitude, (R.sun.minElevation * Math.PI) / 180, declinationOf(dayOfYear));
  if (!w) return null;
  const min = Math.max(w.min, R.sun.hour.min);
  const max = Math.min(w.max, R.sun.hour.max);
  return max > min ? { min, max } : null;
}

/** R15 — deal the day. */
export function dealSun(rng: Rng): { hour: number; dayOfYear: number; latitude: number } {
  for (let i = 0; i < 64; i++) {
    const latitude = inBand(rng, R.sun.latitude);
    const dayOfYear = Math.round(inBand(rng, R.sun.dayOfYear));
    const w = sunWindow(latitude, dayOfYear);
    if (!w) continue;
    return { latitude, dayOfYear, hour: rng.range(w.min, w.max) };
  }
  // The band's own southern edge in its latest week always has a noon.
  return { latitude: R.sun.latitude.min, dayOfYear: R.sun.dayOfYear.max, hour: 12 };
}
