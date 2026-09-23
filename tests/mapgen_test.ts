// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD GENERATOR, held to its rule book across a corpus of seeds: the
// map is a pure function of its seed, it publishes the Level contract every
// reader codes against, and every R-rule a rider would feel — the closed
// loop, its width, its grade, the packed snow, the kickers, the spawn in the
// powder, the checkpoints from the start line, the clear corridor — holds
// on every map, measured off what the map PUBLISHES.
import { describe, expect, it } from "vitest";

import {
  dealDrifts,
  generateLevel,
  LEVEL_RULES as R,
  nearestTrackPoint,
  subSeed,
  trackPointAt,
  withinBand,
  type GeneratedLevel,
} from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";

const corpus = (): GeneratedLevel[] => LEVEL_SEEDS.map(levelFor);

/** A cheap fingerprint of a float array. */
function digest(data: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < data.length; i += 7) h = (h * 31 + Math.round(data[i] * 1000)) | 0;
  return h;
}

describe("the generator is a pure function of its seed", () => {
  it("builds the same map twice from one seed, and a different map from another", () => {
    const a = generateLevel(1234);
    const b = generateLevel(1234);
    expect(digest(a.ground.data)).toBe(digest(b.ground.data));
    expect(digest(a.packed.data)).toBe(digest(b.packed.data));
    expect(a.track.points).toEqual(b.track.points);
    expect(a.trees).toEqual(b.trees);
    expect(a.checkpoints).toEqual(b.checkpoints);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.grid).toEqual(b.grid);
    expect(a.kickers).toEqual(b.kickers);
    expect(a.sun).toEqual(b.sun);
    const c = generateLevel(1235);
    expect(digest(c.ground.data)).not.toBe(digest(a.ground.data));
  });

  it("builds a map in well under the budget a test suite can afford", () => {
    const t0 = performance.now();
    generateLevel(99);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe("the Level contract", () => {
  it("publishes every field, in its units", () => {
    for (const level of corpus()) {
      expect(level.size).toBe(R.world.size);
      expect(level.cell).toBe(R.world.cell);
      expect(level.ground.cols).toBe(R.world.size / R.world.cell + 1);
      expect(level.ground.rows).toBe(level.ground.cols);
      expect(level.packed.cols).toBe(level.ground.cols);
      expect(level.track.closed).toBe(true);
      expect(level.laps).toBe(R.race.laps);
      expect(level.grid).toHaveLength(R.grid.slots);
      expect(level.trees.length).toBeGreaterThan(1000);
      expect(level.checkpoints.length).toBeGreaterThan(10);
      for (const t of level.trees.slice(0, 200)) {
        expect(withinBand(t.height, R.forest.height)).toBe(true);
        expect(t.radius).toBeGreaterThan(0.1);
        expect(t.crown).toBeGreaterThan(t.radius);
        expect(t.y).toBeCloseTo(level.groundAt(t.x, t.z), 3);
      }
    }
  });

  it("answers groundAt, normalAt and packedAt off the baked grids", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const n = { x: 0, y: 0, z: 0 };
    for (const p of level.track.points.filter((_, i) => i % 50 === 0)) {
      expect(level.groundAt(p.x, p.z)).toBeCloseTo(p.y, 4);
      level.normalAt(p.x, p.z, n);
      expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
      expect(n.y).toBeGreaterThan(0.95);
    }
    // Off the map the grids clamp to their edge rather than reading a hole.
    expect(Number.isFinite(level.groundAt(-50, -50))).toBe(true);
    expect(level.packedAt(-50, -50)).toBe(0);
  });

  it("deals a clear winter day (R15)", () => {
    for (const level of corpus()) {
      expect(withinBand(level.sun.hour, R.sun.hour)).toBe(true);
      expect(withinBand(level.sun.latitude, R.sun.latitude)).toBe(true);
      expect(withinBand(level.sun.dayOfYear, R.sun.dayOfYear)).toBe(true);
      expect(analysisFor(level.seed).stats.sunElevation).toBeGreaterThanOrEqual(
        R.sun.minElevation - 0.05,
      );
    }
  });

  it("passes its own analysis on every seed of the corpus", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(
        a.findings.filter((f) => f.severity === "error"),
        `seed ${seed}`,
      ).toEqual([]);
    }
  });
});

