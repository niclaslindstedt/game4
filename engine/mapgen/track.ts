// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R5–R8, R10 — THE RACE LOOP: drawn, measured, graded into the country.
//
// THE SHAPE IS POLAR. A loop drawn as a walk asked to find its way home
// arrives at whatever heading it arrives at, and the join is a kink; a loop
// drawn as a radius warped by a few harmonics of the angle round a centre,
//
//     r(θ) = 1 + Σ aₖ · sin(kθ + φₖ)
//
// closes exactly by construction, is smooth everywhere including at θ = 0,
// and — because r is single-valued in θ — is STAR-SHAPED about its centre,
// so the harmonics alone can never cross themselves. Where a harmonic's
// aₖ·k² passes 1 the curve turns concave and the loop grows a real
// counter-bend; a seeded stretch and rotation then keep the map from
// reading as a flower, and a slow noise WARP in metres bends the clean
// curves into esses and kinks the harmonics cannot make. The warp can in
// principle fold the loop over itself, so every draw is checked for a
// crossing (R5). The shape is scaled to the length the attempt aims at,
// sampled finely, and resampled every `track.step` metres by arc length. A
// draw whose corners come out too tight (R6), whose parts come too close
// (R5) or which reaches up the rim (R2) is refused, and the attempt draws
// again.
//
// THE GRADING (R8) is a Lipschitz envelope rather than a blur: the highest
// profile with no grade over g that stays under the country (`upper`) and
// the lowest with none over g that stays above it (`lower`) are each one
// forward and one backward sweep round the loop, and their MEAN is a
// profile whose grade is bounded by g by construction — it cuts a hilltop
// halfway down and fills a hollow halfway up, and leaves the gentle country
// exactly where it was. A light blur afterwards rounds the joins (a mean of
// shifted copies keeps the bound). The kickers (R9, kickers.ts) are then
// added on top of that profile, and `stampCorridor` presses the finished
// line into the ground: level across the width, the flat shoulder and the
// bench past it, the plough's berm along each edge on that bench (R18), a
// bank back into the country behind it, and the packed field of R10.

import { hypot, smoothstep, TAU } from "../lib/math.ts";
import { sampleField, createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, bermCrest, bermProfile, inBand } from "./rules.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import type { TrackPoint } from "./types.ts";
import { selfCrossings } from "../analysis/crossings.ts";

/** The loop while the generator is still working on it. */
export type Loop = {
  points: TrackPoint[];
  length: number;
  /** The untouched country's height under each point, m. */
  raw: Float64Array;
  /** The centre the loop is star-shaped about. */
  readonly cx: number;
  readonly cz: number;
};

/** The loop as the track queries (`query.ts`) read one. Taken fresh after
 * `rotateLoop`, which replaces the points array. */
export function trackOf(loop: Loop): { track: { points: TrackPoint[]; length: number } } {
  return { track: { points: loop.points, length: loop.length } };
}

/** How finely the unit shape is sampled before it is resampled by arc
 * length, samples per turn. */
const SAMPLES = 4096;

