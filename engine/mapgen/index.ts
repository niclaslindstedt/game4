// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD GENERATOR's public surface. `engine/index.ts` re-exports all of
// it; nothing outside `mapgen/` should reach past this file.

export * from "./types.ts";
export { generateLevel, subSeed } from "./generate.ts";
export { LEVEL_RULES, inBand, withinBand, type Band } from "./rules.ts";
export {
  nearestTrackPoint,
  nearestWithin,
  trackPointAt,
  arcAhead,
  arcBetween,
  type HasTrack,
} from "./query.ts";
export { kickerProfile } from "./kickers.ts";
export { dealDrifts, driftAt } from "./drift.ts";
export { declinationOf, sunWindow } from "./sun.ts";
export {
  CLEAR_WEATHER,
  WEATHER_KINDS,
  dealWeather,
  hasLid,
  sunsetOf,
  weatherFor,
  weatherOf,
  withSky,
} from "./weather.ts";
export { gridOnTrack } from "./spawn.ts";
// The scoreboard the search gates on, re-exported here so the one surface
// that carries the generator carries its verdict too.
export {
  analyzeLevel,
  type Finding,
  type LevelAnalysis,
  type Severity,
} from "../analysis/index.ts";
export { minRadius, minSeparation } from "./track.ts";