describe("the loop (R5–R8)", () => {
  it("is closed, evenly sampled from arc length 0, and in its length band", () => {
    for (const level of corpus()) {
      const pts = level.track.points;
      const L = level.track.length;
      expect(withinBand(L, R.track.length)).toBe(true);
      expect(pts[0].s).toBe(0);
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        expect(pts[i].s).toBeGreaterThan(pts[i - 1].s);
        expect(d).toBeGreaterThan(R.track.step * 0.8);
        expect(d).toBeLessThan(R.track.step * 1.2);
      }
      const last = pts[pts.length - 1];
      expect(Math.hypot(pts[0].x - last.x, pts[0].z - last.z)).toBeLessThan(R.track.step * 1.2);
      expect(L - last.s).toBeCloseTo(L / pts.length, 6);
    }
  });

  it("never crosses itself, and no two stretches share a corridor", () => {
    for (const level of corpus()) {
      const a = analysisFor(level.seed);
      expect(a.findings.filter((f) => f.rule === "R5")).toEqual([]);
      expect(a.stats.minSeparation).toBeGreaterThanOrEqual(R.track.separation.plan - 0.5);
    }
  });

  it("turns no tighter than the rule, and stays in its width band", () => {
    for (const level of corpus()) {
      expect(analysisFor(level.seed).stats.minRadius).toBeGreaterThanOrEqual(
        R.track.minRadius - 0.5,
      );
      for (const p of level.track.points) expect(withinBand(p.width, R.track.width)).toBe(true);
    }
  });

  it("is graded: level across, and no steeper than the rule along, outside the kickers", () => {
    for (const level of corpus()) {
      const s = analysisFor(level.seed).stats;
      expect(s.maxGrade).toBeLessThanOrEqual(R.track.maxGrade + 0.01);
      expect(s.maxCrossSlope).toBeLessThan(0.05);
    }
  });

  it("is packed on the centreline and powder a few metres past the edge (R10)", () => {
    for (const level of corpus()) {
      const F = R.drift.fade;
      const drifted = (s: number): boolean =>
        level.drifts.some((d) => s > d.from - F && s < d.to + F);
      for (const p of level.track.points.filter((_, i) => i % 7 === 0)) {
        if (!drifted(p.s)) expect(level.packedAt(p.x, p.z)).toBeGreaterThan(0.98);
        const off = p.width / 2 + R.track.shoulder.packed + 3;
        const rx = Math.cos(p.heading);
        const rz = -Math.sin(p.heading);
        expect(level.packedAt(p.x + rx * off, p.z + rz * off)).toBeLessThan(0.02);
        expect(level.packedAt(p.x - rx * off, p.z - rz * off)).toBeLessThan(0.02);
      }
    }
  });
});

describe("the kickers (R4, R9)", () => {
  it("puts at least one kicker on the track on nearly every seed", () => {
    const withKicker = corpus().filter((l) => l.kickers.some((k) => k.onTrack)).length;
    expect(withKicker).toBeGreaterThanOrEqual(Math.ceil(LEVEL_SEEDS.length * 0.75));
  });

  it("makes every track kicker a crest a sled leaves the ground over", () => {
    for (const level of corpus()) {
      for (const k of level.kickers.filter((k) => k.onTrack)) {
        const at = (u: number): number => {
          const p = trackPointAt(level, (k.s ?? 0) + u);
          return level.groundAt(p.x, p.z);
        };
        // Up the ramp to the lip, then down: the grade breaks at the lip.
        expect(at(0) - at(-k.ramp)).toBeGreaterThan(k.height * 0.6);
        expect((at(0) - at(-2)) / 2 - (at(2) - at(0)) / 2).toBeGreaterThan(0.15);
      }
    }
  });

  it("keeps the kickers off the track clear of it", () => {
    for (const level of corpus()) {
      for (const k of level.kickers.filter((k) => !k.onTrack)) {
        const reach = Math.max(k.ramp, k.landing) + k.width / 2;
        expect(nearestTrackPoint(level, k.x, k.z).distance - reach).toBeGreaterThan(
          R.kickers.off.clearance,
        );
      }
    }
  });
});

