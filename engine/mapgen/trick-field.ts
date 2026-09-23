// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TRICK FIELD: a run of groomed kickers down the loop, laid only on
// a map built for a TRICKS run.
//
// ON THE TRACK, because the track is where a sled already has its speed: it
// is groomed, it is clear of trees, and it goes on round — a rider who has
// taken the field comes back to the start of it without being told where
// to go. Each kicker is R9's profile (`kickerProfile`), stamped into the
// finished ground in plan across the track, its shoulders and its berms, on
// a stretch straight enough that a stamp laid along one heading lies on the
// line all the way from the ramp's foot to the landing's.
//
// GRADED, small, medium and large in turn, so a run down the field is a
// ladder: the small lip for a pose, the medium for a flip, the big one for
// the flip with a 360 in it. Steeper at the lip than R9's crests — a kicker
// built to throw a sled UP rather than along — and landed on a long slope
// falling away, so a sled that flew the ordinary distance comes down on the
// downslope rather than on the flat past it.
//
// SPACED by `trick.gap` of flat track between one landing's foot and the next
// ramp's: the run-out a rider rides away from a landing in and the run-up he
// takes the next lip at. The loop is ridden at speed, so the gap is sized to
// settle a landing, not to accelerate from rest.
//
// Nothing here draws from a stream: the stations are the loop's own, scored
// and taken in order, so asking for the field moves nothing the seed drew.

import { sampleField, type Heightfield } from "../lib/heightfield.ts";
import { angleDiff } from "../lib/math.ts";
import { stampKicker } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Loop } from "./track.ts";
import type { Kicker } from "./types.ts";

/** The arc a kicker covers, foot of the ramp to foot of the landing, m. */
function footprint(k: { s?: number; ramp: number; landing: number }): [number, number] {
  const s = k.s ?? 0;
  return [s - k.ramp, s + k.landing];
}

/** R20 — lay the field on the finished, re-indexed loop (arc length 0 at the
 * start line), stamp it into the ground and return its kickers in the order
 * they are ridden; or the reason the loop could not carry one. `taken` are
 * the kickers already on the track (R9), which the field keeps clear of. */
export function layTrickField(
  loop: Loop,
  ground: Heightfield,
  taken: readonly Kicker[],
): Kicker[] | string {
  const F = R.trick;
  const pts = loop.points;
  const n = pts.length;
  const L = loop.length;
  const step = L / n;
  // Full height out to the berms' far toes, so the windrow rides over the
  // kicker with the track rather than being buried in its cheek.
  const reach = 2 * (R.track.shoulder.flat + R.berm.width);
  const busy = taken.filter((k) => k.onTrack).map(footprint);
  const out: Kicker[] = [];
  let free = F.lead;
  for (let i = 0; i < n && out.length < F.count.max; i++) {
    const p = pts[i];
    const height = F.heights[out.length % F.heights.length];
    const ramp = height * F.ramp;
    const landing = height * F.landing;
    const from = p.s - ramp;
    const to = p.s + landing;
    if (from < free) continue;
    if (to > L - F.lead) break;
    if (busy.some(([a, b]) => from < b + F.gap && to > a - F.gap)) continue;
    // Straight over the whole footprint, so one heading lies on the line.
    const i0 = Math.max(0, Math.floor(from / step));
    const i1 = Math.min(n - 1, Math.ceil(to / step));
    let straight = true;
    for (let j = i0; j <= i1 && straight; j++) {
      straight = Math.abs(angleDiff(pts[j].heading, p.heading)) <= F.straight;
    }
    if (!straight) continue;
    // Landed on the flat or falling away, never on a climb.
    if ((pts[i1].y - p.y) / landing > F.landingGrade) continue;
    out.push({
      id: `T${out.length + 1}`,
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      height,
      ramp,
      landing,
      width: p.width + reach,
      onTrack: true,
      s: p.s,
      trick: true,
    });
    free = to + F.gap;
  }
  if (out.length < F.count.min) return `only ${out.length} trick kicker(s) fit the loop (R20)`;
  for (const k of out) {
    stampKicker(ground, k.x, k.z, k.heading, k.height, k.ramp, k.landing, k.width);
  }
  for (const k of out) k.y = sampleField(ground, k.x, k.z);
  return out;
}
