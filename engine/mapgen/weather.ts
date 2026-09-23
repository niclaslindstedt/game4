// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R19 — THE WEATHER: which sky a map is ridden under, how hard it is
// snowing out of it, how thick the fog lies, how the wind blows — and
// whether the race is ridden in the evening (R15's exception).
//
// THEIR OWN STREAM. Everything here is dealt off a stream seeded from the
// attempt's sub-seed but separate from it (the drifts' pattern, R17), and it
// is dealt LAST, so a map's country, loop, kickers, spawn, forest, drifts and
// day are exactly what they would be without a weather. Only the start hour
// of an evening map moves, and nothing built reads the hour.
//
// Nothing here is a colour. What a sky LOOKS like is art direction and lives
// in the app (`pwa/src/game/sky.ts`); the engine's half is the word and the
// numbers, so the sky, the falling snow, the fog and the wind the spindrift
// rides all read one source.

import { createRng } from "../lib/prng.ts";
import { daylightWindow } from "../lib/solar.ts";
import { LEVEL_RULES, inBand } from "./rules.ts";
import { declinationOf } from "./sun.ts";
import type { Level, SkyOverride, Weather, WeatherKind } from "./types.ts";

const R = LEVEL_RULES.weather;

/** Every sky there is, lightest first. */
export const WEATHER_KINDS: readonly WeatherKind[] = [
  "clear",
  "fair",
  "high",
  "overcast",
  "snow",
  "fog",
];

/** What sets the weather's stream apart from the attempt's own. */
const WEATHER_SALT = 0x3ea7e418;

/** The sky a map without one is ridden under: bare blue, a breath of wind
 * out of the north. */
export const CLEAR_WEATHER: Readonly<Weather> = {
  kind: "clear",
  snowfall: 0,
  fog: 0,
  wind: 2,
  windFrom: 0,
  evening: false,
};

/** The weather a level is ridden under — `CLEAR_WEATHER` for a hand-built
 * level that has none. */
export function weatherOf(level: Pick<Level, "weather">): Weather {
  return level.weather ?? CLEAR_WEATHER;
}

/** Whether this sky has a LID over it — the flat light R19 names. */
export function hasLid(kind: WeatherKind): boolean {
  return kind === "overcast" || kind === "snow";
}

/** The mean wind of a sky at a draw `u` (0..1) of its band, heavier with
 * the fall. */
function windIn(kind: WeatherKind, u: number, snowfall: number): number {
  const band = R.wind[kind];
  const at = kind === "snow" ? 0.3 * u + 0.7 * snowfall : u;
  return band.min + (band.max - band.min) * at;
}

/** A sky chosen by kind, at its typical numbers — the middle of each of its
 * bands, calm enough to read. What a hand-picked sky is given where a field
 * is not named. */
export function weatherFor(kind: WeatherKind, over: Partial<Weather> = {}): Weather {
  const snowfall = kind === "snow" ? (R.snowfall.min + R.snowfall.max) / 2 : 0;
  const fog = kind === "fog" ? (R.fog.min + R.fog.max) / 2 : 0;
  const base: Weather = {
    kind,
    snowfall,
    fog,
    wind: windIn(kind, 0.5, snowfall),
    windFrom: 0,
    evening: false,
  };
  const out = { ...base, ...over, kind };
  // A wind asked for without being named follows the fall it was asked for.
  if (over.wind === undefined && over.snowfall !== undefined) {
    out.wind = windIn(kind, 0.5, out.snowfall);
  }
  return out;
}

/** The hour of sunset on a map's day, solar hours. */
export function sunsetOf(sun: { dayOfYear: number; latitude: number }): number {
  const w = daylightWindow(sun.latitude, 0, declinationOf(sun.dayOfYear));
  return w ? w.max : 12;
}

/** R19 — deal the weather, and the evening start it may bring. `sub` is the
 * attempt's sub-seed; `sun` is the day R15 dealt. */
export function dealWeather(
  sub: number,
  sun: { hour: number; dayOfYear: number; latitude: number },
): { weather: Weather; hour: number } {
  const rng = createRng((sub ^ WEATHER_SALT) >>> 0);
  let roll = rng.next();
  let kind: WeatherKind = "clear";
  for (const k of WEATHER_KINDS) {
    roll -= R.odds[k];
    if (roll < 0) {
      kind = k;
      break;
    }
  }
  const snowfall = kind === "snow" ? inBand(rng, R.snowfall) : 0;
  const fog = kind === "fog" ? inBand(rng, R.fog) : 0;
  const wind = windIn(kind, rng.next(), snowfall);
  const windFrom = rng.range(0, Math.PI * 2);
  const evening = rng.chance(R.evening);
  const late = inBand(rng, LEVEL_RULES.sun.evening);
  const hour = evening ? sunsetOf(sun) + late : sun.hour;
  return { weather: { kind, snowfall, fog, wind, windFrom, evening }, hour };
}

/** The same map under another sky or from another hour: a shallow copy,
 * sharing every grid and query with the level it was made from. An override
 * is the player's (or a lab's) and not the rule's, so `analyzeLevel` may
 * well refuse the hour it names. */
export function withSky<L extends Level>(level: L, sky: SkyOverride): L {
  let weather = weatherOf(level);
  if (typeof sky.weather === "string") weather = weatherFor(sky.weather);
  else if (sky.weather) {
    const kind = sky.weather.kind ?? weather.kind;
    weather =
      kind === weather.kind ? { ...weather, ...sky.weather, kind } : weatherFor(kind, sky.weather);
  }
  const sun = sky.hour === undefined ? level.sun : { ...level.sun, hour: sky.hour };
  return { ...level, sun, weather };
}
