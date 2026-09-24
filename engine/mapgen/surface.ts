// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — THE REGION'S OWN SNOW: what the wind and the cold have done to the
// country before the groomer came through it.
//
// Two things, each laid only in a region whose row asks for it, and each off
// a stream of its own (the attempt's sub-seed, salted) so neither moves a
// single number anything else on the map draws:
//
//   THE FROZEN RIVER. A line across the basin from one foot of the range to
//   the other, swinging either side of straight, its bed CUT into the
//   country along a heavily smoothed profile of the ground it crosses — a
//   frozen river runs level where the country only rolls — and its channel
//   a flat road of ice between banks that ease back into the country. It is
//   carved BEFORE the loop is drawn, so the loop is graded against a country
//   that already has the river in it, and a loop that crosses the river
//   crosses it on the groomer's own snow bridge.
//
//   THE WIND CRUST. A packed share pressed into the powder over broad
//   patches of slow noise and over every crest a few metres proud of the
//   ground round it — the wind scours what stands up and drops its snow in
//   the lee. Laid on the finished country, kickers and all.
//
// Neither reaches the track: both are folded into the packed field only
// past `CLEAR` metres of the centreline, so R10 holds — the loop and its
// shoulders are the groomer's alone, and a drift across it (R17) is fresh
// snow over the groomer, never over a crust.

import { hypot, smoothstep } from "../lib/math.ts";
import { createHeightfield, sampleField, type Heightfield } from "../lib/heightfield.ts";
import { valueNoise } from "../lib/noise.ts";
import { createRng } from "../lib/prng.ts";
import type { Region } from "./regions.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { TerrainPlan } from "./terrain.ts";

const RIVER_SALT = 0x71ce0b3d;
const CRUST_SALT = 0x0c2057a1;

/** How far from the centreline the region's own snow starts, m: past the
 * widest track's flat shoulder and its berm (R8, R18), with three metres to
 * spare — and so past where R10 reads the powder beside the track. */
export const CLEAR = R.track.width.max / 2 + R.track.shoulder.flat + R.berm.width + 3;

/** …and the metres it eases in over past that. */
const EASE = 10;

/** A river laid across the basin: stations along its line, the bed's
 * height at each and the channel's half-width there. */
export type River = {
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly bed: Float64Array;
  readonly half: Float64Array;
};

/** Metres between two stations of a river's line. */
const STATION = 4;
/** Stations either side the bed's profile is averaged over: 120 m. */
const SMOOTH = 30;
/** The steepest a bank climbs back into the country, m per m, and its
 * narrowest and widest, m. */
const BANK = { slope: 0.4, min: 6, max: 26 };

/** R21 — the river's line and bed, or null in a region without one. */
export function planRiver(sub: number, plan: TerrainPlan, ground: Heightfield): River | null {
  const spec = plan.region.river;
  if (!spec) return null;
  const rng = createRng((sub ^ RIVER_SALT) >>> 0);
  const a = rng.range(0, Math.PI * 2);
  const b = a + Math.PI + rng.range(-0.5, 0.5);
  const reach = R.basin.rim.inner - 20;
  const x0 = plan.cx + Math.sin(a) * reach;
  const z0 = plan.cz + Math.cos(a) * reach;
  const x1 = plan.cx + Math.sin(b) * reach;
  const z1 = plan.cz + Math.cos(b) * reach;
  const swing = inBand(rng, spec.swing);
  const waves = rng.range(1.4, 2.6);
  const phase = rng.range(0, Math.PI * 2);
  const phase2 = rng.range(0, Math.PI * 2);
  const width = inBand(rng, spec.width);
  const widthPhase = rng.range(0, Math.PI * 2);
  const len = hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(len / STATION) + 1;
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const h = new Float64Array(n);
  const half = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const off =
      swing * Math.sin(2 * Math.PI * waves * t + phase) +
      swing * 0.3 * Math.sin(2 * Math.PI * waves * 2.3 * t + phase2);
    x[i] = x0 + (x1 - x0) * t + uz * off;
    z[i] = z0 + (z1 - z0) * t - ux * off;
    h[i] = sampleField(ground, x[i], z[i]);
    // The channel narrows to nothing toward the foot of the range at either
    // end: a creek running out of the snow rather than a cut ending square.
    const ends = smoothstep(0, 0.1, t) * (1 - smoothstep(0.9, 1, t));
    half[i] =
      (width / 2) * (0.85 + 0.3 * (0.5 + 0.5 * Math.sin(6 * Math.PI * t + widthPhase))) * ends;
  }
  const bed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - SMOOTH); j <= Math.min(n - 1, i + SMOOTH); j++) {
      sum += h[j];
      count++;
    }
    bed[i] = sum / count - spec.depth;
  }
  return { x, z, bed, half };
}

/** Cut the river into the ground and return its ice, 0..1 on the ground's
 * grid (before the track's clearance is taken out of it). */