describe("the start (R11–R13)", () => {
  it("stands the spawn in powder inside its distance band, facing the start line", () => {
    for (const level of corpus()) {
      const hit = nearestTrackPoint(level, level.spawn.x, level.spawn.z);
      expect(withinBand(hit.distance, R.spawn.distance)).toBe(true);
      expect(level.packedAt(level.spawn.x, level.spawn.z)).toBe(0);
      const p0 = level.track.points[0];
      const aim = Math.atan2(p0.x - level.spawn.x, p0.z - level.spawn.z);
      const diff = Math.atan2(
        Math.sin(aim - level.spawn.heading),
        Math.cos(aim - level.spawn.heading),
      );
      expect(Math.abs(diff)).toBeLessThan(1e-9);
      for (const t of level.trees) {
        expect(Math.hypot(t.x - level.spawn.x, t.z - level.spawn.z)).toBeGreaterThanOrEqual(
          R.spawn.clear,
        );
      }
    }
  });

  it("makes checkpoint 0 the track point nearest the spawn, the loop starting there", () => {
    for (const level of corpus()) {
      const pts = level.track.points;
      let best = 0;
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - level.spawn.x, pts[i].z - level.spawn.z);
        if (d < Math.hypot(pts[best].x - level.spawn.x, pts[best].z - level.spawn.z)) best = i;
      }
      expect(best).toBe(0);
      const c0 = level.checkpoints[0];
      expect(c0.s).toBe(0);
      expect(c0.x).toBeCloseTo(pts[0].x, 6);
      expect(c0.z).toBeCloseTo(pts[0].z, 6);
    }
  });

  it("spaces the checkpoints inside their band, on the line, across the track", () => {
    for (const level of corpus()) {
      const cps = level.checkpoints;
      for (let i = 0; i < cps.length; i++) {
        const next = i + 1 < cps.length ? cps[i + 1].s : level.track.length;
        expect(withinBand(next - cps[i].s, R.checkpoint.spacing)).toBe(true);
        expect(nearestTrackPoint(level, cps[i].x, cps[i].z).distance).toBeLessThan(0.1);
        const p = trackPointAt(level, cps[i].s);
        expect(cps[i].width).toBeCloseTo(p.width + 2 * R.checkpoint.margin, 6);
      }
    }
  });

  it("stands the grid abreast across the spawn's heading", () => {
    for (const level of corpus()) {
      const [player, ...rest] = level.grid;
      for (const g of level.grid) expect(g.heading).toBe(level.spawn.heading);
      // The player's slot is the nearest the middle.
      const mid = Math.hypot(player.x - level.spawn.x, player.z - level.spawn.z);
      for (const g of rest) {
        expect(Math.hypot(g.x - level.spawn.x, g.z - level.spawn.z)).toBeGreaterThanOrEqual(
          mid - 1e-9,
        );
        expect(Math.hypot(g.x - player.x, g.z - player.z)).toBeGreaterThanOrEqual(
          R.grid.spacing - 1e-9,
        );
      }
    }
  });
});

