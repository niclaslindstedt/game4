// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: a kicker throws the sled, the flight is reported, the landing is
// reported and a flat one from too high costs speed; the rider's lean pitches
// the machine in the air and the throttle and the brake do what a rider
// expects of them.

import { describe, expect, it } from "vitest";

import {
  createGame,
  landingAhead,
  NEUTRAL_INPUT,
  placeRun,
  SLEDS,
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
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 1.55 });
    const events = ride(state, 2, FULL);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind === "land" && !land.harsh).toBe(true);
  });

  it("flat from five metres bottoms the suspension and costs speed", () => {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
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

describe("a landing sticks", () => {
  // THE BUCK a sled with too little rebound damping gives: the springs and
  // the bump stops handing a landing back, the whole machine thrown off the
  // snow again. Once the first landing is in, the snow keeps it — a skip of
  // a probe or two for less than a counted flight at most, and no second
  // `air` or `land` for the same jump.
  const cases = [
    {
      name: "the stadium kicker overshot at race speed",
      level: () => syntheticLevel(),
      at: {
        x: STADIUM.kickerX + 70,
        z: STADIUM.zMid + STADIUM.radius,
        heading: -Math.PI / 2,
        speed: 75 / 3.6,
      },
    },
    {
      name: "a 3 m drop onto the groomer",
      level: () => flatLevel({ packed: 1 }),
      at: { x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 3.55 },
    },
  ];
  for (const { name, level, at } of cases) {
    it(`off ${name}, on every machine`, () => {
      for (const spec of SLEDS) {
        const state = createGame({ level: level(), rivals: 0, countdown: 0, spec, quiet: true });
        placeRun(state, at);
        let landed = -1;
        let off = 0;
        let longest = 0;
        let flights = 0;
        for (let i = 0; i < 5 * TUNING.physicsHz; i++) {
          step(state, FULL);
          for (const e of state.events) {
            if (e.kind === "land") {
              flights += 1;
              if (landed < 0) landed = state.t;
            }
          }
          if (landed < 0 || state.t - landed > 2) continue;
          off = state.sled.contacts.some((p) => p.touching) ? 0 : off + TUNING.dt;
          longest = Math.max(longest, off);
        }
        expect(flights, spec.id).toBe(1);
        expect(longest, spec.id).toBeLessThan(TUNING.air.counts);
      }
    });
  }
});

describe("the air's pull", () => {
  // The same staged launch, climbing 8.5 m/s off the flat.
  function hang(mode: "race" | "tricks"): number {
    const state = createGame({ level: flatLevel({ packed: 1 }), mode, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 22, height: 1.2, vy: 8.5 });
    const land = ride(state, 4, FULL).find((e) => e.kind === "land");
    return land?.kind === "land" ? land.airTime : 0;
  }

  it("is the arcade's heavier air on a race and the real g on a tricks run", () => {
    const race = hang("race");
    const tricks = hang("tricks");
    expect(race).toBeGreaterThan(0.8);
    // Air time off the same launch goes as 1/g.
    expect(tricks / race).toBeGreaterThan(TUNING.air.gravity * 0.85);
    expect(tricks / race).toBeLessThan(TUNING.air.gravity * 1.15);
  });

  it("is what the landing is looked for along", () => {
    const state = createGame({ level: flatLevel({ packed: 1 }), countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 5.55 });
    const fall = TUNING.g * TUNING.air.gravity;
    const ahead = landingAhead(state.sled, state.level, fall);
    expect(ahead).not.toBeNull();
    if (!ahead) return;
    // Five metres down, from rest vertically, onto the flat.
    expect(ahead.t).toBeCloseTo(Math.sqrt((2 * 5) / fall), 1);
    expect(Math.abs(ahead.slope)).toBeLessThan(0.01);
  });
});

describe("air control", () => {
  function pitchAfter(input: SledInput): number {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
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
