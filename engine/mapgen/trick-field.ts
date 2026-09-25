// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TRICK FIELD: a run of groomed kickers down the loop, laid only on
// a map built for a TRICKS run. The country, the loop, its start and its
// checkpoints are the seed's own; the field changes the track and nothing
// else.
//
// ON THE TRACK, because the track is where a sled already has its speed: it
// is groomed, it is clear of trees, and it goes on round — a rider who has
// taken the field comes back to the start of it without being told where
// to go.
//
// THREE SIZES, laid low, medium and high in turn and round again, so a run
// down the field is a ladder: the low lip for a pose, the medium for a flip,
// the high one for the flip with a 360 in it. Every one of them is BUILT
// past its lip (`KickerShape`): a flat deck at the lip's height, then a
// landing slope falling away to a floor dug under the track, then a run-out
// climbing back up to it. The slope is what a sled comes down onto — met at
// the angle it is falling at, it takes the landing into the springs a little
// at a time instead of all at once — and the bigger the lip the longer and
// deeper the slope, because the bigger lip throws a sled further and it
// comes down steeper. Each size lands clean across a band of speeds and
// harshly past it (`docs/riding.md` has the table): the speed a kicker is
// taken at is the rider's to judge.
//
// STAMPED ALONG THE LINE, by the arc length of the nearest track point under
// every cell of the corridor (the map `stampCorridor` left), so the ramp,
// the deck, the landing and the run-out follow the loop through whatever it
// does and lift or sink the track, its shoulders and its berms together.
// The FLIGHT does not follow the loop — a sled in the air goes straight —
// so each kicker stands where the line barely turns from the ramp's foot to
// the landing slope's, and does not climb past the lip, which would fill in
// the slope it lands on.
//
// SPACED by `trick.gap` of track between one run-out's end and the next
// ramp's foot: the run-up he takes the next lip at.
//
// Nothing here draws from a stream: the stations are the loop's own, taken
// in order, so asking for the field moves nothing the seed drew.

import { sampleField, type Heightfield } from "../lib/heightfield.ts";
import { angleDiff, smoothstep } from "../lib/math.ts";
import { kickerProfile } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Loop } from "./track.ts";
import type { Kicker, KickerShape, TrackPoint, TrickSize } from "./types.ts";

/** The arc a kicker covers, foot of the ramp to the end of its landing, m. */
function footprint(k: { s?: number; ramp: number; landing: number }): [number, number] {
  const s = k.s ?? 0;
  return [s - k.ramp, s + k.landing];
}

/** One size of the field as a kicker is built to it: the lip, the ramp,
 * the whole length past the lip, and the built landing. */
export function trickKicker(size: TrickSize): {
  height: number;
  ramp: number;
  landing: number;
  shape: KickerShape;
} {
  const z = R.trick.sizes[size];
  return {
    height: z.height,
    ramp: z.height * z.ramp,
    landing: z.deck + z.fall + z.runout,
    shape: { deck: z.deck, fall: z.fall, dig: z.dig },
  };
}

/** Where the stamp around the loop reaches: the corridor out to the far
 * toe of the berm, then a fade into the country. */
export type Corridor = { near: Int32Array; along: Float32Array; dist: Float32Array };

/** R20 — plan the field on the finished, re-indexed loop (arc length 0 at
 * the start line): its kickers in the order they are ridden, or the reason
 * the loop could not carry one. `taken` are the kickers already on the
 * track (R9), which the field keeps clear of. Nothing is stamped yet: the
 * country is finished first (`stampTrickField`). */
export function planTrickField(loop: Loop, taken: readonly Kicker[]): Kicker[] | string {
  const F = R.trick;
  const n = loop.points.length;
  const busy = taken.filter((k) => k.onTrack).map(footprint);
  const out: Kicker[] = [];
  let free = F.lead;
  let i = 0;
  /** Where in `trick.order` the next kicker's turn is. */
  let turn = 0;
  while (i < n && out.length < F.count.max) {
    // The size whose turn it is, where it first fits — unless a smaller one
    // fits more than `trick.wait` sooner: a stretch too short or too bent for
    // the big lip still carries a small one, and the turn goes on from
    // whatever was laid.
    let pick: { k: Kicker; at: number; index: number } | null = null;
    for (let t = 0; t < F.order.length; t++) {
      const at = (turn + F.order.length - t) % F.order.length;
      if (t > 0 && F.sizes[F.order[at]].height > F.sizes[F.order[turn]].height) continue;
      const hit = firstFit(loop, i, F.order[at], free, busy);
      if (hit && (!pick || (hit.k.s ?? 0) + F.wait < (pick.k.s ?? 0))) pick = { ...hit, at };
    }
    if (!pick) break;
    pick.k.id = `T${out.length + 1}`;
    out.push(pick.k);
    turn = (pick.at + 1) % F.order.length;
    free = (pick.k.s ?? 0) + pick.k.landing + F.gap;
    i = pick.index + 1;
  }
  if (out.length < F.count.min) return `only ${out.length} trick kicker(s) fit the loop (R20)`;
  return out;
}

