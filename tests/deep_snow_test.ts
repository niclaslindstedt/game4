// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEEP SNOW (`snow.ts`'s header): past the ordinary depth, up to a metre of
// fresh snow, the powder is bottomless — it gives under load and stays
// pressed, a sled planes later and its belly ploughs, and a sled down in it
// rides like a bike, held up by the rider's weight. Held here from both
// ends: the ordinary snow every race is ridden on is the model it was, and
// the deep snow does what riders say it does — keep it moving, keep the
// nose up, hang your weight uphill. Plus the rider's hang following the
// bend on the groomer. Staged on the synthetic drag strips with `placeRun`.

import { describe, expect, it } from "vitest";

import {
  bottomlessOf,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  settleShare,
  sinkTarget,
  sledById,
  SLED,
  SNOW_DIAL,
  snowCoverOf,
  step,
  TUNING,
  type GameState,
  type Level,
  type RunMoment,
  type SledInput,
  type SledSpec,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const METRE = SNOW_DIAL.max;
const POWDER = flatLevel({ packed: 0 });
const PACKED = flatLevel({ packed: 1 });
const FULL: SledInput = { ...NEUTRAL_INPUT, throttle: 1 };

function stage(
  level: Level,
  moment: RunMoment,
  snowDepth: number = METRE,
  spec: SledSpec = SLED,
): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, spec, snowDepth, quiet: true });
  placeRun(state, moment);
  return state;
}

function ride(state: GameState, seconds: number, input: (s: GameState, t: number) => SledInput) {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, input(state, i / TUNING.physicsHz));
}

/** A rider holding `kmh` on the lever. */
function cruise(s: GameState, kmh: number): SledInput {
  const err = kmh / 3.6 - s.sled.speed;
  return { ...NEUTRAL_INPUT, throttle: Math.min(1, Math.max(0, 0.35 + 0.5 * err)) };
}

const over = (s: GameState): boolean => Math.abs(s.sled.roll) > 1.2;

describe("the depth of snow", () => {
  it("reads a metre of fresh snow at the dial's deepest, the ordinary snow at 40 cm", () => {
    expect(snowCoverOf(1)).toBeCloseTo(0.4, 9);
    expect(snowCoverOf(METRE)).toBeCloseTo(1, 9);
    expect(bottomlessOf(1)).toBe(0);
    expect(bottomlessOf(0.5)).toBe(0);
    expect(bottomlessOf(METRE)).toBe(1);
  });

  it("leaves the ordinary snow's model alone: no give, no hold-down, no later planing", () => {
    // At or under the ordinary depth the load and the depth's planing do
    // nothing, so every race is the race it was.
    expect(sinkTarget(0, 5, 1, 1, 1, 2.5)).toBe(sinkTarget(0, 5, 1, 1, 1));
    expect(settleShare(bottomlessOf(1), 0)).toBe(1);
  });

  it("gives under load in deep snow, down to what the loose layer compacts to", () => {
    const rest = sinkTarget(0, 0, 1, 1, METRE, 1, 1);
    const loaded = sinkTarget(0, 0, 1, 1, METRE, 2, 1);
    expect(loaded).toBeGreaterThan(rest);
    expect(loaded).toBeLessThanOrEqual(TUNING.snow.deep.compact * snowCoverOf(METRE) + 1e-9);
    // Unloaded, it is carried higher.
    expect(sinkTarget(0, 0, 1, 1, METRE, 0.5, 1)).toBeLessThan(rest);
  });

  it("stays pressed under a stopped footprint, and only new snow comes back up", () => {
    expect(settleShare(1, 0)).toBe(0);
    expect(settleShare(1, TUNING.snow.deep.settle)).toBe(1);
  });

  it("sinks a sled standing in a metre to its belly — some 60–75 cm", () => {
    const deep = stage(POWDER, { x: 1500, z: 200, heading: 0 });
    const medium = stage(POWDER, { x: 1500, z: 200, heading: 0 }, 1);
    ride(deep, 3, () => NEUTRAL_INPUT);
    ride(medium, 3, () => NEUTRAL_INPUT);
    const tail = deep.sled.sinks[deep.sled.sinks.length - 1];
    expect(tail).toBeGreaterThan(0.6);
    expect(tail).toBeLessThan(0.76);
    expect(deep.sled.y).toBeLessThan(medium.sled.y - 0.3);
    // ...and standing still on the flat, it stays upright.
    expect(Math.abs(deep.sled.roll)).toBeLessThan(0.05);
  });
});

