// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shape of a generated map — the contract between the generator and
// everything that rides, draws or measures one. Extend it; never rename a
// field without moving every reader with it.
import type { Heightfield } from "../lib/heightfield.ts";
import type { GeneratorVersion } from "./versions.ts";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A snow-loaded conifer. The trunk is what the sled meets; the crown is drawn. */
export interface TreeDef {
  x: number;
  z: number;
  /** Ground height at the trunk, m. */
  y: number;
  height: number;
  /** Trunk collision radius, m. */
  radius: number;
  /** Crown radius at its widest, m. */
  crown: number;
}

/** A gate across the track. Index 0 of `Level.checkpoints` is the start/finish line. */
export interface Checkpoint {
  x: number;
  z: number;
  y: number;
  heading: number;
  width: number;
  /** Arc length along the track, m. */
  s: number;
}

export interface TrackPoint {
  x: number;
  z: number;
  y: number;
  /** Arc length from the loop's first point, m. */
  s: number;
  heading: number;
  width: number;
}

export interface Spawn {
  x: number;
  z: number;
  heading: number;
}

export interface Level {
  seed: number;
  /** The world is [0, size] × [0, size] metres. */
  size: number;
  /** Heightfield cell size, m. */
  cell: number;
  /** Terrain height, the track's grading included. */
  ground: Heightfield;
  groundAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: Vec3): void;
  /** 0 = virgin powder … 1 = fully packed track. */
  packedAt(x: number, z: number): number;
  track: { points: TrackPoint[]; length: number; closed: true };
  checkpoints: Checkpoint[];
  /** The grid's anchor: the front row's point on the centreline, behind the
   * start line, facing along the loop (R13). */
  spawn: Spawn;
  /** One slot per rider, the player's first. */
  grid: Spawn[];
  trees: TreeDef[];
  sun: { hour: number; dayOfYear: number; latitude: number };
  laps: number;

  // ── Beyond the contract: what the generator also publishes ──────────
  // Optional in the TYPE so a hand-built level (a test's synthetic one)
  // need not invent them; `generateLevel` always sets every one.
  /** The packed-snow field `packedAt` samples (R10), on the ground's grid. */
  packed?: Heightfield;
  /** Every crest shaped to throw a sled, on the track and off it (R4, R9). */
  kickers?: Kicker[];
  /** The basin's middle, and how far out its rim starts (R2). */
  basin?: { x: number; z: number; rim: number };
  /** Which sub-seed attempt the search accepted (0 = the first). */
  attempt?: number;
  /** Every stretch of the loop lying under a drift (R17), in the order they
   * are ridden. */
  drifts?: Drift[];
  /** The sky the map is ridden under (R19). A hand-built level without one
   * is ridden under `CLEAR_WEATHER` — ask `weatherOf`, never this field. */
  weather?: Weather;
  /** WHICH GENERATOR built the map (`versions.ts`): the current rules unless
   * a campaign map pinned an older row. */
  version?: GeneratorVersion;
}

/** The skies R19 deals, lightest first. */
export type WeatherKind = "clear" | "fair" | "high" | "overcast" | "snow" | "fog";

/** The weather a map is ridden under (R19): the word and its numbers. What a
 * sky LOOKS like is the app's; the engine says only what is in the air. */
export interface Weather {
  kind: WeatherKind;
  /** How hard it is snowing, 0 (nothing falling) … 1 (a blizzard). */
  snowfall: number;
  /** How thick the fog lying in the basin is, 0 (none) … 1. */
  fog: number;
  /** The mean wind at 10 m, m/s. */
  wind: number;
  /** The world heading the wind blows FROM (heading convention). */
  windFrom: number;
  /** Whether R19 sent this map out in the evening (R15's exception). */
  evening: boolean;
}

/** A sky chosen by hand rather than dealt: FREE's start card, a lab's sheet.
 * A kind alone takes that sky at its typical numbers (`weatherFor`); an
 * `hour` is the solar hour the race starts at, whatever R15 dealt. */
export interface SkyOverride {
  weather?: WeatherKind | Partial<Weather>;
  hour?: number;
}

/** A stretch of the loop the wind has drifted over (R17): its full-depth
 * core from arc `from` to arc `to`, m, never wrapping the start line. The
 * packed field eases back to groomed over `drift.fade` metres past each end. */
export interface Drift {
  from: number;
  to: number;
}

/** A level as `generateLevel` hands it out: every optional field set. */
export type GeneratedLevel = Level &
  Required<
    Pick<Level, "packed" | "kickers" | "basin" | "attempt" | "drifts" | "weather" | "version">
  >;

/** A crest shaped to kick a sled into the air (R4, R9). `x, z` is the LIP. */
export interface Kicker {
  /** `K1…` on the track in the order they are ridden, `X1…` off it. */
  id: string;
  x: number;
  z: number;
  /** Ground height at the lip, m. */
  y: number;
  /** The direction a rider crosses the lip in (heading convention). */
  heading: number;
  /** Lip over the ground the kicker was shaped on, m. */
  height: number;
  /** Ramp length, foot to lip, m. */
  ramp: number;
  /** Landing length, lip to foot, m. */
  landing: number;
  /** Full-height width across the kicker, m. */
  width: number;
  onTrack: boolean;
  /** Arc length of the lip along the track (on-track kickers only), m. */
  s?: number;
}

/** What a caller may ask of the generator beyond the seed. */
export interface GenerateOptions {
  /** How many sub-seeds the search may try before it gives up (default 16). */
  attempts?: number;
  /** Laps a race on this map is ridden over (default R16's). */
  laps?: number;
  /** Ride the map under this sky and from this hour instead of the ones
   * R15 and R19 dealt (`withSky`). Applied AFTER the search accepts the
   * map, so it moves nothing the map builds. */
  sky?: SkyOverride;
  /** The generator version to build by (`versions.ts`) — a campaign map's
   * pinned row; the current rules when left out or unknown. */
  version?: GeneratorVersion;
}

/** The answer to "where on the track is this point nearest?" */
export interface TrackHit {
  /** Index of the track point starting the nearest segment. */
  index: number;
  /** Arc length of the nearest point on the centreline, m. */
  s: number;
  /** Plan distance to the centreline, m. */
  distance: number;
  /** Signed plan offset: positive to the RIGHT of the direction of travel, m. */
  lateral: number;
  /** The nearest point on the centreline. */
  x: number;
  z: number;
}
