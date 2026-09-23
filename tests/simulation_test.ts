// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT GETS ROUND: on the synthetic stadium, and on generated maps. What
// the harness reports is held to the race's own shape — every crossing
// credited, a lap time per lap — and to a pace floor, so a sled or a bot
// that quietly stopped racing fails here rather than in the table.

import { describe, expect, it } from "vitest";

import { generateLevel, simulateRun } from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

describe("the bot on the synthetic stadium", () => {
  it("finishes three laps with no reset and no tree hit", () => {
    const r = simulateRun(1, { level: syntheticLevel() });
    expect(r.finished).toBe(true);
    expect(r.laps).toBe(3);
    expect(r.lapTimes).toHaveLength(3);
    expect(r.checkpoints).toBe(r.crossings);
    expect(r.resets).toBe(0);
    expect(r.treeHits).toBe(0);
    expect(r.wipeouts).toBe(0);
    expect(r.meanSpeed * 3.6).toBeGreaterThan(60);
    expect(r.jumps).toBeGreaterThanOrEqual(3);
  });
});

describe("the bot on generated maps", () => {
  for (const seed of [1, 2, 3]) {
    it(`finishes seed ${seed}`, () => {
      const level = generateLevel(seed);
      const r = simulateRun(seed, { level });
      expect(r.finished).toBe(true);
      expect(r.checkpoints).toBe(r.crossings);
      expect(r.meanSpeed * 3.6).toBeGreaterThan(55);
      expect(r.autoResets).toBeLessThanOrEqual(1);
      // A clean ride never comes near a wipeout's thresholds (`TUNING.crash`).
      expect(r.wipeouts).toBe(0);
      expect(r.airTime).toBeGreaterThan(0);
    });
  }

  it("races a field and finishes on the podium or behind it, never lost", () => {
    const r = simulateRun(2, { rivals: 3, laps: 1 });
    expect(r.finished).toBe(true);
    expect(r.place).toBeGreaterThanOrEqual(1);
    expect(r.place).toBeLessThanOrEqual(4);
  });
});
