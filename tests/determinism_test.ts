// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DETERMINISM CONTRACT: the same map, the same seed and the same inputs
// give the same run, to the bit — solo, with a field, and ridden by the bot
// through the harness. Nothing in `step` may read a clock or `Math.random`.

import { describe, expect, it } from "vitest";

import { botInput, createGame, simulateRun, step, TUNING, type GameState } from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

function fingerprint(state: GameState): string {
  const c = state.sled;
  const riders = [c, ...state.rivals.map((r) => r.run.sled)];
  return riders
    .map((s) => [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.q.w, s.q.x, s.rpm, s.treadSpeed].join(","))
    .join("|");
}

function race(seconds: number, rivals: number): string {
  const state = createGame({ level: syntheticLevel(), seed: 7, rivals, quiet: true });
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, botInput(state));
  return fingerprint(state);
}

describe("determinism", () => {
  it("a bot-ridden solo run replays exactly", () => {
    expect(race(30, 0)).toBe(race(30, 0));
  });

  it("a race with a field replays exactly", () => {
    expect(race(30, 3)).toBe(race(30, 3));
  });

  it("the harness's digest is stable", () => {
    const level = syntheticLevel({ laps: 1 });
    const a = simulateRun(1, { level });
    const b = simulateRun(1, { level: syntheticLevel({ laps: 1 }) });
    expect(a.digest).toBe(b.digest);
    expect(a.time).toBe(b.time);
  });

  it("the field's pace is dealt off the run's own seed", () => {
    const pace = (seed: number) =>
      createGame({ level: syntheticLevel(), seed, quiet: true }).rivals.map((r) => r.pace);
    expect(pace(3)).toEqual(pace(3));
    expect(pace(3)).not.toEqual(pace(4));
  });
});
