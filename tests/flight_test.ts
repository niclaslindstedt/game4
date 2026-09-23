// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: a kicker throws the sled, the flight is reported, the landing is
// reported and a flat one from too high costs speed; the rider's lean pitches
// the machine in the air and the throttle and the brake do what a rider
// expects of them.

import { describe, expect, it } from "vitest";

import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SledInput,
} from "@engine";
import { flatLevel, STADIUM, syntheticLevel } from "./support/synthetic.ts";

const FULL: SledInput = { ...NEUTRAL_INPUT, throttle: 1 };

function ride(state: GameState, seconds: number, input: SledInput): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

describe("a kicker", () => {
  it("throws the sled into the air and lands it", () => {
    const level = syntheticLevel();
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, {
      x: STADIUM.kickerX + 40,
      z: STADIUM.zMid + STADIUM.radius,
      heading: -Math.PI / 2,
      speed: 60 / 3.6,
    });
    const events = ride(state, 5, { ...FULL, throttle: 0.5 });
    const air = events.find((e) => e.kind === "air");
    const land = events.find((e) => e.kind === "land");
    expect(air).toBeDefined();
    expect(land).toBeDefined();
    if (land?.kind !== "land") return;
    expect(land.airTime).toBeGreaterThan(0.6);
    expect(land.airTime).toBeLessThan(3);
    expect(state.progress.bestAir).toBeCloseTo(land.airTime, 5);
    expect(state.sled.airborne).toBe(false);
    // The sled comes down the right way up.
    expect(Math.abs(state.sled.roll)).toBeLessThan(0.5);
  });
});

describe("a landing", () => {
  it("from a metre is taken by the suspension whole", () => {
    const state = createGame({ level: flatLevel({ packed: 1 }), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 1.55 });
    const events = ride(state, 2, FULL);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind === "land" && !land.harsh).toBe(true);
  });

  it("flat from five metres bottoms the suspension and costs speed", () => {
    const state = createGame({ level: flatLevel({ packed: 1 }), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 5.55 });
    const events = ride(state, 2, NEUTRAL_INPUT);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind).toBe("land");
    if (land?.kind !== "land") return;
    expect(land.harsh).toBe(true);
    expect(land.lost).toBeGreaterThan(0);
    expect(land.impact).toBeGreaterThan(TUNING.air.harshSpeed);
  });
});

describe("air control", () => {
  function pitchAfter(input: SledInput): number {
    const state = createGame({ level: flatLevel({ packed: 1 }), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 12, vy: 3 });
    ride(state, 0.6, input);
    expect(state.sled.airborne).toBe(true);
    return state.sled.pitch;
  }

  it("lean back lifts the nose, lean forward drops it", () => {
    const neutral = pitchAfter(NEUTRAL_INPUT);
    expect(pitchAfter({ ...NEUTRAL_INPUT, lean: 1 })).toBeGreaterThan(neutral + 0.2);
    expect(pitchAfter({ ...NEUTRAL_INPUT, lean: -1 })).toBeLessThan(neutral - 0.2);
  });

  it("the throttle lifts the nose and the brake drops it", () => {
    const neutral = pitchAfter(NEUTRAL_INPUT);
    expect(pitchAfter(FULL)).toBeGreaterThan(neutral);
    expect(pitchAfter({ ...NEUTRAL_INPUT, brake: 1 })).toBeLessThan(neutral);
  });
});
