// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R11–R13 — WHERE THE RACE STARTS: the start line, the grid behind it on
// the track, and the checkpoints down the loop from the line.
//
// The race opens ON the groomer. The start line — checkpoint 0 — is a
// station of the loop searched for rather than solved for: a station drawn
// off the loop and refused on anything that would make the opening unfair
// or unrideable — a kicker's lip too near it, a bend or a slope in the
// stretch behind it the grid has to stand on. The loop is then re-indexed
// to begin there, so every arc length a reader meets is measured from the
// line the race is timed across, and the grid is laid behind it in rows
// straddling the centreline, facing along the loop.

import type { Rng } from "../lib/prng.ts";
import { angleDiff } from "../lib/math.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { TrackKicker } from "./kickers.ts";
import { trackPointAt, type HasTrack } from "./query.ts";
import type { Loop } from "./track.ts";
import type { Checkpoint, Spawn } from "./types.ts";

/** R12 — search the loop for the start line: the index of the loop point it
 * stands at, before the loop is re-indexed. */
export function chooseStart(
  rng: Rng,
  loop: Loop,
  trackKickers: readonly TrackKicker[],
): number | string {
  const pts = loop.points;
  const n = pts.length;
  const S = R.spawn;
  const step = loop.length / n;
  const back = Math.ceil(S.run / step);
  for (let tries = 0; tries < 240; tries++) {
    const i = rng.int(0, n - 1);
    const line = pts[i];
    const kickerNear = trackKickers.some((k) => {
      const ds = Math.abs(pts[k.index].s - line.s);
      return Math.min(ds, loop.length - ds) < S.kickerGap;
    });
    if (kickerNear) continue;
    let fit = true;
    for (let k = 1; k <= back && fit; k++) {
      const a = pts[(i - k + 1 + n) % n];
      const b = pts[(i - k + n) % n];
      if (Math.abs(angleDiff(b.heading, line.heading)) > S.straight) fit = false;
      if (Math.abs(a.y - b.y) / step > S.maxSlope) fit = false;
    }
    if (fit) return i;
  }
  return "no station on the loop makes a fair start";
}

/** R13 — the grid behind the start line of a loop already re-indexed to
 * begin there: rows straddling the centreline, facing along the loop, the
 * player's slot first. The spawn is the front row's centreline point. */
export function gridOnTrack(level: HasTrack): { spawn: Spawn; grid: Spawn[] } {
  const G = R.grid;
  const L = level.track.length;
  const at = (s: number): Spawn => {
    const p = trackPointAt(level, s);
    return { x: p.x, z: p.z, heading: p.heading };
  };
  const spawn = at(L - G.back);
  const grid: Spawn[] = [];
  for (let slot = 0; slot < G.slots; slot++) {
    const row = Math.floor(slot / G.abreast);
    const col = slot % G.abreast;
    const c = at(L - G.back - row * G.row);
    const o = (col - (G.abreast - 1) / 2) * G.spacing;
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    grid.push({ x: c.x + rx * o, z: c.z + rz * o, heading: c.heading });
  }
  return { spawn, grid };
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