describe("the drifts (R17)", () => {
  it("lays every drift in its band, apart, clear of the line and of every kicker", () => {
    for (const level of corpus()) {
      const L = level.track.length;
      const F = R.drift.fade;
      level.drifts.forEach((d, i) => {
        expect(d.to - d.from).toBeGreaterThanOrEqual(R.drift.length.min - 1);
        expect(d.to - d.from).toBeLessThanOrEqual(R.drift.length.max + 1);
        expect(d.from - F).toBeGreaterThanOrEqual(R.drift.clear - 1);
        expect(d.to + F).toBeLessThanOrEqual(L - R.drift.clear + 1);
        const next = level.drifts[i + 1];
        if (next) expect(next.from - d.to).toBeGreaterThanOrEqual(R.drift.gap + 2 * F - 1);
        for (const k of level.kickers.filter((kk) => kk.onTrack)) {
          const s0 = k.s ?? 0;
          expect(d.from - F >= s0 + k.landing || d.to + F <= s0 - k.ramp).toBe(true);
        }
      });
    }
  });

  it("drifts the track's whole width over the core of every stretch", () => {
    for (const level of corpus()) {
      for (const d of level.drifts) {
        for (let s = d.from; s <= d.to; s += 10) {
          const p = trackPointAt(level, s);
          const rx = Math.cos(p.heading);
          const rz = -Math.sin(p.heading);
          for (const u of [-0.45, 0, 0.45]) {
            const x = p.x + rx * u * p.width;
            const z = p.z + rz * u * p.width;
            expect(level.packedAt(x, z)).toBeLessThan(R.drift.packed + 0.05);
          }
        }
      }
    }
  });

  it("deals some maps a groomer and some a powder run", () => {
    // The dealer itself over a sweep of streams, since eight maps are a
    // sample: the share spans the band, and never runs far past its top.
    const L = 3000;
    const shares = Array.from(
      { length: 64 },
      (_, i) => dealDrifts(subSeed(i + 1, 0), L, []).reduce((a, d) => a + d.to - d.from, 0) / L,
    );
    for (const share of shares) {
      expect(share).toBeLessThanOrEqual(R.drift.share.max + R.drift.length.min / L + 0.01);
    }
    expect(Math.min(...shares)).toBeLessThan(0.08);
    expect(Math.max(...shares)).toBeGreaterThan(0.35);
    // ...and the maps carry what they were dealt.
    for (const level of corpus()) {
      const lvl = level.drifts.reduce((a, d) => a + d.to - d.from, 0) / level.track.length;
      expect(lvl).toBeLessThanOrEqual(R.drift.share.max + 0.08);
    }
  });
});

describe("the forest (R14)", () => {
  it("stands no tree on the track's corridor", () => {
    for (const level of corpus()) {
      for (const t of level.trees) {
        const hit = nearestTrackPoint(level, t.x, t.z);
        const edge = level.track.points[hit.index].width / 2;
        expect(hit.distance).toBeGreaterThanOrEqual(edge + R.forest.corridor - 0.5);
      }
    }
  });
});

describe("the track queries", () => {
  it("nearestTrackPoint agrees with walking every segment", () => {
    const level = levelFor(LEVEL_SEEDS[1]);
    const pts = level.track.points;
    for (let k = 0; k < 60; k++) {
      const x = 100 + ((k * 397) % 1400);
      const z = 100 + ((k * 761) % 1400);
      let best = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
      }
      expect(nearestTrackPoint(level, x, z).distance).toBeCloseTo(best, 6);
    }
  });

  it("signs the lateral offset positive to the right of travel", () => {
    const level = levelFor(LEVEL_SEEDS[2]);
    const p = level.track.points[100];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const right = nearestTrackPoint(level, p.x + rx * 4, p.z + rz * 4);
    const left = nearestTrackPoint(level, p.x - rx * 4, p.z - rz * 4);
    expect(right.lateral).toBeCloseTo(4, 1);
    expect(left.lateral).toBeCloseTo(-4, 1);
    expect(right.s).toBeCloseTo(p.s, 0);
  });

  it("trackPointAt interpolates the loop and wraps past its end", () => {
    const level = levelFor(LEVEL_SEEDS[3]);
    const L = level.track.length;
    const p = level.track.points[37];
    const q = trackPointAt(level, p.s);
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.z).toBeCloseTo(p.z, 9);
    const a = trackPointAt(level, 5);
    const b = trackPointAt(level, L + 5);
    const c = trackPointAt(level, 5 - L);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(c.z).toBeCloseTo(a.z, 9);
    // Across the join, between the last point and the first.
    const j = trackPointAt(level, L - 0.5);
    expect(Math.hypot(j.x - level.track.points[0].x, j.z - level.track.points[0].z)).toBeLessThan(
      R.track.step,
    );
  });
});
