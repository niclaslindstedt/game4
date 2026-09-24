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

import { smoothstep } from "../lib/math.ts";
import { createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { noiseField, sampleNoise, valueNoise, type NoiseField } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { REGIONS, scaleBand, scaleCount, type Region } from "./regions.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";

/** A bowl: a round hollow in the basin floor (R3). */
export type Bowl = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly depth: number;
};

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
  /** The flanks' ridged crests at full height, m (R2, scaled by R21). */
  readonly crests: number;
  /** The rollers' crest over trough, m (R3) — 0 on a generator version
   * without them (`JumpTraits.rollers`). */
  readonly rollers: number;
  /** The region the country is built in (R21), which everything downstream
   * of the plan reads its own multipliers off. */
  readonly region: Region;
  /** Noise seeds, one per layer so the layers do not echo each other. */
  readonly seeds: {
    readonly warp: number;
    readonly rim: number;
    readonly hills: number;
    readonly ridges: number;
    readonly crests: number;
    readonly rollers: number;
  };
};

/** Deal the country's plan off the attempt's stream, in `region` (R21).
 * Every band is the rule's scaled by the region's row — the same band, and
 * so the same draws, in the boreal. The rollers (R3) draw nothing: their
 * height is the rule's scaled by the region's hills, their seed hashed off
 * the hills', so a version without them deals the stream it always dealt. */
export function planTerrain(
  rng: Rng,
  region: Region = REGIONS.boreal,
  rollers = true,
): TerrainPlan {
  const size = R.world.size;
  const K = region.relief;
  const seed = (): number => rng.int(1, 0x7ffffff0);
  const tiltHeading = rng.range(0, Math.PI * 2);
  const tilt = rng.range(0.4, 1) * R.tilt.grade * K.tilt;
  const cx = size / 2;
  const cz = size / 2;
  const bowls: Bowl[] = [];
  const nBowls = scaleCount(R.bowls.count, K.bowls.count);
  const count = rng.int(nBowls.min, nBowls.max);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(80, R.basin.rim.inner - 120);
    bowls.push({
      x: cx + Math.sin(a) * d,
      z: cz + Math.cos(a) * d,
      r: inBand(rng, scaleBand(R.bowls.radius, K.bowls.radius)),
      depth: inBand(rng, scaleBand(R.bowls.depth, K.bowls.depth)),
    });
  }
  // In this order: the stream a map was always dealt.
  const mountain = inBand(rng, scaleBand(R.basin.mountain, K.mountain));
  const hills = inBand(rng, scaleBand(R.hills.amplitude, K.hills));
  const ridges = inBand(rng, scaleBand(R.ridges.amplitude, K.ridges));
  const s = { warp: seed(), rim: seed(), hills: seed(), ridges: seed(), crests: seed() };
  return {
    cx,
    cz,
    mountain,
    hills,
    ridges,
    tiltX: Math.sin(tiltHeading) * tilt,
    tiltZ: Math.cos(tiltHeading) * tilt,
    bowls,
    crests: R.basin.crests * K.crests,
    rollers: rollers ? R.rollers.amplitude * K.hills : 0,
    region,
    seeds: { ...s, rollers: (s.hills ^ 0x5bd1e995) & 0x7ffffff0 },
  };
}

/** Fractal value noise centred on zero, roughly −1..1: the octaves are
 * `fbmFields`' fields, halving in scale and in weight. */
