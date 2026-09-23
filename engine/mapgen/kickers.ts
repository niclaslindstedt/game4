// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R4, R9 — THE KICKERS: crests shaped so a sled at speed leaves the ground.
//
// A kicker is a profile along the direction a rider crosses it: a RAMP that
// rises `height` over `ramp` metres as t², so it is steepest right at the
// lip — a ramp that flattened as it reached the top (a smoothstep) would
// hand the sled no upward speed at the one moment it matters, and a jump
// that does not jump — and then a LANDING that falls the same height away
// over `landing` metres, (1 − u)², steepest at the lip again. The lip is the
// kink between the two, and a kink is a crest no suspension can follow.
//
// ON THE TRACK (R9) the profile is added to the graded line itself, by arc
// length, before the corridor is pressed into the ground — so the kicker is
// as wide as the track, its banks are the corridor's banks, and it follows
// the line through whatever gentle bend it stands in. The search only
// stands one on a stretch that barely turns and where the line past the lip
// runs level or downhill, which is the natural crest: a brow before a
// descent.
//
// OFF THE TRACK (R4) the same profile is stamped into the ground in plan, on
// a hilltop the search climbs to, across a width that blends into the snow
// at its sides — something a rider leaves the loop to find.

import { angleDiff, smoothstep } from "../lib/math.ts";
import { sampleField, fieldGradient, type Heightfield } from "../lib/heightfield.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { nearestTrackPoint } from "./query.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import { trackOf, type Loop } from "./track.ts";
import type { Kicker } from "./types.ts";

/** The lift a kicker's profile adds `u` metres past its lip (negative on
 * the ramp), m. */
export function kickerProfile(height: number, ramp: number, landing: number, u: number): number {
  if (u <= -ramp || u >= landing) return 0;
  if (u <= 0) {
    const t = 1 + u / ramp;
    return height * t * t;
  }
  const t = 1 - u / landing;
  return height * t * t;
}

/** An on-track kicker before the loop is re-indexed: its lip's station. */
export type TrackKicker = { index: number; height: number; ramp: number; landing: number };

/** R9 — choose the track's kickers and add them to the graded profile.
 * Returns them by the index of their lip, in loop order. */
