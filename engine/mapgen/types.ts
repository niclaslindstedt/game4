// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shape of a generated map — the contract between the generator and
// everything that rides, draws or measures one. Extend it; never rename a
// field without moving every reader with it.
import type { Heightfield } from "../lib/heightfield.ts";
import type { RegionId, TreeKind } from "./regions.ts";
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
  /** What grows here (R21) — a spruce when left out. Drawn only: a trunk
   * is a trunk to the sled. */
  kind?: TreeKind;
  /** The CLUMP it grew in (R14), numbered from 0 — trunks of one clump may
   * stand closer than `forest.gap`; left out for a tree standing alone. */
  clump?: number;
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
  /** Every cliff cut into the country (R22) — none on a generator version
   * without them. */
  cliffs?: Cliff[];
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
  /** The kind of snow country the map was built in (R21) — ask `regionOf`,
   * which reads a hand-built map without one as the boreal. */
  region?: RegionId;
  /** THE REGION'S OWN SNOW (R21), on the ground's grid: the wind crust's
   * share of the country, 0..1, before it is folded into `packed` — what
   * the picture draws a crust with. Absent where the region lays none. */
  crust?: Heightfield;
  /** The frozen river's ice, 0..1, on the ground's grid (R21), and its
   * sample; absent where the region has no river. The physics reads
   * `iceAt` for the grip a sled has left on it. */
  ice?: Heightfield;
  iceAt?(x: number, z: number): number;
}

/** The skies R19 deals, lightest first. Three of them SNOW — a few flakes
 * out of a sunny sky (`flurries`), a steady fall under a grey lid (`snow`)
 * and a blizzard under black cloud (`storm`). */
export type WeatherKind =
  "clear" | "fair" | "flurries" | "high" | "overcast" | "snow" | "storm" | "fog";

/** The skies that SNOW, each dealt a fall in its own band (R19). */
export type SnowingKind = Extract<WeatherKind, "flurries" | "snow" | "storm">;

/** The weather a map is ridden under (R19): the word and its numbers. What a
 * sky LOOKS like is the app's; the engine says only what is in the air. */
export interface Weather {
  kind: WeatherKind;
  /** How hard it is snowing on the whole, 0 (nothing falling) … 1 (a
   * blizzard) — the mean the squalls breathe about (`snowAt`). */
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
    Pick<
      Level,
      | "packed"
      | "kickers"
      | "cliffs"
      | "basin"
      | "attempt"
      | "drifts"
      | "weather"
      | "version"
      | "region"
    >
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
  /** One of the TRICK FIELD's (R20, `T1…`), laid on the track only on a
   * map built for a tricks run. */
  trick?: boolean;
}

/** A cliff a sled is ridden off into the lower ground below (R22). `x, z`
 * is the middle of its EDGE, the top of the face. */
export interface Cliff {
  /** `C1…`, in the order they were laid. */
  id: string;
  x: number;
  z: number;
  /** Ground height at the top of the edge, m. */
  y: number;
  /** The direction a rider goes over the edge in — down the country's fall
   * (heading convention). */
  heading: number;
  /** The face's height, m. */
  drop: number;
  /** The face's run, edge to foot, m. */
  face: number;
  /** The landing apron below the face: its height over the country at the
   * face's foot, and its run from there to where it meets the country, m. */
  apron: number;
  landing: number;
  /** The shelf behind the edge, foot to edge, m. */
  shelf: number;
  /** Full-height length of the edge across, m. */
  width: number;
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
  /** Lay the TRICK FIELD on the loop (R20) — a map for a tricks run. Left
   * out, the map carries none and is exactly the seed's race map. */
  tricks?: boolean;
  /** The kind of snow country to build in (R21, `regions.ts`); the boreal
   * when left out, which is the map the seed has always built. */
  region?: RegionId;
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
