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
}