function fbm(fields: readonly NoiseField[], x: number, z: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (const f of fields) {
    sum += (sampleNoise(f, x, z) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function fbmFields(scale: number, octaves: number, seed: number): NoiseField[] {
  const fields: NoiseField[] = [];
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    fields.push(noiseField(s, seed + o * 7919));
    s *= 0.5;
  }
  return fields;
}

/** Ridged noise, 0..1 with sharp crests at 1, off a `ridgedFields` pair. */
function ridged(f: RidgedFields, x: number, z: number): number {
  const a = 1 - Math.abs(sampleNoise(f.coarse, x, z) * 2 - 1);
  const b = 1 - Math.abs(sampleNoise(f.fine, x, z) * 2 - 1);
  const v = a * a * 0.7 + b * b * 0.3;
  // v^1.25, sharpening the crests, without a pow.
  return v * Math.sqrt(Math.sqrt(v));
}

type RidgedFields = { readonly coarse: NoiseField; readonly fine: NoiseField };

function ridgedFields(scale: number, seed: number): RidgedFields {
  return { coarse: noiseField(scale, seed), fine: noiseField(scale * 0.5, seed + 31) };
}

/** Every noise field the country is read off, for one plan. Each keeps the
 * lattice square it last read (`NoiseField`), and a bake reads its grid in
 * order, so nearly every read reuses its field's four corner hashes. */
type CountryFields = {
  readonly warpX: NoiseField;
  readonly warpZ: NoiseField;
  readonly rim: NoiseField;
  readonly hills: readonly NoiseField[];
  readonly ridges: RidgedFields;
  readonly rollers: RidgedFields;
  readonly crests: RidgedFields;
  readonly crestsFine: RidgedFields;
};

function countryFields(plan: TerrainPlan): CountryFields {
  const s = plan.seeds;
  return {
    warpX: noiseField(420, s.warp),
    warpZ: noiseField(420, s.warp + 17),
    rim: noiseField(260, s.rim),
    hills: fbmFields(R.hills.scale, 4, s.hills),
    ridges: ridgedFields(R.ridges.scale, s.ridges),
    rollers: ridgedFields(R.rollers.scale, s.rollers),
    crests: ridgedFields(170, s.crests),
    crestsFine: ridgedFields(60, s.crests + 5),
  };
}

/** Distance from the basin's middle on the rounded square the rim is
 * measured on, before the warp. */
function squareRadius(plan: TerrainPlan, x: number, z: number): number {
  const p = R.basin.rim.squareness;
  const dx = Math.abs(x - plan.cx);
  const dz = Math.abs(z - plan.cz);
  if (p === 4) {
    // The rule's own exponent, without a pow: it is asked of every cell.
    const x2 = dx * dx;
    const z2 = dz * dz;
    return Math.sqrt(Math.sqrt(x2 * x2 + z2 * z2));
  }
  return (dx ** p + dz ** p) ** (1 / p);
}

/** R2 — how far up the rim a point stands: 0 on the basin floor, 1 at the
 * full height of the flanks. */
export function rimAt(plan: TerrainPlan, x: number, z: number): number {
  return rimOf(plan, valueNoise(x, z, 260, plan.seeds.rim), x, z);
}

/** `rimAt` off the warp's noise already read at (x, z). */
function rimOf(plan: TerrainPlan, noise: number, x: number, z: number): number {
  const warp = (noise * 2 - 1) * R.basin.rim.warp;
  return smoothstep(R.basin.rim.inner, R.basin.rim.outer, squareRadius(plan, x, z) + warp);
}

/** R2, R3 — the untouched country's height at a plan point, m, read off
 * the plan's `countryFields`. */
function countryAt(plan: TerrainPlan, f: CountryFields, x: number, z: number): number {
  // A slow domain warp, so the hills are not laid out on the noise's own
  // lattice.
  const wx = x + (sampleNoise(f.warpX, x, z) * 2 - 1) * 70;
  const wz = z + (sampleNoise(f.warpZ, x, z) * 2 - 1) * 70;
  const rim = rimOf(plan, sampleNoise(f.rim, x, z), x, z);
  const floor = 1 - rim * 0.6;
  let h = fbm(f.hills, wx, wz) * plan.hills * floor;
  h += ridged(f.ridges, wx, wz) * plan.ridges * floor;
  if (plan.rollers > 0) {
    // R3's rollers, on a lattice turned the other way from the crests', so
    // their creases do not run parallel to anything else in the country.
    const rx = wx * 0.8 + wz * 0.6;
    const rz = wz * 0.8 - wx * 0.6;
    h += (ridged(f.rollers, rx, rz) - 0.5) * plan.rollers * floor;
  }
  h += (x - plan.cx) * plan.tiltX + (z - plan.cz) * plan.tiltZ;
  for (const b of plan.bowls) {
    const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r);
    if (d2 < 1) h -= b.depth * (1 - d2) * (1 - d2);
  }
  if (rim > 0) {
    h += plan.mountain * rim ** 1.6;
    // The crests on a lattice turned off the hills' own, so the two do not
    // line up into the noise's squares.
    const rx = wx * 0.866 - wz * 0.5;
    const rz = wx * 0.5 + wz * 0.866;
    h +=
      plan.crests * rim * (ridged(f.crests, rx, rz) * 0.75 + ridged(f.crestsFine, rz, rx) * 0.25);
  }
  return h;
}

/** Bake the untouched country onto the map's grid (R1), row by row — the
 * order the noise fields' kept squares pay off in. */
export function bakeCountry(plan: TerrainPlan): Heightfield {
  const cell = R.world.cell;
  const n = Math.round(R.world.size / cell) + 1;
  const field = createHeightfield(0, 0, cell, n, n);
  const d = field.data;
  const fields = countryFields(plan);
  for (let r = 0; r < n; r++) {
    const z = r * cell;
    for (let c = 0; c < n; c++) d[r * n + c] = countryAt(plan, fields, c * cell, z);
  }
  return field;
}