export function carveRiver(ground: Heightfield, river: River): Heightfield {
  const { cols, rows, cell } = ground;
  const cells = cols * rows;
  const dist = new Float32Array(cells).fill(Infinity);
  const bedAt = new Float32Array(cells);
  const halfAt = new Float32Array(cells);
  const n = river.x.length;
  let widest = 0;
  for (let i = 0; i < n; i++) widest = Math.max(widest, river.half[i]);
  const reach = widest + BANK.max;
  for (let i = 0; i + 1 < n; i++) {
    const ax = river.x[i];
    const az = river.z[i];
    const dx = river.x[i + 1] - ax;
    const dz = river.z[i + 1] - az;
    const len2 = dx * dx + dz * dz || 1;
    const c0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - reach - ground.originX) / cell));
    const c1 = Math.min(
      cols - 1,
      Math.ceil((Math.max(ax, ax + dx) + reach - ground.originX) / cell),
    );
    const r0 = Math.max(0, Math.floor((Math.min(az, az + dz) - reach - ground.originZ) / cell));
    const r1 = Math.min(
      rows - 1,
      Math.ceil((Math.max(az, az + dz) + reach - ground.originZ) / cell),
    );
    for (let r = r0; r <= r1; r++) {
      const pz = ground.originZ + r * cell;
      for (let c = c0; c <= c1; c++) {
        const px = ground.originX + c * cell;
        let t = ((px - ax) * dx + (pz - az) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = hypot(px - (ax + dx * t), pz - (az + dz * t));
        const o = r * cols + c;
        if (d < dist[o]) {
          dist[o] = d;
          bedAt[o] = river.bed[i] + (river.bed[i + 1] - river.bed[i]) * t;
          halfAt[o] = river.half[i] + (river.half[i + 1] - river.half[i]) * t;
        }
      }
    }
  }
  const ice = createHeightfield(ground.originX, ground.originZ, cell, cols, rows);
  const g = ground.data;
  for (let o = 0; o < cells; o++) {
    const d = dist[o];
    if (d === Infinity) continue;
    const hw = halfAt[o];
    if (hw < 0.5) continue;
    const bed = bedAt[o];
    const bank = Math.min(BANK.max, Math.max(BANK.min, Math.abs(g[o] - bed) / BANK.slope));
    if (d <= hw) g[o] = bed;
    else if (d < hw + bank) g[o] = bed + (g[o] - bed) * smoothstep(hw, hw + bank, d);
    ice.data[o] = 1 - smoothstep(hw - 1.5, hw, d);
  }
  return ice;
}

/** One box pass along a line of `n` values `stride` apart, `radius` either
 * way, as a running sum. */
function boxLine(
  src: Float32Array,
  dst: Float32Array,
  start: number,
  stride: number,
  n: number,
  radius: number,
): void {
  let sum = 0;
  let count = 0;
  for (let k = 0; k < Math.min(n, radius); k++) {
    sum += src[start + k * stride];
    count++;
  }
  for (let i = 0; i < n; i++) {
    const add = i + radius;
    if (add < n) {
      sum += src[start + add * stride];
      count++;
    }
    const drop = i - radius - 1;
    if (drop >= 0) {
      sum -= src[start + drop * stride];
      count--;
    }
    dst[start + i * stride] = sum / count;
  }
}

/** A box blur of a grid, `radius` cells either way, run twice (≈ a
 * gaussian). */
function blur(src: Float32Array, cols: number, rows: number, radius: number): Float32Array {
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rows; r++) boxLine(a, b, r * cols, 1, cols, radius);
    for (let c = 0; c < cols; c++) boxLine(b, a, c, cols, rows, radius);
  }
  return a;
}

/** R21 — the wind crust's share of the country, 0..1 on the ground's grid,
 * or null in a region that lays none. */
export function layCrust(sub: number, region: Region, ground: Heightfield): Heightfield | null {
  const spec = region.crust;
  if (!spec) return null;
  const rng = createRng((sub ^ CRUST_SALT) >>> 0);
  const seed = rng.int(1, 1 << 30);
  const { cols, rows, cell } = ground;
  // What stands proud of the country within fifty metres of it is what the
  // wind scours.
  const around = blur(ground.data, cols, rows, Math.round(12 / cell) * 2);
  const crust = createHeightfield(ground.originX, ground.originZ, cell, cols, rows);
  const edge = 1 - spec.cover;
  for (let r = 0; r < rows; r++) {
    const z = ground.originZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const x = ground.originX + c * cell;
      const o = r * cols + c;
      const n =
        valueNoise(x, z, spec.scale, seed) * 0.7 +
        valueNoise(x, z, spec.scale * 0.3, seed + 11) * 0.3;
      const patch = smoothstep(edge - 0.08, edge + 0.08, n);
      const proud = smoothstep(0.4, 3.5, ground.data[o] - around[o]) * spec.exposed;
      crust.data[o] = Math.max(patch, proud);
    }
  }
  return crust;
}

/** Fold the region's own snow into the packed field: the crust at its
 * support, the ice as hard as the groomer — each taken out within `CLEAR`
 * of the loop (`dist`, the corridor's distance to its centreline), where
 * the two fields are zeroed too so what is published is what is laid. */
export function foldSurface(
  packed: Heightfield,
  dist: Float32Array,
  region: Region,
  crust: Heightfield | null,
  ice: Heightfield | null,
): void {
  const support = region.crust?.packed ?? 0;
  const p = packed.data;
  for (let o = 0; o < p.length; o++) {
    const m = smoothstep(CLEAR, CLEAR + EASE, dist[o]);
    let v = p[o];
    if (crust) {
      crust.data[o] *= m;
      v = Math.max(v, crust.data[o] * support);
    }
    if (ice) {
      ice.data[o] *= m;
      v = Math.max(v, ice.data[o]);
    }
    p[o] = v;
  }
}
