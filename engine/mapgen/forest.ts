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
// steep, too high up the rim, on a kicker, or too near a tree already
// standing. That last refusal is what makes a wood RIDEABLE: no two trunks
// stand closer than `forest.gap`, and no crown spreads wider than
// `forest.crownMax`, so between any two trees there is a lane a sled fits
// through under the boughs. Trees are taller in the thick of a wood and down
// in the valleys, shorter at a wood's edge and up the slopes.
//
// Everything is drawn off the attempt's stream in a fixed order, so the
// same seed grows the same wood.
//
// THE REGION (R21) moves the numbers and draws nothing: its row thins or
// thickens the woods, stunts them, pulls the tree line down, keeps a high
// basin's trees to its hollows (`lowland`), names what grows (off a hash of
// where the trunk stands, `treeKindAt`), and keeps every trunk off a frozen
// river's ice. The boreal's row is all ones, so its wood is the one the
// rules grew before there were regions.

import { cellKey, smoothstep } from "../lib/math.ts";
import { sampleField, fieldGradient, type Heightfield } from "../lib/heightfield.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { onKicker } from "./kickers.ts";
import { treeKindAt } from "./regions.ts";
import { nearestWithin, type HasTrack } from "./query.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import type { Kicker, TrackHit, TreeDef } from "./types.ts";

/** R14 — grow the forest. */
export function growForest(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  loop: HasTrack,
  kickers: readonly Kicker[],
  ice: Heightfield | null = null,
): TreeDef[] {
  const F = R.forest;
  const W = plan.region.forest;
  const density = F.density * W.density;
  const meadow = Math.min(1, F.meadow * W.meadow);
  const treeLine = F.treeLine * W.treeLine;
  let lowland = Infinity;
  if (W.lowland !== null) {
    let sum = 0;
    for (const p of loop.track.points) sum += p.y;
    lowland = sum / Math.max(1, loop.track.points.length) + W.lowland;
  }
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
  // THE GAP: every tree kept is filed in a hash of `gap`-sized buckets, so a
  // candidate asks only the nine round it whether one stands too near.
  const gap2 = F.gap * F.gap;
  const buckets = new Map<number, TreeDef[]>();
  const bucketOf = (v: number): number => Math.floor(v / F.gap);
  const crowded = (x: number, z: number): boolean => {
    const bx = bucketOf(x);
    const bz = bucketOf(z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const near = buckets.get(cellKey(bx + dx, bz + dz));
        if (near?.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < gap2)) return true;
      }
    }
    return false;
  };
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
      const share = density * (meadow + (1 - meadow) * woods * clear);
      if (keep >= share) continue;
      const rim = rimAt(plan, x, z);
      if (rim > treeLine) continue;
      if (
        lowland !== Infinity &&
        sampleField(ground, x, z) > lowland + (valueNoise(x, z, 90, seed + 7) - 0.5) * 8
      ) {
        continue;
      }
      if (ice && sampleField(ice, x, z) > 0) continue;
      const g = fieldGradient(ground, x, z);
      if (Math.hypot(g.gx, g.gz) > F.maxSlope) continue;
      nearestWithin(loop, x, z, reach, hit);
      if (hit.distance < loop.track.points[hit.index].width / 2 + F.corridor) continue;
      if (onKicker(kickers, x, z, 4)) continue;
      if (crowded(x, z)) continue;
      // Tall in the thick of a wood and low down, short at its edge and up
      // the flanks.
      const tall = 0.35 + 0.45 * woods + 0.2 * size - 0.5 * rim;
      const height =
        F.height.min + (F.height.max - F.height.min) * Math.max(0, Math.min(1, tall)) * W.height;
      const tree: TreeDef = {
        x,
        z,
        y: sampleField(ground, x, z),
        height,
        radius: F.trunk.floor + F.trunk.share * height,
        crown: Math.min(F.crownMax, F.crown * height),
      };
      const kind = treeKindAt(plan.region, x, z);
      if (kind !== "spruce") tree.kind = kind;
      trees.push(tree);
      const key = cellKey(bucketOf(x), bucketOf(z));
      const list = buckets.get(key);
      if (list) list.push(tree);
      else buckets.set(key, [tree]);
    }
  }
  return trees;
}