/** R5 — draw the loop's plan: its shape, its length, its width. */
export function drawLoop(rng: Rng, plan: TerrainPlan): Loop | string {
  const cx = plan.cx + rng.range(-50, 50);
  const cz = plan.cz + rng.range(-50, 50);
  // The harmonics: always the oval's second, then two or three of the
  // higher ones, one of them usually strong enough to turn concave.
  const ks = [2];
  const pool = [3, 4, 5, 6, 7];
  const extra = rng.int(2, 3);
  for (let i = 0; i < extra; i++) ks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const amps = ks.map((k) => (k === 2 ? rng.range(0.05, 0.22) : rng.range(0.6, 2.8) / (k * k)));
  const phases = ks.map(() => rng.range(0, TAU));
  const stretch = rng.range(1, 1.3);
  const turn = rng.range(0, TAU);
  const ct = Math.cos(turn);
  const st = Math.sin(turn);

  // The unit shape.
  const ux = new Float64Array(SAMPLES + 1);
  const uz = new Float64Array(SAMPLES + 1);
  for (let j = 0; j <= SAMPLES; j++) {
    const th = (j / SAMPLES) * TAU;
    let r = 1;
    for (let h = 0; h < ks.length; h++) r += amps[h] * Math.sin(ks[h] * th + phases[h]);
    if (r < 0.3) return "the loop pinches through its own centre";
    const x = r * Math.cos(th) * stretch;
    const z = r * Math.sin(th);
    ux[j] = x * ct - z * st;
    uz[j] = x * st + z * ct;
  }
  // Scaled onto the map and WARPED: a slow noise displacement that bends
  // the harmonics' clean curves into esses, kinks and hairpins. The warp is
  // a fixed field in metres, so the scale that lands the warped loop on its
  // aim is found in two passes — the second only corrects the first.
  const warp = {
    amount: rng.range(R.track.warp.amount.min, R.track.warp.amount.max),
    scale: rng.range(R.track.warp.scale.min, R.track.warp.scale.max),
    seed: rng.int(1, 1 << 30),
  };
  const aim = inBand(rng, R.track.aim);
  const wx = new Float64Array(SAMPLES + 1);
  const wz = new Float64Array(SAMPLES + 1);
  let perimeter = 0;
  for (let j = 1; j <= SAMPLES; j++) perimeter += hypot(ux[j] - ux[j - 1], uz[j] - uz[j - 1]);
  let scale = aim / perimeter;
  let length = 0;
  for (let pass = 0; pass < 3; pass++) {
    length = 0;
    for (let j = 0; j <= SAMPLES; j++) {
      const x = cx + ux[j] * scale;
      const z = cz + uz[j] * scale;
      wx[j] = x + (valueNoise(x, z, warp.scale, warp.seed) * 2 - 1) * warp.amount;
      wz[j] = z + (valueNoise(x, z, warp.scale, warp.seed + 77) * 2 - 1) * warp.amount;
      if (j > 0) length += hypot(wx[j] - wx[j - 1], wz[j] - wz[j - 1]);
    }
    scale *= aim / length;
  }
  if (length < R.track.length.min || length > R.track.length.max) {
    return `the warped loop comes out ${length.toFixed(0)} m long`;
  }

  // Resample by arc length, every `track.step` metres.
  const n = Math.round(length / R.track.step);
  const step = length / n;
  const points: TrackPoint[] = [];
  let j = 1;
  let acc = 0;
  let seg = hypot(wx[1] - wx[0], wz[1] - wz[0]);
  for (let i = 0; i < n; i++) {
    const want = i * step;
    while (acc + seg < want && j < SAMPLES) {
      acc += seg;
      j++;
      seg = hypot(wx[j] - wx[j - 1], wz[j] - wz[j - 1]);
    }
    const t = seg > 0 ? (want - acc) / seg : 0;
    const x = wx[j - 1] + (wx[j] - wx[j - 1]) * t;
    const z = wz[j - 1] + (wz[j] - wz[j - 1]) * t;
    points.push({ x, z, y: 0, s: want, heading: 0, width: 0 });
  }
  setHeadings(points);

  // R7 — the width, wandering on a noise read round a circle so it closes.
  const wseed = rng.int(1, 1 << 30);
  const ring = length / TAU;
  for (const p of points) {
    const a = (p.s / length) * TAU;
    const v = valueNoise(Math.cos(a) * ring, Math.sin(a) * ring, R.track.widthScale, wseed);
    p.width =
      R.track.width.min + (R.track.width.max - R.track.width.min) * smoothstep(0.15, 0.85, v);
  }

  const loop: Loop = { points, length, raw: new Float64Array(n), cx, cz };
  const radius = minRadius(loop);
  if (radius < R.track.minRadius) return `a turn tightens to ${radius.toFixed(0)} m`;
  if (selfCrossings(points) > 0) return "the warped loop crosses itself";
  const gap = minSeparation(loop);
  if (gap < R.track.separation.plan)
    return `two stretches of the loop pass ${gap.toFixed(0)} m apart`;
  // R2 — the whole corridor, bank and all, stays on the basin floor.
  const reach =
    R.track.width.max / 2 + R.track.shoulder.flat + R.berm.width + R.track.bank.max + 10;
  for (const p of points) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d = hypot(dx, dz) || 1;
    if (rimAt(plan, p.x + (dx / d) * reach, p.z + (dz / d) * reach) > 0) {
      return "the loop runs up the mountain rim";
    }
  }
  return loop;
}

