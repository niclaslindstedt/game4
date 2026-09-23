// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R14 — THE FOREST: snow-loaded conifers where a slow noise says woods,
// open meadows between, clearings cut out of the woods, and nothing where a
// tree would be in the race's way.
//
// Candidates stand one per `forest.spacing` cell, jittered inside it, so no
// two trunks share a cell and the wood reads as grown rather than planted
// on a lattice. Each is kept with the probability the forest noise gives
// its spot — the woods' density inside the forest, a sprinkle of lone trees
// out in the meadows — and then refused by rule: too near the track, too
// steep, too high up the rim, on a kicker, in the spawn's clearing or in
// its lane to the track. Trees are taller in the thick of a wood and down
// in the valleys, shorter at a wood's edge and up the slopes.
//
// Everything is drawn off the attempt's stream in a fixed order, so the
// same seed grows the same wood.

import { smoothstep } from "../lib/math.ts";
import { sampleField, fieldGradient, type Heightfield } from "../lib/heightfield.ts";
import { segmentDistance } from "../lib/polyline.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { onKicker } from "./kickers.ts";
import { nearestWithin, type HasTrack } from "./query.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import type { Kicker, Spawn, TrackHit, TreeDef } from "./types.ts";

/** R14 — grow the forest. */
export function growForest(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  loop: HasTrack,
  kickers: readonly Kicker[],
  spawn: Spawn,
  lane: { x: number; z: number },
): TreeDef[] {
  const F = R.forest;
  const seed = rng.int(1, 1 << 30);
  const clearings: { x: number; z: number; r: number }[] = [];
  const nClear = rng.int(F.clearings.count.min, F.clearings.count.max);
  for (let i = 0; i < nClear; i++) {
    clearings.push({
      x: rng.range(200, R.world.size - 200),
      z: rng.range(200, R.world.size - 200),
      r: inBand(rng, F.clearings.radius),
    });
  }
  const trees: TreeDef[] = [];
  const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  const cells = Math.floor(R.world.size / F.spacing);
  const spawnClear2 = R.spawn.clear * R.spawn.clear;
  const reach = R.track.width.max / 2 + F.corridor;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      // Four draws per cell whatever happens, so one refusal never shifts
      // the stream under every tree after it.
      const jx = rng.next();
      const jz = rng.next();
      const keep = rng.next();
      const size = rng.next();
      const x = (c + 0.1 + jx * 0.8) * F.spacing;
      const z = (r + 0.1 + jz * 0.8) * F.spacing;
      const n =
        valueNoise(x, z, F.scale, seed) * 0.7 + valueNoise(x, z, F.scale * 0.35, seed + 101) * 0.3;
      const woods = smoothstep(0.42, 0.58, n);
      let clear = 1;
      for (const cl of clearings) {
        const d = Math.hypot(x - cl.x, z - cl.z);
        if (d < cl.r + 12) clear = Math.min(clear, smoothstep(cl.r * 0.8, cl.r + 12, d));
      }
      const density = F.density * (F.meadow + (1 - F.meadow) * woods * clear);
      if (keep >= density) continue;
      const rim = rimAt(plan, x, z);
      if (rim > F.treeLine) continue;
      const g = fieldGradient(ground, x, z);
      if (Math.hypot(g.gx, g.gz) > F.maxSlope) continue;
      if ((x - spawn.x) ** 2 + (z - spawn.z) ** 2 < spawnClear2) continue;
      if (segmentDistance(x, z, spawn.x, spawn.z, lane.x, lane.z) < R.spawn.lane / 2) continue;
      nearestWithin(loop, x, z, reach, hit);
      if (hit.distance < loop.track.points[hit.index].width / 2 + F.corridor) continue;
      if (onKicker(kickers, x, z, 4)) continue;
      // Tall in the thick of a wood and low down, short at its edge and up
      // the flanks.
      const tall = 0.35 + 0.45 * woods + 0.2 * size - 0.5 * rim;
      const height = F.height.min + (F.height.max - F.height.min) * Math.max(0, Math.min(1, tall));
      trees.push({
        x,
        z,
        y: sampleField(ground, x, z),
        height,
        radius: F.trunk.floor + F.trunk.share * height,
        crown: F.crown * height,
      });
    }
  }
  return trees;
}
