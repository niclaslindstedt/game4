// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN'S CLOCK. The engine has one clock, `state.t`, and nothing in the
// simulation looks at the sun. But the hour a run has REACHED is a fact about
// the run, and it is stated here so everything that reads the sun off it —
// the sky, the snow's glitter, the shadows — reads the same hour.
//
// TEN MINUTES OF RIDING IS ONE HOUR OF SUN. A race is a handful of minutes:
// at ten to one the shadows visibly swing over a race without a run started
// at three in the afternoon riding into the dark. The dark is the EVENING
// R18 deals a quarter of the maps (R15's exception) — a start hour after
// sunset, and the moon then the only light in the sky.

import { moonAt, sunAt, type MoonPlace, type SunPlace } from "../lib/solar.ts";
import { declinationOf, type Level } from "../mapgen/index.ts";

/** Seconds of riding per hour of sun. */
export const SUN_SECONDS_PER_HOUR = 600;

/** The hour on the sun's clock at run time `t`, 0..24. */
export function sunHourAt(level: Pick<Level, "sun">, t: number): number {
  const h = (level.sun.hour + t / SUN_SECONDS_PER_HOUR) % 24;
  return h < 0 ? h + 24 : h;
}

/** Where the sun stands at run time `t`. */
export function sunAtRun(level: Pick<Level, "sun">, t: number): SunPlace {
  return sunAt(sunHourAt(level, t), level.sun.latitude, declinationOf(level.sun.dayOfYear));
}

/** The moon's age on a map's day, days past new. The year is a fixed,
 * nominal one — the moon was new on the 19th of January of it — so a day of
 * the year is always the same phase and R15's two months of days carry two
 * whole lunations, a full moon and a dark night each. */
export function moonAgeOn(dayOfYear: number): number {
  return (dayOfYear - 19 + 30 * 29.530589) % 29.530589;
}

/** Where the moon stands at run time `t`, and how much of it is lit. */
export function moonAtRun(level: Pick<Level, "sun">, t: number): MoonPlace {
  const d = level.sun.dayOfYear;
  return moonAt(sunHourAt(level, t), level.sun.latitude, declinationOf(d), moonAgeOn(d));
}
