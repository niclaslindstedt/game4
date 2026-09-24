// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Small math helpers shared across the engine. The world lives in the x/z
// plane (y is up); a heading of 0 points down +z and grows clockwise when
// seen from above, so `sin(heading), cos(heading)` is the forward vector.

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite ease from 0 at `a` to 1 at `b`, clamped either side. */
export function smoothstep(a: number, b: number, v: number): number {
  const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Signed shortest angular difference `b - a`, in (-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Exponential decay of `v` toward zero with rate `k` (per second). */
export function decay(v: number, k: number, dt: number): number {
  return v * Math.exp(-k * dt);
}

/** Move `v` toward `target` by at most `maxDelta`. */
export function approach(v: number, target: number, maxDelta: number): number {
  const d = target - v;
  if (Math.abs(d) <= maxDelta) return target;
  return v + Math.sign(d) * maxDelta;
}

/** `Math.hypot(a, b)`, bit for bit, several times cheaper.
 *
 * `Math.hypot` is a builtin call that boxes its arguments into an array and
 * Kahan-sums them after scaling by the largest — tens of nanoseconds, against
 * two for a bare square root, and the engine asks it on every probe, trunk
 * and track segment of every step. This is that same recipe (V8's, the one
 * the suite's digests were cut under) in plain arithmetic: every operation
 * in it is correctly rounded by IEEE 754, so it returns the same bits in
 * every browser, which a builtin whose algorithm each engine chooses for
 * itself does not promise. A bare `sqrt(a² + b²)` is NOT a substitute: it
 * differs in the last bit about a third of the time, and the determinism
 * contract is bits. */
export function hypot(a: number, b: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (x === Infinity || y === Infinity) return Infinity;
  if (x !== x || y !== y) return Number.NaN;
  const m = x > y ? x : y;
  if (m === 0) return 0;
  const p = x / m;
  const q = y / m;
  return Math.sqrt(p * p + q * q) * m;
}

/** `Math.hypot(a, b, c)`, bit for bit — `hypot`'s recipe over three, the
 * Kahan compensation carried from the second term into the third. */
export function hypot3(a: number, b: number, c: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  const z = Math.abs(c);
  if (x === Infinity || y === Infinity || z === Infinity) return Infinity;
  if (x !== x || y !== y || z !== z) return Number.NaN;
  const m = x > y ? (x > z ? x : z) : y > z ? y : z;
  if (m === 0) return 0;
  const p = x / m;
  const q = y / m;
  const r = z / m;
  const pp = p * p;
  const qq = q * q;
  const two = pp + qq;
  const carried = two - pp - qq;
  return Math.sqrt(two + (r * r - carried)) * m;
}

/** `Math.hypot(a, b, c, d)`, bit for bit — the compensation carried on
 * through the fourth term. A quaternion's length. */
export function hypot4(a: number, b: number, c: number, d: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  const z = Math.abs(c);
  const w = Math.abs(d);
  if (x === Infinity || y === Infinity || z === Infinity || w === Infinity) return Infinity;
  if (x !== x || y !== y || z !== z || w !== w) return Number.NaN;
  let m = x > y ? x : y;
  if (z > m) m = z;
  if (w > m) m = w;
  if (m === 0) return 0;
  const p = x / m;
  const q = y / m;
  const r = z / m;
  const t = w / m;
  const pp = p * p;
  const qq = q * q;
  const two = pp + qq;
  let carried = two - pp - qq;
  const third = r * r - carried;
  const three = two + third;
  carried = three - two - third;
  return Math.sqrt(three + (t * t - carried)) * m;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

/** Pack a pair of spatial-hash cell indices into one integer key.
 *
 * Every spatial index in the engine — the corridor grid, the branch index,
 * the guard field, the route's point field — is probed tens of thousands of
 * times per stage, most of them from inside a ring scan that touches dozens
 * of cells per query. A `${ix},${iz}` template key allocates a string on
 * every one of those probes and then hashes it; an integer key allocates
 * nothing and compares in one instruction.
 *
 * Injective while |iz| < 4096, which at the engine's cell sizes (10–120 m)
 * is a world tens of kilometres across — orders of magnitude past anything
 * the generator builds. */
export function cellKey(ix: number, iz: number): number {
  return ix * 8192 + iz;
}

/** The (dx, dz) offsets of a `(2r+1)²` block of cells, flattened in pairs
 * and ordered by RING — the middle cell, then the eight around it, and so
 * on out to `radius`.
 *
 * The order is the point. A ring scan that walks its block row by row meets
 * the far corners before the middle, so it carries a useless bound through
 * most of the block; walking outward from the query's own cell means the
 * nearest road is measured first, and every rejection past that ring has a
 * tight bound to reject against. Built once per index, because it is the
 * same handful of offsets on every query. */
export function blockOffsets(radius: number): number[] {
  const offsets: number[] = [];
  for (let r = 0; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === r) offsets.push(dx, dz);
      }
    }
  }
  return offsets;
}
