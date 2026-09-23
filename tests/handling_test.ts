// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A SLED TURNS, and what the lever does to it (`sled.ts`, the arcade's
// hands in `TUNING.arcade` and `TUNING.steer`). A crossover at full lock on
// the groomer holds past a g and settles into its bend in a tenth of a
// second; the snow pushes back along its own normal, so a chassis rolled on
// its springs is not shoved out of the turn; the lever moves the load the
// way the physics of a sled says — throttle off the skis and wide, a lift or
// the brake onto them and tighter — and a pinned brake never locks the belt
// on the snow (the rider's thumb).

import { describe, expect, it } from "vitest";
import { SLED, TUNING, createGame, placeRun, step, type GameState } from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });

function bend(kmh: number): GameState {
  const state = createGame({ level: PACKED, spec: SLED, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 400, heading: 0, speed: kmh / 3.6 });
  return state;
}

/** Throttle and brake that hold `kmh`. */
function hold(state: GameState, kmh: number) {
  const err = kmh / 3.6 - state.sled.speed;
  return {
    throttle: Math.min(1, Math.max(0, 0.35 + 0.5 * err)),
    brake: Math.min(1, Math.max(0, -0.5 * err - 0.4)),
  };
}

const skiShareNow = (s: GameState) => {
  const c = s.sled.contacts;
  const all = c.reduce((sum, p) => sum + p.load, 0);
  return (c[0].load + c[1].load) / all;
};

function settle(state: GameState, steer: number, seconds: number, kmh: number) {
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, { steer, lean: 0, reset: false, ...hold(state, kmh) });
  }
}

describe("the bend", () => {
  it("holds past a g on the groomer at full lock, and turns in at once", () => {
    const state = bend(70);
    settle(state, 0, 0.5, 70);
    let t90 = -1;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, lean: 0, reset: false, ...hold(state, 70) });
      if (t90 < 0 && Math.abs(state.sled.wy) > 0.5) t90 = i * TUNING.dt;
    }
    const g = (state.sled.speed * Math.abs(state.sled.wy)) / TUNING.g;
    expect(g).toBeGreaterThan(1.05);
    expect(t90).toBeGreaterThan(0);
    expect(t90).toBeLessThan(0.2);
  });

  it("unloads the skis and runs wide on the throttle, tightens on a lift", () => {
    const power = bend(70);
    settle(power, 0.6, 3, 70);
    const ski0 = skiShareNow(power);
    const yaw0 = Math.abs(power.sled.wy);
    const lift = bend(70);
    settle(lift, 0.6, 3, 70);
    for (let i = 0; i < TUNING.physicsHz; i++) {
      step(power, { steer: 0.6, throttle: 1, brake: 0, lean: 0, reset: false });
      step(lift, { steer: 0.6, throttle: 0, brake: 0, lean: 0, reset: false });
    }
    expect(skiShareNow(power)).toBeLessThan(ski0);
    expect(skiShareNow(lift)).toBeGreaterThan(ski0);
    expect(Math.abs(lift.sled.wy)).toBeGreaterThan(yaw0);
  });

  it("never lets a pinned brake lock the belt on the snow", () => {
    const state = bend(100);
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { steer: 0.4, throttle: 0, brake: 1, lean: 0, reset: false });
      const c = state.sled;
      if (!c.airborne && c.way > TUNING.arcade.brakeSlip + 1) {
        expect(c.treadSpeed).toBeGreaterThan(c.way - TUNING.arcade.brakeSlip - 1);
      }
    }
  });
});