/** Headings off the central difference round the loop. */
export function setHeadings(points: TrackPoint[]): void {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const b = points[(i + 1) % n];
    points[i].heading = Math.atan2(b.x - a.x, b.z - a.z);
  }
}

/** R6 — the tightest turn on the loop: the circumradius of three points
 * `track.turnWindow` apart, least over the loop, m. */
export function minRadius(loop: { points: readonly TrackPoint[] }): number {
  const pts = loop.points;
  const n = pts.length;
  const k = Math.max(1, Math.round(R.track.turnWindow / 2 / R.track.step));
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - k + n) % n];
    const b = pts[i];
    const c = pts[(i + k) % n];
    const ab = hypot(b.x - a.x, b.z - a.z);
    const bc = hypot(c.x - b.x, c.z - b.z);
    const ca = hypot(a.x - c.x, a.z - c.z);
    const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (area2 < 1e-9) continue;
    const r = (ab * bc * ca) / (2 * area2);
    if (r < best) best = r;
  }
  return best;
}

/** R5 — the least plan distance between two points of the loop that are
 * more than `separation.along` apart along it, m. */
export function minSeparation(loop: { points: readonly TrackPoint[]; length: number }): number {
  const pts = loop.points;
  const n = pts.length;
  const cell = R.track.separation.plan;
  const cells = new Map<number, number[]>();
  const key = (c: number, r: number): number => c * 8192 + r;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(pts[i].x / cell), Math.floor(pts[i].z / cell));
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  }
  const along = R.track.separation.along;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const c = Math.floor(p.x / cell);
    const r = Math.floor(p.z / cell);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const list = cells.get(key(c + dc, r + dr));
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const ds = Math.abs(pts[j].s - p.s);
          if (Math.min(ds, loop.length - ds) <= along) continue;
          const d = hypot(pts[j].x - p.x, pts[j].z - p.z);
          if (d < best) best = d;
        }
      }
    }
  }
  return best;
}

/** One box-blur pass round a closed profile, half-window `k` points. */
function blur(y: Float64Array, k: number): Float64Array<ArrayBuffer> {
  const n = y.length;
  const out = new Float64Array(n);
  let sum = 0;
  for (let j = -k; j <= k; j++) sum += y[(j + n) % n];
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * k + 1);
    sum += y[(i + k + 1) % n] - y[(i - k + n) % n];
  }
  return out;
}

/** The steepest grade over `track.gradeWindow` anywhere on a profile,
 * skipping stations the `skip` mask marks. */
export function maxGradeOf(y: ArrayLike<number>, step: number, skip?: Uint8Array): number {
  const n = y.length;
  const k = Math.max(1, Math.round(R.track.gradeWindow / step));
  let best = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + k) % n;
    if (skip && (skip[i] || skip[j])) continue;
    const g = Math.abs(y[j] - y[i]) / (k * step);
    if (g > best) best = g;
  }
  return best;
}

/** R8 — grade the loop's profile against the country under it. Writes each
 * point's `y` and `raw`; returns a reason on a loop that cannot be graded
 * inside `track.maxCut`. */
export function gradeLoop(loop: Loop, country: Heightfield): string | null {
  const pts = loop.points;
  const n = pts.length;
  const step = loop.length / n;
  const raw = loop.raw;
  for (let i = 0; i < n; i++) raw[i] = sampleField(country, pts[i].x, pts[i].z);
  // Aim a little under the rule, so the blur and the window cannot tip a
  // stretch that sat exactly on the bound over it.
  const g = R.track.maxGrade * 0.9 * step;
  const upper = Float64Array.from(raw);
  const lower = Float64Array.from(raw);
  // Two laps of each sweep: the second carries the envelope across the join.
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 1; i <= n; i++) {
      const a = i % n;
      const b = i - 1;
      upper[a] = Math.min(upper[a], upper[b] + g);
      lower[a] = Math.max(lower[a], lower[b] - g);
    }
    for (let i = n - 2; i >= -1; i--) {
      const a = (i + n) % n;
      const b = (i + 1) % n;
      upper[a] = Math.min(upper[a], upper[b] + g);
      lower[a] = Math.max(lower[a], lower[b] - g);
    }
  }
  let y: Float64Array<ArrayBuffer> = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (upper[i] + lower[i]) / 2;
  const k = Math.round(12 / step);
  y = blur(blur(y, k), k);
  let cut = 0;
  for (let i = 0; i < n; i++) {
    pts[i].y = y[i];
    cut = Math.max(cut, Math.abs(y[i] - raw[i]));
  }
  if (cut > R.track.maxCut) return `the loop has to be cut ${cut.toFixed(1)} m into the country`;
  return null;
}

