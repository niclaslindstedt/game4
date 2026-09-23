// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCOREBOARD, held to its job: a clean map scores clean, and a map
// broken by hand in exactly one way is caught, by the rule that was broken.
// A check that never fires is not a check; each case here is the proof
// that one does.
import { describe, expect, it } from "vitest";

import { analyzeLevel, LEVEL_RULES as R, type Level } from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";

/** The rules a map's analysis finds ERRORS against. */
function errorRules(level: Level): string[] {
  return [
    ...new Set(
      analyzeLevel(level)
        .findings.filter((f) => f.severity === "error")
        .map((f) => f.rule),
    ),
  ];
}

describe("analyzeLevel", () => {
  const base = levelFor(LEVEL_SEEDS[0]);

  it("scores a generated map clean, with the numbers the rules are written in", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(a.ok, `seed ${seed}: ${JSON.stringify(a.findings)}`).toBe(true);
      expect(a.seed).toBe(seed);
      expect(a.stats.points).toBe(levelFor(seed).track.points.length);
      expect(a.stats.checkpoints).toBe(levelFor(seed).checkpoints.length);
      expect(a.stats.treesOnCorridor).toBe(0);
      expect(a.stats.trackKickers).toBeGreaterThanOrEqual(R.kickers.on.count.min);
    }
  });

  it("finds a tree standing on the track (R14)", () => {
    const p = base.track.points[300];
    const tree = { x: p.x, z: p.z, y: p.y, height: 10, radius: 0.3, crown: 2.4 };
    expect(errorRules({ ...base, trees: [...base.trees, tree] })).toContain("R14");
  });

  it("finds a spawn standing on the packed track (R10, R12)", () => {
    const p = base.track.points[0];
    const broken = errorRules({ ...base, spawn: { x: p.x, z: p.z, heading: p.heading } });
    expect(broken).toContain("R12");
    expect(broken).toContain("R10");
  });

  it("finds a spawn that does not face the start line (R12)", () => {
    expect(
      errorRules({ ...base, spawn: { ...base.spawn, heading: base.spawn.heading + 1 } }),
    ).toContain("R12");
  });

  it("finds a missing checkpoint (R11)", () => {
    const cps = base.checkpoints.filter((_, i) => i !== 3);
    expect(errorRules({ ...base, checkpoints: cps })).toContain("R11");
  });

  it("finds a track with no kicker on it (R9)", () => {
    expect(errorRules({ ...base, kickers: base.kickers.filter((k) => !k.onTrack) })).toContain(
      "R9",
    );
  });

  it("finds a loop that crosses itself (R5)", () => {
    // Swap two stretches' points: the loop now jumps across its own middle.
    const pts = base.track.points.map((p) => ({ ...p }));
    const n = pts.length;
    const a = Math.floor(n / 4);
    const b = Math.floor((3 * n) / 4);
    [pts[a], pts[b]] = [
      { ...pts[b], s: pts[a].s },
      { ...pts[a], s: pts[b].s },
    ];
    expect(errorRules({ ...base, track: { ...base.track, points: pts } })).toContain("R5");
  });

  it("finds a track too narrow for the rule (R7)", () => {
    const pts = base.track.points.map((p) => ({ ...p, width: R.track.width.min - 2 }));
    expect(errorRules({ ...base, track: { ...base.track, points: pts } })).toContain("R7");
  });

  it("finds a sun under the horizon (R15)", () => {
    expect(errorRules({ ...base, sun: { ...base.sun, hour: 2 } })).toContain("R15");
  });
});