describe("keep it moving, keep the nose up", () => {
  it("bogs a crossover pinned from rest in a metre, and planes it once the rider leans back", () => {
    const pinned = stage(POWDER, { x: 1500, z: 150, heading: 0 });
    const back = stage(POWDER, { x: 1500, z: 150, heading: 0 });
    ride(pinned, 20, () => FULL);
    ride(back, 20, () => ({ ...FULL, lean: 1 }));
    expect(pinned.sled.speed * 3.6).toBeLessThan(45);
    expect(back.sled.speed * 3.6).toBeGreaterThan(70);
  });

  it("lets a planing sled that lets off sink back in and wallow", () => {
    const s = stage(POWDER, { x: 1500, z: 150, heading: 0, speed: 70 / 3.6 });
    ride(s, 16, (_, t) => (t >= 2 && t < 6 ? NEUTRAL_INPUT : FULL));
    expect(s.sled.speed * 3.6).toBeLessThan(45);
  });

  it("carries the mountain sled over the top where the crossover bogs", () => {
    const ibex = stage(POWDER, { x: 1500, z: 150, heading: 0 }, METRE, sledById("ibex"));
    ride(ibex, 20, () => FULL);
    expect(ibex.sled.speed * 3.6).toBeGreaterThan(90);
  });

  it("is still the ordinary powder at the ordinary depth: a pinned crossover planes", () => {
    const s = stage(POWDER, { x: 1500, z: 150, heading: 0 }, 1);
    ride(s, 20, () => FULL);
    expect(s.sled.speed * 3.6).toBeGreaterThan(100);
  });
});

describe("ride it like a bike", () => {
  const SIDEHILL = flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 });
  const across = { x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 };

  it("tips a sled traversing a 10-degree slope in a metre, hands off", () => {
    const s = stage(SIDEHILL, across);
    let fell = false;
    ride(s, 5, (st) => {
      fell ||= over(st);
      return cruise(st, 20);
    });
    expect(fell).toBe(true);
  });

  it("holds it upright with the rider's weight hung uphill", () => {
    const s = stage(SIDEHILL, across);
    let fell = false;
    ride(s, 8, (st) => {
      fell ||= over(st);
      const steer = Math.max(-1, Math.min(1, -3 * st.sled.roll - 0.3 * st.sled.wz));
      return { ...cruise(st, 20), steer };
    });
    expect(fell).toBe(false);
  });

  it("holds the same traverse in the ordinary snow, hands off", () => {
    const s = stage(SIDEHILL, across, 1);
    let fell = false;
    ride(s, 5, (st) => {
      fell ||= over(st);
      return cruise(st, 20);
    });
    expect(fell).toBe(false);
  });
});

describe("the hang follows the bend", () => {
  const hangAt = (level: Level, kmh: number): number => {
    const s = stage(level, { x: 1500, z: 400, heading: 0, speed: kmh / 3.6 }, 1);
    ride(s, 1, (st) => ({ ...cruise(st, kmh), steer: 1 }));
    return s.sled.riderRight / s.sled.spec.riderReach;
  };

  it("sits a rider in the middle at a crawl on the groomer, and hangs him off at pace", () => {
    expect(hangAt(PACKED, 5)).toBeLessThan(0.5);
    expect(hangAt(PACKED, 50)).toBeGreaterThan(0.95);
  });

  it("hangs him off at any pace in powder, where his weight is how the sled turns", () => {
    expect(hangAt(POWDER, 5)).toBeGreaterThan(0.95);
  });
});