/** The first station from `i` on where a kicker of `size` stands, and it. */
function firstFit(
  loop: Loop,
  i: number,
  size: TrickSize,
  free: number,
  busy: readonly [number, number][],
): { k: Kicker; index: number } | null {
  for (let j = i; j < loop.points.length; j++) {
    const k = fits(loop, loop.points[j], size, free, busy);
    if (k) return { k, index: j };
  }
  return null;
}

/** The kicker of `size` with its lip at `p`, or null where it will
 * not stand: inside the lead, on `busy` track, on a bend or on a climb. */
function fits(
  loop: Loop,
  p: TrackPoint,
  size: TrickSize,
  free: number,
  busy: readonly [number, number][],
): Kicker | null {
  const F = R.trick;
  const pts = loop.points;
  const n = pts.length;
  const step = loop.length / n;
  const built = trickKicker(size);
  const from = p.s - built.ramp;
  const to = p.s + built.landing;
  if (from < free || to > loop.length - F.lead) return null;
  if (busy.some(([a, b]) => from < b + F.gap && to > a - F.gap)) return null;
  // Straight from the ramp's foot to the landing slope's, where the sled
  // is on the ramp or in the air: one heading lies on the line.
  const flight = p.s + built.shape.deck + built.shape.fall;
  const i0 = Math.max(0, Math.floor(from / step));
  const i1 = Math.min(n - 1, Math.ceil(flight / step));
  for (let j = i0; j <= i1; j++) {
    if (Math.abs(angleDiff(pts[j].heading, p.heading)) > F.straight) return null;
  }
  // The line past the lip no steeper up than this, or it fills the slope.
  if ((pts[i1].y - p.y) / (flight - p.s) > F.landingGrade) return null;
  return {
    id: "",
    x: p.x,
    z: p.z,
    y: p.y,
    heading: p.heading,
    height: built.height,
    ramp: built.ramp,
    landing: built.landing,
    width: p.width + 2 * (R.track.shoulder.flat + R.berm.width),
    onTrack: true,
    s: p.s,
    trick: true,
    size,
    shape: built.shape,
  };
}

/** Stamp the planned field into the finished ground by arc length — full
 * height out to the berm's far toe, faded into the country over
 * `trick.edge` beyond it — and publish the lips' heights. `start` is the
 * index the loop was rotated by, which is how a cell of `corridor` (made
 * before the rotation) finds its arc length. */
export function stampTrickField(
  ground: Heightfield,
  field: readonly Kicker[],
  { near, along, dist }: Corridor,
  loop: Loop,
  start: number,
): void {
  const pts = loop.points;
  const n = pts.length;
  const L = loop.length;
  const step = L / n;
  const g = ground.data;
  const toe = R.track.shoulder.flat + R.berm.width;
  for (let o = 0; o < g.length; o++) {
    if (near[o] < 0) continue;
    // The corridor's map was made before the loop was re-indexed.
    const i = (near[o] - start + n) % n;
    const s = (i + along[o]) * step;
    let lift = 0;
    for (const k of field) {
      let u = s - (k.s ?? 0);
      if (u > L / 2) u -= L;
      if (u < -L / 2) u += L;
      if (u <= -k.ramp || u >= k.landing) continue;
      lift = kickerProfile(k.height, k.ramp, k.landing, u, k.shape);
      break;
    }
    if (lift === 0) continue;
    const a = pts[i].width;
    const half = (a + (pts[(i + 1) % n].width - a) * along[o]) / 2;
    const reach = half + toe;
    g[o] += (1 - smoothstep(reach, reach + R.trick.edge, dist[o])) * lift;
  }
  for (const k of field) k.y = sampleField(ground, k.x, k.z);
}
