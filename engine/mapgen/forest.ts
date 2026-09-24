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
// steep, too high up the rim, on a kicker, on a lane, or too near a tree
// already standing. That last refusal is what makes a wood RIDEABLE: no two
// trunks stand closer than `forest.gap`, and no crown spreads wider than
// `forest.crownMax`, so between any two trees there is a lane a sled fits
// through under the boughs. Trees are taller in the thick of a wood and down
// in the valleys, shorter at a wood's edge and up the slopes.
//
// A REAL WOOD GROUPS, and it is not a wall. So before the scan (from
// version 3 on) the woods grow CLUMPS — a few trunks close round a centre,
// one kind to a clump: a spruce thicket, a birch stand off one root, a
// tree island out in a meadow — and every trunk outside a clump keeps the
// whole `forest.gap` from it, so a clump is a thing a sled rides ROUND.
// Winding LANES are cut through every wood (no trunk on them — the old
// tracks a rider can follow and see down), and between them the woods keep
// `forest.open` of their density, so the eye goes in among the trunks.
// Clumps and lanes are placed off hashes of the forest's own seed, never
// the stream: the four draws a cell makes are the same in every version,
// so the day drawn after the forest never moves.
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
import { hash2, valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { onCliff } from "./cliffs.ts";
import { onKicker } from "./kickers.ts";
import { treeKindAt } from "./regions.ts";
import { nearestWithin, type HasTrack } from "./query.ts";
import { rimAt, type TerrainPlan } from "./terrain.ts";
import type { Cliff, Kicker, TrackHit, TreeDef } from "./types.ts";
import type { GeneratorTraits } from "./versions.ts";

/** R14 — grow the forest. */
export function growForest(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  loop: HasTrack,
  kickers: readonly Kicker[],
  ice: Heightfield | null = null,
  cliffs: readonly Cliff[] = [],
  traits: Pick<GeneratorTraits, "scatteredForest"> = {},
): TreeDef[] {
  const F = R.forest;
  const W = plan.region.forest;
  const scattered = traits.scatteredForest === true;
  const density = F.density * W.density * (scattered ? 1 : F.open);
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
  /** How wooded a spot is (0 meadow … 1 the thick of a wood), and how far
   * out of a clearing (0 in one … 1 clear of them all). */
  const woodsAt = (x: number, z: number): { woods: number; clear: number } => {
    const n =
      valueNoise(x, z, F.scale, seed) * 0.7 + valueNoise(x, z, F.scale * 0.35, seed + 101) * 0.3;
    let clear = 1;
    for (const cl of clearings) {
      const d = Math.hypot(x - cl.x, z - cl.z);
      if (d < cl.r + 12) clear = Math.min(clear, smoothstep(cl.r * 0.8, cl.r + 12, d));
    }
    return { woods: smoothstep(0.42, 0.58, n), clear };
  };
  // THE LANES: each family a set of parallel lines at a heading of its own,
  // bent by a slow noise. The distance to the nearest line is the across-
  // lane coordinate's distance to a multiple of the spacing, divided by
  // that coordinate's gradient — the bend makes a lane wider where it
  // swings and narrower where it straightens, and this reads the true one.
  const L = F.lanes;
  const lanes = scattered
    ? []
    : Array.from({ length: L.families }, (_, j) => ({
        cos: Math.cos(hash2(j, 1, seed) * Math.PI),
        sin: Math.sin(hash2(j, 1, seed) * Math.PI),
        offset: hash2(j, 2, seed) * L.spacing,
        noise: seed + 300 + j,
      }));
  const bend = (x: number, z: number, noise: number): number =>
    (valueNoise(x, z, L.scale, noise) - 0.5) * 2 * L.swing;
  const onLane = (x: number, z: number): boolean => {
    for (const lane of lanes) {
      const w = bend(x, z, lane.noise);
      const u = x * lane.cos + z * lane.sin + w - lane.offset;
      const d = Math.abs(u - L.spacing * Math.round(u / L.spacing));
      if (d > L.width) continue;
      const gx = lane.cos + (bend(x + 1, z, lane.noise) - w);
      const gz = lane.sin + (bend(x, z + 1, lane.noise) - w);
      if (d / Math.max(0.2, Math.hypot(gx, gz)) < L.width / 2) return true;
    }
    return false;
  };
  const trees: TreeDef[] = [];
  const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  const reach = R.track.width.max / 2 + F.corridor;
  /** Whether no tree may stand here at all; `rim` is how far up the rim. */
  const refused = (x: number, z: number, rim: number): boolean => {
    if (rim > treeLine) return true;
    if (
      lowland !== Infinity &&
      sampleField(ground, x, z) > lowland + (valueNoise(x, z, 90, seed + 7) - 0.5) * 8
    ) {
      return true;
    }
    if (ice && sampleField(ice, x, z) > 0) return true;
    const g = fieldGradient(ground, x, z);
    if (Math.hypot(g.gx, g.gz) > F.maxSlope) return true;
    nearestWithin(loop, x, z, reach, hit);
    if (hit.distance < loop.track.points[hit.index].width / 2 + F.corridor) return true;
    if (onKicker(kickers, x, z, 4)) return true;
    if (onCliff(cliffs, x, z, 4)) return true;
    return lanes.length > 0 && onLane(x, z);
  };
  // THE GAP: every tree kept is filed in a hash of `gap`-sized buckets, so a
  // candidate asks only the nine round it whether one stands too near — the
  // whole gap from any tree, a clump's own gap from its own clump's.
  const gap2 = F.gap * F.gap;
  const clumpGap2 = F.clumps.gap * F.clumps.gap;
  const buckets = new Map<number, TreeDef[]>();
  const bucketOf = (v: number): number => Math.floor(v / F.gap);
  const crowded = (x: number, z: number, clump: number): boolean => {
    const bx = bucketOf(x);
    const bz = bucketOf(z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const near = buckets.get(cellKey(bx + dx, bz + dz));
        if (!near) continue;
        for (const t of near) {
          const need = clump >= 0 && t.clump === clump ? clumpGap2 : gap2;
          if ((t.x - x) ** 2 + (t.z - z) ** 2 < need) return true;
        }
      }
    }
    return false;
  };
  const stand = (x: number, z: number, height: number, clump: number, kx: number, kz: number) => {
    const tree: TreeDef = {
      x,
      z,
      y: sampleField(ground, x, z),
      height,
      radius: F.trunk.floor + F.trunk.share * height,
      crown: Math.min(F.crownMax, F.crown * height),
    };
    const kind = treeKindAt(plan.region, kx, kz);
    if (kind !== "spruce") tree.kind = kind;
    if (clump >= 0) tree.clump = clump;
    trees.push(tree);
    const key = cellKey(bucketOf(x), bucketOf(z));
    const list = buckets.get(key);
    if (list) list.push(tree);
    else buckets.set(key, [tree]);
  };
  /** Tall in the thick of a wood and low down, short at its edge and up the
   * flanks. */
  const heightOf = (woods: number, size: number, rim: number): number => {
    const tall = 0.35 + 0.45 * woods + 0.2 * size - 0.5 * rim;
    return F.height.min + (F.height.max - F.height.min) * Math.max(0, Math.min(1, tall)) * W.height;
  };

  // ── THE CLUMPS, before the scan: every trunk the scan stands after keeps
  // the whole gap from them. One chance a cell, off the forest's seed. ──────
  if (!scattered) {
    const C = F.clumps;
    const clumpCells = Math.floor(R.world.size / C.spacing);
    let id = 0;
    for (let r = 0; r < clumpCells; r++) {
      for (let c = 0; c < clumpCells; c++) {
        const cx = (c + 0.2 + 0.6 * hash2(c, r, seed + 11)) * C.spacing;
        const cz = (r + 0.2 + 0.6 * hash2(c, r, seed + 12)) * C.spacing;
        const { woods, clear } = woodsAt(cx, cz);
        const odds = (C.meadow + (C.woods - C.meadow) * woods) * clear * W.density;
        if (hash2(c, r, seed + 13) >= odds) continue;
        const want =
          C.trees.min + Math.floor(hash2(c, r, seed + 14) * (C.trees.max - C.trees.min + 1));
        const size = hash2(c, r, seed + 15);
        let grown = 0;
        // Tries round the centre, nearest first, until the clump is whole.
        for (let k = 0; k < want * 4 && grown < want; k++) {
          const a = hash2(k, id, seed + 16) * Math.PI * 2;
          const d = C.radius * Math.sqrt((k + hash2(k, id, seed + 17)) / (want * 4));
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          const rim = rimAt(plan, x, z);
          if (refused(x, z, rim) || crowded(x, z, id)) continue;
          const own = size * 0.8 + hash2(k, id, seed + 18) * 0.2;
          stand(x, z, heightOf(woods, own, rim), id, cx, cz);
          grown++;
        }
        if (grown > 0) id++;
      }
    }
  }

  // ── THE SCAN: a candidate a cell ──────────────────────────────────────────
  const cells = Math.floor(R.world.size / F.spacing);
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
      const { woods, clear } = woodsAt(x, z);
      const share = density * (meadow + (1 - meadow) * woods * clear);
      if (keep >= share) continue;
      const rim = rimAt(plan, x, z);
      if (refused(x, z, rim)) continue;
      if (crowded(x, z, -1)) continue;
      stand(x, z, heightOf(woods, size, rim), -1, x, z);
    }
  }
  return trees;
}
