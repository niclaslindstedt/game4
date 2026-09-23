// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD: three rivals on the grid beside the player, each a whole run
// over the same map ridden by the bot, held by the same lights; the
// standings; and sleds that cannot pass through each other.

import { describe, expect, it } from "vitest";

import {
  createGame,
  fieldOrder,
  NEUTRAL_INPUT,
  placeRun,
  racePlace,
  RACE,
  step,
  TUNING,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

describe("the grid", () => {
  it("stands three rivals on the level's grid slots beside the player", () => {
    const level = syntheticLevel();
    const state = createGame({ level, quiet: true });
    expect(state.rivals).toHaveLength(RACE.rivals);
    expect(state.phase).toBe("countdown");
    const all = [state.sled, ...state.rivals.map((r) => r.run.sled)];
    all.forEach((s, i) => {
      expect(s.x).toBeCloseTo(level.grid[i].x, 6);
      expect(s.z).toBeCloseTo(level.grid[i].z, 6);
    });
    for (const r of state.rivals) {
      expect(r.run.level).toBe(level);
      expect(r.pace).toBeGreaterThanOrEqual(RACE.paceBand.min);
      expect(r.pace).toBeLessThanOrEqual(RACE.paceBand.max);
    }
  });

  it("holds the field under the lights and lets it go on GO", () => {
    const state = createGame({ level: syntheticLevel(), quiet: true });
    const start = state.rivals.map((r) => ({ x: r.run.sled.x, z: r.run.sled.z }));
    for (let i = 0; i < 2.5 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    state.rivals.forEach((r, i) => {
      expect(Math.hypot(r.run.sled.x - start[i].x, r.run.sled.z - start[i].z)).toBeLessThan(0.3);
    });
    for (let i = 0; i < 5 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    for (const r of state.rivals) expect(r.run.sled.speed).toBeGreaterThan(3);
  });
});

describe("the standings", () => {
  it("rank by checkpoints taken, and put a rider sitting still behind a field that is riding", () => {
    const state = createGame({ level: syntheticLevel(), quiet: true });
    expect(racePlace(state)).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 25 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    expect(racePlace(state)).toBe(RACE.rivals + 1);
    const order = fieldOrder(state);
    expect(order).toHaveLength(RACE.rivals + 1);
    expect(order[order.length - 1]).toBeNull();
    for (const r of state.rivals) expect(r.run.progress.passed).toBeGreaterThan(0);
  });
});

describe("sled against sled", () => {
  it("pushes two overlapping sleds apart and reports the player's bump", () => {
    const state = createGame({ level: syntheticLevel(), countdown: 0, quiet: true });
    placeRun(state, { x: 400, z: 300, heading: Math.PI / 2, speed: 15 });
    const rival = state.rivals[0].run;
    placeRun(rival, { x: 405, z: 300, heading: -Math.PI / 2, speed: 5 });
    let bumped = false;
    for (let i = 0; i < 60; i++) {
      step(state, { ...NEUTRAL_INPUT, throttle: 0.3 });
      if (state.events.some((e) => e.kind === "bump" && e.rival === 0)) bumped = true;
    }
    expect(bumped).toBe(true);
    const gap = Math.hypot(state.sled.x - rival.sled.x, state.sled.z - rival.sled.z);
    expect(gap).toBeGreaterThan(RACE.bump.radius);
  });
});
