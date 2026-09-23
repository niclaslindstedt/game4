// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED ON THE SNOW: it stands at its rest sag, sinks into powder and not
// into the groomed track, gets going, reaches the top speed the spec
// documents, is slower in powder, turns, and stops. Staged on the synthetic
// drag strips (`support/synthetic.ts`) with `placeRun`, ridden by scripted
// input through the real step.

import { describe, expect, it } from "vitest";

import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  SLED,
  step,
  TUNING,
  type GameState,
  type Level,
  type SledInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
const POWDER = flatLevel({ packed: 0 });
const FULL: SledInput = { ...NEUTRAL_INPUT, throttle: 1 };

function stage(level: Level, speed = 0, heading = 0): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 150, heading, speed });
  return state;
}

function ride(state: GameState, seconds: number, input: SledInput | ((s: GameState) => SledInput)) {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, typeof input === "function" ? input(state) : input);
}

/** Seconds from rest to `kmh`, or Infinity. */
function timeTo(level: Level, kmh: number, limit = 40): number {
  const state = stage(level);
  const steps = Math.round(limit * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, FULL);
    if (state.sled.speed * 3.6 >= kmh) return (i + 1) * TUNING.dt;
  }
  return Infinity;
}

describe("the sled at rest", () => {
  it("stands on packed snow at its CoG height, level, and stays put", () => {
    const state = stage(PACKED);
    ride(state, 3, NEUTRAL_INPUT);
    const c = state.sled;
    const over = c.y - PACKED.groundAt(c.x, c.z);
    expect(over).toBeGreaterThan(SLED.cogHeight - 0.06);
    expect(over).toBeLessThan(SLED.cogHeight + 0.02);
    expect(Math.abs(c.pitch)).toBeLessThan(0.02);
    expect(Math.abs(c.roll)).toBeLessThan(0.01);
    expect(c.speed).toBeLessThan(0.05);
    expect(c.airborne).toBe(false);
    for (const contact of c.contacts) {
      expect(contact.touching).toBe(true);
      expect(contact.sink).toBeLessThan(0.05);
    }
  });

  it("sinks into powder by about the tread's rest sink", () => {
    const state = stage(POWDER);
    ride(state, 3, NEUTRAL_INPUT);
    const c = state.sled;
    const tread = c.contacts[c.contacts.length - 1];
    expect(tread.sink).toBeCloseTo(TUNING.snow.powderSink, 2);
    const over = c.y - POWDER.groundAt(c.x, c.z);
    expect(over).toBeLessThan(SLED.cogHeight - 0.15);
    expect(over).toBeGreaterThan(SLED.cogHeight - TUNING.snow.powderSink - 0.05);
  });

  it("reports every probe's footprint on the snow surface for the trails", () => {
    const state = stage(POWDER, 15);
    ride(state, 1, FULL);
    const c = state.sled;
    expect(c.contacts.filter((k) => k.kind === "ski")).toHaveLength(2);
    expect(c.contacts.filter((k) => k.kind === "tread").length).toBeGreaterThan(2);
    for (const k of c.contacts) {
      if (!k.touching) continue;
      expect(k.y).toBeCloseTo(POWDER.groundAt(k.x, k.z), 3);
      expect(Math.hypot(k.x - c.x, k.z - c.z)).toBeLessThan(SLED.length);
    }
  });
});

describe("the sled under power", () => {
  it("reaches 100 km/h on packed snow near the spec's time", () => {
    const t = timeTo(PACKED, 100);
    expect(t).toBeGreaterThan(SLED.accel0to100 * 0.8);
    expect(t).toBeLessThan(SLED.accel0to100 * 1.2);
  });

  it("tops out within a tenth of the documented top speed on packed snow", () => {
    const state = stage(PACKED);
    ride(state, 25, FULL);
    const kmh = state.sled.speed * 3.6;
    expect(kmh).toBeGreaterThan(SLED.topSpeed * 0.9);
    expect(kmh).toBeLessThan(SLED.topSpeed * 1.1);
    // The CVT holds the engine near the power peak and the limiter caps it.
    expect(state.sled.rpm).toBeGreaterThan(SLED.peakRpm * 0.95);
    expect(state.sled.rpm).toBeLessThanOrEqual(SLED.maxRpm * 1.03);
  });

  it("is slower in powder, and planes up onto it with speed", () => {
    expect(timeTo(POWDER, 50)).toBeGreaterThan(timeTo(PACKED, 50) * 2);
    const state = stage(POWDER);
    const tread = state.sled.contacts.length - 1;
    const restSink = state.sled.sinks[tread];
    ride(state, 25, FULL);
    const kmh = state.sled.speed * 3.6;
    expect(kmh).toBeLessThan(SLED.topSpeed * 0.85);
    expect(kmh).toBeGreaterThan(60);
    expect(state.sled.sinks[tread]).toBeLessThan(restSink * 0.2);
  });

  it("spins the tread faster than the sled in powder", () => {
    const state = stage(POWDER);
    ride(state, 3, FULL);
    expect(state.sled.treadSpeed).toBeGreaterThan(state.sled.speed + 2);
  });
});

describe("steering and braking", () => {
  it("turns right with the bars right, and left with them left", () => {
    for (const side of [1, -1]) {
      const state = stage(PACKED, 60 / 3.6);
      ride(state, 2, { ...NEUTRAL_INPUT, throttle: 0.5, steer: side });
      expect(Math.sign(state.sled.heading)).toBe(side);
      expect(Math.abs(state.sled.heading)).toBeGreaterThan(0.5);
      expect(Math.abs(state.sled.roll)).toBeLessThan(0.5);
    }
  });

  it("stops from 100 km/h on packed snow inside 90 m without spinning", () => {
    const state = stage(PACKED, 100 / 3.6);
    const z0 = state.sled.z;
    ride(state, 8, { ...NEUTRAL_INPUT, brake: 1 });
    expect(state.sled.speed).toBeLessThan(0.3);
    expect(state.sled.z - z0).toBeLessThan(90);
    expect(Math.abs(state.sled.heading)).toBeLessThan(0.1);
  });

  it("does not swap ends braking hard into a turn", () => {
    const state = stage(PACKED, 100 / 3.6);
    let worst = 0;
    ride(state, 4, (s) => {
      const c = s.sled;
      if (Math.hypot(c.vx, c.vz) > 3) {
        const way = Math.atan2(c.vx, c.vz);
        let d = Math.abs(c.heading - way) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        worst = Math.max(worst, d);
      }
      return { ...NEUTRAL_INPUT, brake: 1, steer: s.t > 0.3 ? 0.6 : 0 };
    });
    expect(worst).toBeLessThan(Math.PI / 3);
  });
});