export function layTrackKickers(rng: Rng, loop: Loop): TrackKicker[] {
  const pts = loop.points;
  const n = pts.length;
  const step = loop.length / n;
  const K = R.kickers.on;
  // As many as the loop has room for, up to the rule's most: a map short of
  // good brows carries fewer, never a bad one.
  const want = K.count.max;
  // Every station a kicker could stand at, scored; then the best that keep
  // their spacing, with a little noise in the score so a seed with two
  // equally good crests does not always pick the same one.
  type Candidate = { index: number; score: number; ramp: number; landing: number };
  const candidates: Candidate[] = [];
  // One size of kicker per map: the lip's height, and the ramp and the
  // landing as multiples of it, so a taller lip keeps its slopes.
  const height = inBand(rng, K.height);
  const ramp = height * inBand(rng, K.ramp);
  const landing = height * inBand(rng, K.landing);
  const back = Math.ceil((ramp + 10) / step);
  const ahead = Math.ceil((landing + 10) / step);
  for (let i = 0; i < n; i += 3) {
    let lo = 0;
    let hi = 0;
    let turned = 0;
    for (let j = -back; j < ahead; j++) {
      const a = pts[(i + j + n) % n].heading;
      const b = pts[(i + j + 1 + n) % n].heading;
      turned += angleDiff(a, b);
      if (turned < lo) lo = turned;
      if (turned > hi) hi = turned;
    }
    if (hi - lo > K.straight) continue;
    // A brow: the line comes up to the lip (or at least not down to it) and
    // runs level or downhill past it.
    const yLip = pts[i].y;
    const yFoot = pts[(i - Math.round(ramp / step) + n) % n].y;
    const yEnd = pts[(i + Math.round(landing / step)) % n].y;
    const rise = (yLip - yFoot) / ramp;
    const fall = (yLip - yEnd) / landing;
    if (-fall > K.landingGrade || rise < K.approachGrade) continue;
    candidates.push({ index: i, score: rise + fall + rng.range(0, 0.04), ramp, landing });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen: TrackKicker[] = [];
  for (const c of candidates) {
    if (chosen.length >= want) break;
    const clear = chosen.every((k) => {
      const ds = Math.abs(pts[k.index].s - pts[c.index].s);
      return Math.min(ds, loop.length - ds) >= K.spacing;
    });
    if (!clear) continue;
    chosen.push({ index: c.index, height, ramp: c.ramp, landing: c.landing });
  }
  chosen.sort((a, b) => a.index - b.index);
  for (const k of chosen) {
    const s0 = pts[k.index].s;
    for (let j = -Math.ceil(k.ramp / step); j <= Math.ceil(k.landing / step); j++) {
      const p = pts[(k.index + j + n) % n];
      let u = p.s - s0;
      if (u > loop.length / 2) u -= loop.length;
      if (u < -loop.length / 2) u += loop.length;
      p.y += kickerProfile(k.height, k.ramp, k.landing, u);
    }
  }
  return chosen;
}

/** Publish the track's kickers against the finished (re-indexed) loop. */
export function publishTrackKickers(
  loop: Loop,
  kickers: readonly TrackKicker[],
  start: number,
): Kicker[] {
  const n = loop.points.length;
  const out = kickers
    .map((k) => {
      const p = loop.points[(k.index - start + n) % n];
      return {
        id: "",
        x: p.x,
        z: p.z,
        y: p.y,
        heading: p.heading,
        height: k.height,
        ramp: k.ramp,
        landing: k.landing,
        width: p.width,
        onTrack: true,
        s: p.s,
      } satisfies Kicker;
    })
    .sort((a, b) => a.s - b.s);
  out.forEach((k, i) => (k.id = `K${i + 1}`));
  return out;
}

/** R4 — stand the off-track kickers on hilltops clear of the track, and
 * stamp them into the ground. */
export function layOffKickers(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  loop: Loop,
): Kicker[] {
  const K = R.kickers.off;
  const want = rng.int(K.count.min, K.count.max);
  const out: Kicker[] = [];
  const size = R.world.size;
  for (let tries = 0; tries < want * 30 && out.length < want; tries++) {
    // A seed point on the basin floor, climbed a few steps up its slope to
    // the nearest hilltop.
    let x = rng.range(size * 0.12, size * 0.88);
    let z = rng.range(size * 0.12, size * 0.88);
    for (let s = 0; s < 12; s++) {
      const g = fieldGradient(ground, x, z);
      const m = Math.hypot(g.gx, g.gz);
      if (m < 0.01) break;
      x += (g.gx / m) * 6;
      z += (g.gz / m) * 6;
    }
    const height = inBand(rng, K.height);
    const ramp = inBand(rng, K.ramp);
    const landing = inBand(rng, K.landing);
    const width = inBand(rng, K.width);
    const reach = Math.max(ramp, landing) + width / 2 + R.kickers.edge;
    if (rimAt(plan, x, z) > 0.02 || rimAt(plan, x, z + reach) > 0.05) continue;
    const hit = nearestTrackPoint(trackOf(loop), x, z);
    if (hit.distance - reach < R.track.width.max / 2 + K.clearance) continue;
    if (out.some((k) => Math.hypot(k.x - x, k.z - z) < reach + Math.max(k.ramp, k.landing) + 20)) {
      continue;
    }
    // Ridden down the hill's fall line on its far side: the landing runs
    // the way the ground falls, the ramp comes up the way it rises.
    const g = fieldGradient(ground, x, z);
    const heading =
      Math.hypot(g.gx, g.gz) > 0.02 ? Math.atan2(-g.gx, -g.gz) : rng.range(0, Math.PI * 2);
    const y0 = sampleField(ground, x, z);
    stampKicker(ground, x, z, heading, height, ramp, landing, width);
    out.push({
      id: `X${out.length + 1}`,
      x,
      z,
      y: y0 + height,
      heading,
      height,
      ramp,
      landing,
      width,
      onTrack: false,
    });
  }
  // Publish the ground height the stamp actually left at each lip.
  for (const k of out) k.y = sampleField(ground, k.x, k.z);
  return out;
}

/** Add one kicker's profile to the ground in plan. */
function stampKicker(
  ground: Heightfield,
  x: number,
  z: number,
  heading: number,
  height: number,
  ramp: number,
  landing: number,
  width: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const edge = R.kickers.edge;
  const reach = Math.max(ramp, landing) + width / 2 + edge;
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((x - reach) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((x + reach) / cell));
  const r0 = Math.max(0, Math.floor((z - reach) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((z + reach) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c * cell - x;
      const dz = r * cell - z;
      const u = dx * fx + dz * fz;
      const v = Math.abs(dx * fz - dz * fx);
      const across = 1 - smoothstep(width / 2, width / 2 + edge, v);
      if (across <= 0) continue;
      ground.data[r * ground.cols + c] += across * kickerProfile(height, ramp, landing, u);
    }
  }
}

/** Whether a plan point stands on a kicker's footprint (R14 keeps trees
 * off them), with `margin` metres to spare. */
export function onKicker(
  kickers: readonly Kicker[],
  x: number,
  z: number,
  margin: number,
): boolean {
  for (const k of kickers) {
    const dx = x - k.x;
    const dz = z - k.z;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const u = dx * fx + dz * fz;
    const v = Math.abs(dx * fz - dz * fx);
    if (
      u > -k.ramp - margin &&
      u < k.landing + margin &&
      v < k.width / 2 + R.kickers.edge + margin
    ) {
      return true;
    }
  }
  return false;
}
