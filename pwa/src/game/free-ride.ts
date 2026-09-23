// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE AS THE APP ASKS FOR ONE — what the start card writes
// (`Settings.ride`), how a stored blob of it is read back, what the rows'
// figures read as, and the one place those answers become the options a
// run is stood up with (`freeGameOptions`). DOM-free, so the suite reads all
// of it (`tests/free_ride_card_test.ts`).
//
// EVERY ROW DEFERS TO THE MAP UNTIL IT IS MOVED. A generated map is a whole
// day — its date, its hour — and a card that arrived with an opinion about
// either would quietly take that away from every rider who never touched
// it. So the day's two rows store NULL until they are moved, and null is the
// seed's own answer; the start card's faders stand on the dealt figure until
// then, which is the same promise with nothing on the row to explain.
//
// THE SPOT BELONGS TO ITS SEED. A place picked on one map's chart is a
// meaningless coordinate on the next, so it is kept with the seed it was
// picked on and read only while that is still the seed on the card.

import {
  DEFAULT_REGION,
  SNOW_DIAL,
  WEATHER_KINDS,
  clampSnowDepth,
  isRegionId,
  type RegionId,
  type WeatherKind,
  type Assist,
  type CreateGameOptions,
  type SledSpec,
} from "@engine";

import { STRINGS } from "./strings.ts";

/** THE DATE ROW'S TRAVEL, as a count of days off the first of January: from
 * the first of December (−30) to the middle of April (105) — the whole
 * season a basin like this one holds snow, where R15 deals only mid-January
 * to mid-March. A count rather than a day of the year so the travel runs
 * through New Year without a seam; the engine folds it (`dayOfYearOf`). */
export const FREE_DAYS = { min: -30, max: 105, step: 1 } as const;

/** One press of the TIME row's arrow, h — a quarter of an hour. */
export const HOUR_STEP = 0.25;

/** What the start card writes. */
export type FreeRide = {
  /** The map; null is the one the front door is standing over. */
  seed: number | null;
  /** The date as a count of days off Jan 1 ({@link FREE_DAYS}); null is the
   * map's own. */
  day: number | null;
  /** The solar hour the ride starts at; null is the map's own. */
  hour: number | null;
  /** The snow dial (`SNOW_DIAL`). */
  depth: number;
  /** Where on the chart the ride starts, on the seed it was picked on; null
   * is the grid. */
  spot: { seed: number; x: number; z: number } | null;
  /** The sky to ride under (R19's kinds, at their typical numbers —
   * `weatherFor`); null is the one the map was dealt. */
  weather: WeatherKind | null;
  /** The kind of snow country the map is built in (R21). */
  region: RegionId;
};

export function freshRide(): FreeRide {
  return {
    seed: null,
    day: null,
    hour: null,
    depth: 1,
    spot: null,
    weather: null,
    region: DEFAULT_REGION,
  };
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A stored blob — anything at all — made into a ride this build offers,
 * every field checked on its own. */
export function mergeRide(blob: unknown): FreeRide {
  const out = freshRide();
  if (!blob || typeof blob !== "object") return out;
  const b = blob as Record<string, unknown>;
  if (isNumber(b.seed) && Number.isInteger(b.seed) && b.seed >= 1 && b.seed <= 0xffffffff) {
    out.seed = b.seed;
  }
  if (isNumber(b.day)) {
    out.day = Math.round(Math.min(FREE_DAYS.max, Math.max(FREE_DAYS.min, b.day)));
  }
  if (isNumber(b.hour)) out.hour = Math.min(24, Math.max(0, b.hour));
  if (isNumber(b.depth)) {
    const d = clampSnowDepth(b.depth);
    out.depth = Math.round(d / SNOW_DIAL.step) * SNOW_DIAL.step;
  }
  if (typeof b.weather === "string" && WEATHER_KINDS.includes(b.weather as WeatherKind)) {
    out.weather = b.weather as WeatherKind;
  }
  if (isRegionId(b.region)) out.region = b.region;
  const spot = b.spot as Record<string, unknown> | null | undefined;
  if (
    spot &&
    typeof spot === "object" &&
    isNumber(spot.seed) &&
    isNumber(spot.x) &&
    isNumber(spot.z)
  ) {
    out.spot = { seed: spot.seed, x: spot.x, z: spot.z };
  }
  return out;
}

/** The spot to start at on `seed`, or null for the grid. */
export function spotOn(ride: FreeRide, seed: number): { x: number; z: number } | null {
  return ride.spot !== null && ride.spot.seed === seed ? { x: ride.spot.x, z: ride.spot.z } : null;
}

/** THE RUN A FREE RIDE IS STOOD UP AS, on `seed`, for the rider on `spec`
 * with `assist` — everything but the map itself, which the caller either
 * hands over already built or leaves to the seed. */
export function freeGameOptions(
  ride: FreeRide,
  seed: number,
  spec: SledSpec,
  assist: Assist,
): CreateGameOptions {
  return {
    seed,
    spec,
    assist,
    mode: "free",
    region: ride.region,
    snowDepth: ride.depth,
    // ONE PATH FOR THE HOUR: the TIME row's hour goes through `day`
    // (`withDay`, held to that date's daylight); the WEATHER row names only
    // the sky, never an hour, so the two cannot disagree.
    day: { hour: ride.hour, dayOfYear: ride.day },
    sky: ride.weather === null ? undefined : { weather: ride.weather },
    spawn: spotOn(ride, seed) ?? undefined,
  };
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A count of days off Jan 1 as the date a rider reads, `12 FEB` — the
 * calendar of a year with no leap day in it, which is the engine's. */
export function dateLabel(day: number): string {
  let d = Math.round(day - 1) % 365;
  if (d < 0) d += 365;
  let m = 0;
  while (d >= MONTH_DAYS[m]) {
    d -= MONTH_DAYS[m];
    m += 1;
  }
  return STRINGS.date(d + 1, m);
}

/** A day of the year (1..365) as a count on the date row's travel: a
 * December day reads as the days before New Year. */
export function dayOnTravel(dayOfYear: number): number {
  return dayOfYear > FREE_DAYS.max ? dayOfYear - 365 : dayOfYear;
}

/** A solar hour as the clock a rider reads, `10:45`. */
export function hourLabel(hour: number): string {
  const minutes = Math.round((((hour % 24) + 24) % 24) * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
