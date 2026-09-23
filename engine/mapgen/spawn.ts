// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R11–R13 — WHERE THE RACE STARTS: the spawn out in the powder, the grid
// round it, and the checkpoints down the loop from the start line nearest
// it.
//
// The race opens OFF the track. The riders stand abreast in virgin snow a
// seeded distance from the loop, facing the nearest point of it, and the
// first thing a race asks of them is the run through the powder onto the
// packed trail. That nearest point IS the start and finish line — checkpoint
// 0 — and the loop is re-indexed to begin there, so every arc length a
// reader meets is measured from the line the race is timed across.
//
// The spot is searched for, not solved for: a station drawn off the loop, a
// side, a distance inside the band, and the candidate refused on anything
// that would make the opening unfair or unrideable — ground too steep for a
// standing start, a run-in that climbs a bank, a start line on a kicker's
// ramp. The forest (R14) is grown AFTER the spawn is chosen and keeps its
// clearing and its lane, so the spawn never needs to dodge a tree.

import { sampleField, fieldGradient, type Heightfield } from "../lib/heightfield.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, withinBand } from "./rules.ts";
import { onKicker, type TrackKicker } from "./kickers.ts";
import { nearestTrackPoint, trackPointAt, type HasTrack } from "./query.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import { trackOf, type Loop } from "./track.ts";
import type { Checkpoint, Kicker, Spawn } from "./types.ts";

/** What the spawn search settles. */
export type Start = {
  readonly spawn: Spawn;
  readonly grid: Spawn[];
  /** The loop index nearest the spawn — the start line. */
  readonly start: number;
  /** Where the run-in meets the centreline. */
  readonly lane: { x: number; z: number };
};

/** R13 — the grid round a spawn: abreast across its heading, the player's
 * slot first and nearest the middle. */
export function gridAround(spawn: Spawn): Spawn[] {
  const rx = Math.cos(spawn.heading);
  const rz = -Math.sin(spawn.heading);
  const order = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5, -3.5, 3.5];
  const out: Spawn[] = [];
  for (let i = 0; i < R.grid.slots; i++) {
    const o = order[i] * R.grid.spacing;
    out.push({ x: spawn.x + rx * o, z: spawn.z + rz * o, heading: spawn.heading });
  }
  return out;
}

function slope(ground: Heightfield, x: number, z: number): number {
  const g = fieldGradient(ground, x, z);
  return Math.hypot(g.gx, g.gz);
}

/** R12 — search the powder beside the loop for the spawn. */
export function placeSpawn(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  loop: Loop,
  trackKickers: readonly TrackKicker[],
  offKickers: readonly Kicker[],
): Start | string {
  const pts = loop.points;
  const n = pts.length;
  const S = R.spawn;
  const track = trackOf(loop);
  for (let tries = 0; tries < 240; tries++) {
    const i = rng.int(0, n - 1);
    const side = rng.chance(0.5) ? 1 : -1;
    const d = rng.range(S.distance.min + 10, S.distance.max - 15);
    const p = pts[i];
    const x = p.x + Math.cos(p.heading) * side * d;
    const z = p.z - Math.sin(p.heading) * side * d;
    if (rimAt(plan, x, z) > 0) continue;
    const hit = nearestTrackPoint(track, x, z);
    if (!withinBand(hit.distance, { min: S.distance.min + 3, max: S.distance.max - 3 })) continue;
    // The start line: whichever end of the nearest segment is nearer.
    const a = hit.index;
    const b = (a + 1) % n;
    const start =
      Math.hypot(pts[a].x - x, pts[a].z - z) <= Math.hypot(pts[b].x - x, pts[b].z - z) ? a : b;
    const line = pts[start];
    const kickerNear = trackKickers.some((k) => {
      const ds = Math.abs(pts[k.index].s - line.s);
      return Math.min(ds, loop.length - ds) < S.kickerGap;
    });
    if (kickerNear) continue;
    const heading = Math.atan2(line.x - x, line.z - z);
    const spawn: Spawn = { x, z, heading };
    const grid = gridAround(spawn);
    const fair = grid.every((g) => {
      if (slope(ground, g.x, g.z) > S.maxSlope) return false;
      const gh = nearestTrackPoint(track, g.x, g.z);
      return withinBand(gh.distance, S.distance);
    });
    if (!fair || slope(ground, x, z) > S.maxSlope) continue;
    if (onKicker(offKickers, x, z, S.clear)) continue;
    // The run-in: no stretch of it climbs or falls more than the rule allows.
    const run = Math.hypot(line.x - x, line.z - z);
    const steps = Math.max(2, Math.ceil(run / 4));
    let prev = sampleField(ground, x, z);
    let steep = false;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const y = sampleField(ground, x + (line.x - x) * t, z + (line.z - z) * t);
      if (Math.abs(y - prev) / (run / steps) > S.maxRunIn) steep = true;
      prev = y;
    }
    if (steep) continue;
    return { spawn, grid, start, lane: { x: line.x, z: line.z } };
  }
  return "no spot in the powder beside the loop makes a fair start";
}

/** R11 — the checkpoints, from the start line (arc length 0) round the
 * loop, evenly spaced as near the target as divides it. */
export function layCheckpoints(level: HasTrack): Checkpoint[] {
  const L = level.track.length;
  const count = Math.max(2, Math.round(L / R.checkpoint.spacing.target));
  const spacing = L / count;
  const out: Checkpoint[] = [];
  for (let k = 0; k < count; k++) {
    const p = trackPointAt(level, k * spacing);
    out.push({
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      width: p.width + 2 * R.checkpoint.margin,
      s: p.s,
    });
  }
  return out;
}