/** Re-index the loop so it starts at point `start`, arc lengths from there. */
export function rotateLoop(loop: Loop, start: number): void {
  const n = loop.points.length;
  const step = loop.length / n;
  const pts = loop.points.slice(start).concat(loop.points.slice(0, start));
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    pts[i].s = i * step;
    raw[i] = loop.raw[(i + start) % n];
  }
  loop.points = pts;
  loop.raw = raw;
}

/** What the corridor stamp leaves behind besides the graded ground. */
export type Corridor = {
  /** R10 — 0 powder … 1 packed, on the ground's grid. */
  readonly packed: Heightfield;
  /** Per cell of that grid, the loop point starting the segment nearest it
   * (-1 where the corridor did not reach), and how far along that segment,
   * 0..1 — what lets R17 lay a drift by arc length. Indexed on the loop as
   * it stood when stamped, before `rotateLoop`. */
  readonly near: Int32Array;
  readonly along: Float32Array;
  /** Per cell, the plan distance to the loop's centreline, m (Infinity past
   * the corridor's reach) — how far the region's own snow keeps off it
   * (R21). */
  readonly dist: Float32Array;
};

/** R8, R10, R18 — press the finished line into the ground: level across
 * the width, the flat shoulder and the bench past it, the plough's berm on
 * that bench, a bank back to the country behind it, and the packed field.
 * Writes `ground` in place. */
export function stampCorridor(loop: Loop, ground: Heightfield): Corridor {
  const pts = loop.points;
  const n = pts.length;
  const step = loop.length / n;
  const cols = ground.cols;
  const rows = ground.rows;
  const cell = ground.cell;
  const cells = cols * rows;
  const dist = new Float32Array(cells).fill(Infinity);
  const near = new Int32Array(cells).fill(-1);
  const along = new Float32Array(cells);
  const target = new Float32Array(cells);
  const half = new Float32Array(cells);
  const reachMax = R.track.width.max / 2 + R.track.shoulder.flat + R.berm.width + R.track.bank.max;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reachMax) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + reachMax) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reachMax) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z) + reachMax) / cell));
    for (let r = r0; r <= r1; r++) {
      const z = r * cell;
      for (let c = c0; c <= c1; c++) {
        const x = c * cell;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (a.x + dx * t);
        const ez = z - (a.z + dz * t);
        const o = r * cols + c;
        // Most cells already hold a nearer segment: the square, with a
        // margin far wider than `hypot`'s rounding and the float32 store's,
        // turns those away before the dear `hypot` is paid for, and every
        // cell it lets through is decided by `hypot` exactly as before.
        const held = dist[o];
        if (ex * ex + ez * ez > held * held * (1 + 1e-5)) continue;
        const d = hypot(ex, ez);
        if (d < held) {
          dist[o] = d;
          near[o] = i;
          along[o] = t;
          target[o] = a.y + (b.y - a.y) * t;
          half[o] = (a.width + (b.width - a.width) * t) / 2;
        }
      }
    }
  }
  const packed = createHeightfield(0, 0, cell, cols, rows);
  const g = ground.data;
  const p = packed.data;
  for (let o = 0; o < cells; o++) {
    const d = dist[o];
    if (d === Infinity) continue;
    const hw = half[o];
    // R18 — the bench the berm stands on is level too; the bank starts
    // behind it.
    const toe = hw + R.track.shoulder.flat;
    const flat = toe + R.berm.width;
    const delta = target[o] - g[o];
    const bank = Math.min(
      R.track.bank.max,
      Math.max(R.track.bank.min, Math.abs(delta) / R.track.bank.slope),
    );
    const w = d <= flat ? 1 : 1 - smoothstep(flat, flat + bank, d);
    g[o] += w * delta;
    if (d > toe && d < flat)
      g[o] += bermProfile(bermCrest((near[o] + along[o]) * step, loop.length), d - toe);
    p[o] = d <= hw ? 1 : 1 - smoothstep(hw, hw + R.track.shoulder.packed, d);
  }
  return { packed, near, along, dist };
}
