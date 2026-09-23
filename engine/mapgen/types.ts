// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shape of a generated map — the contract between the generator and
// everything that rides, draws or measures one. Extend it; never rename a
// field without moving every reader with it.
import type { Heightfield } from "../lib/heightfield.ts";

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
  /** The grid's anchor: a seeded spot in powder near the track. */
  spawn: Spawn;
  /** One slot per rider, the player's first. */
  grid: Spawn[];
  trees: TreeDef[];
  sun: { hour: number; dayOfYear: number; latitude: number };
  laps: number;

  // ── Beyond the contract: what the generator also publishes ──────────
  /** The packed-snow field `packedAt` samples (R10), on the ground's grid. */
  packed: Heightfield;
  /** Every crest shaped to throw a sled, on the track and off it (R4, R9). */
  kickers: Kicker[];
  /** The basin's middle, and how far out its rim starts (R2). */
  basin: { x: number; z: number; rim: number };
  /** Which sub-seed attempt the search accepted (0 = the first). */
  attempt: number;
}

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
