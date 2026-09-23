// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R2, R3 — THE COUNTRY BEFORE ANYBODY RIDES IT: a basin ringed by mountain
// flanks, and rolling hills, ridges, a tilt and a few bowls on its floor.
//
// Everything here is a pure function of a PLAN (numbers drawn off the
// attempt's stream once) and a plan point, so the search can ask "how high
// is the untouched ground here?" of the same arithmetic the bake writes into
// the grid. The bake runs ONCE per attempt; the track's grading (track.ts)
// and the kickers (kickers.ts) are then stamped into the grid it made, and
// nothing downstream ever evaluates the noise again.
//
// The rim is measured on a ROUNDED SQUARE rather than a circle
// (`basin.rim.squareness`), so the corners of the map are mountain rather
// than a circle's leftover wedges, and the foot of the range wanders in and
// out by `basin.rim.warp` of slow noise so it does not read as drawn with a
// compass.

import { createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";

/** A bowl: a round hollow in the basin floor (R3). */
export type Bowl = { readonly x: number; readonly z: number; readonly r: number; readonly depth: number };

/** Everything the country is drawn from, dealt once per attempt. */
export type TerrainPlan = {
  /** The basin's middle, m. */
  readonly cx: number;
  readonly cz: number;
  readonly mountain: number;
  readonly hills: number;
  readonly ridges: number;
  /** The tilt's gradient, m per m along x and z. */
  readonly tiltX: number;
  readonly tiltZ: number;
  readonly bowls: readonly Bowl[];
  /** Noise seeds, one per layer so the layers do not echo each other. */
  readonly seeds: {
    readonly warp: number;
    readonly rim: number;
    readonly hills: number;
    readonly ridges: number;
    readonly crests: number;
  };
};

/** Deal the country's plan off the attempt's stream. */
export function planTerrain(rng: Rng): TerrainPlan {
  const size = R.world.size;
  const seed = (): number => rng.int(1, 0x7ffffff0);
  const tiltHeading = rng.range(0, Math.PI * 2);
  const tilt = rng.range(0.4, 1) * R.tilt.grade;
  const cx = size / 2;
  const cz = size / 2;
  const bowls: Bowl[] = [];
  const count = rng.int(R.bowls.count.min, R.bowls.count.max);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(80, R.basin.rim.inner - 120);
    bowls.push({
      x: cx + Math.sin(a) * d,
      z: cz + Math.cos(a) * d,
      r: inBand(rng, R.bowls.radius),
      depth: inBand(rng, R.bowls.depth),
    });
  }
  return {
    cx,
    cz,
    mountain: inBand(rng, R.basin.mountain),
    hills: inBand(rng, R.hills.amplitude),
    ridges: inBand(rng, R.ridges.amplitude),
    tiltX: Math.sin(tiltHeading) * tilt,
    tiltZ: Math.cos(tiltHeading) * tilt,
    bowls,
    seeds: { warp: seed(), rim: seed(), hills: seed(), ridges: seed(), crests: seed() },
  };
}

/** Fractal value noise centred on zero, roughly −1..1. */
function fbm(x: number, z: number, scale: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    sum += (valueNoise(x, z, s, seed + o * 7919) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  return sum / norm;
}

/** Ridged noise, 0..1 with sharp crests at 1. */
function ridged(x: number, z: number, scale: number, seed: number): number {
  const a = 1 - Math.abs(valueNoise(x, z, scale, seed) * 2 - 1);
  const b = 1 - Math.abs(valueNoise(x, z, scale * 0.5, seed + 31) * 2 - 1);
  return (a * a * 0.7 + b * b * 0.3) ** 1.2;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Distance from the basin's middle on the rounded square the rim is
 * measured on, before the warp. */
function squareRadius(plan: TerrainPlan, x: number, z: number): number {
  const p = R.basin.rim.squareness;
  const dx = Math.abs(x - plan.cx);
  const dz = Math.abs(z - plan.cz);
  return (dx ** p + dz ** p) ** (1 / p);
}

/** R2 — how far up the rim a point stands: 0 on the basin floor, 1 at the
 * full height of the flanks. */
export function rimAt(plan: TerrainPlan, x: number, z: number): number {
  const warp = (valueNoise(x, z, 260, plan.seeds.rim) * 2 - 1) * R.basin.rim.warp;
  return smoothstep(R.basin.rim.inner, R.basin.rim.outer, squareRadius(plan, x, z) + warp);
}

/** R2, R3 — the untouched country's height at a plan point, m. */
export function countryAt(plan: TerrainPlan, x: number, z: number): number {
  const s = plan.seeds;
  // A slow domain warp, so the hills are not laid out on the noise's own
  // lattice.
  const wx = x + (valueNoise(x, z, 420, s.warp) * 2 - 1) * 70;
  const wz = z + (valueNoise(x, z, 420, s.warp + 17) * 2 - 1) * 70;
  const rim = rimAt(plan, x, z);
  const floor = 1 - rim * 0.6;
  let h = fbm(wx, wz, R.hills.scale, 4, s.hills) * plan.hills * floor;
  h += ridged(wx, wz, R.ridges.scale, s.ridges) * plan.ridges * floor;
  h += (x - plan.cx) * plan.tiltX + (z - plan.cz) * plan.tiltZ;
  for (const b of plan.bowls) {
    const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r);
    if (d2 < 1) h -= b.depth * (1 - d2) * (1 - d2);
  }
  if (rim > 0) {
    h += plan.mountain * rim ** 1.6;
    h += R.basin.crests * rim * ridged(wx, wz, 150, s.crests);
  }
  return h;
}

/** Bake the untouched country onto the map's grid (R1). */
export function bakeCountry(plan: TerrainPlan): Heightfield {
  const cell = R.world.cell;
  const n = Math.round(R.world.size / cell) + 1;
  const field = createHeightfield(0, 0, cell, n, n);
  const d = field.data;
  for (let r = 0; r < n; r++) {
    const z = r * cell;
    for (let c = 0; c < n; c++) d[r * n + c] = countryAt(plan, c * cell, z);
  }
  return field;
}
