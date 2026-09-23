// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CATALOG: four machines, each an answer to a kind of snow and none a
// point on one scale. Every machine is held to its own documented
// expectations (`topSpeed`, `accel0to100`) on the groomer; then each is held
// to what its row CLAIMS — the trail sled quickest on packed snow, the
// mountain sled floating and paddling in powder, the cross sled taking the
// landing the others bottom on — and the reference machine's footprint to
// being exactly the one every shared number was tuned on. Staged on the
// synthetic drag strips (`support/synthetic.ts`) with `placeRun`.

import { describe, expect, it } from "vitest";

import {
  CROSS_SLED,
  MOUNTAIN_SLED,
  NEUTRAL_INPUT,
  SLED,
  SLEDS,
  TRAIL_SLED,
  cornerGrip,
  createGame,
  footprintOf,
  harshSpeedOf,
  isSledId,
  placeRun,
  sledById,
  step,
  tipLimit,
  TUNING,
  type GameState,
  type Level,
  type SledSpec,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
const POWDER = flatLevel({ packed: 0 });
const FULL = { ...NEUTRAL_INPUT, throttle: 1 };

function stage(spec: SledSpec, level: Level, speed = 0): GameState {
  const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 150, heading: 0, speed });
  return state;
}

/** Seconds from rest to `kmh` at full throttle, or Infinity. */
function timeTo(spec: SledSpec, level: Level, kmh: number, limit = 40): number {
  const state = stage(spec, level);
  const steps = Math.round(limit * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, FULL);
    if (state.sled.speed * 3.6 >= kmh) return (i + 1) * TUNING.dt;
  }
  return Infinity;
}

function topOn(spec: SledSpec, level: Level): number {
  const state = stage(spec, level);
  for (let i = 0; i < 25 * TUNING.physicsHz; i++) step(state, FULL);
  return state.sled.speed * 3.6;
}

/** The rest sink of the tread's rearmost probe after settling, m. */
function restSink(spec: SledSpec): number {
  const state = stage(spec, POWDER);
  for (let i = 0; i < 3 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
  return state.sled.sinks[state.sled.sinks.length - 1];
}

describe("the catalog", () => {
  it("is four machines with their own ids, the crossover the default", () => {
    expect(SLEDS.map((s) => s.id)).toEqual(["trail", "crossover", "mountain", "cross"]);
    expect(SLED.id).toBe("crossover");
    for (const s of SLEDS) {
      expect(sledById(s.id)).toBe(s);
      expect(isSledId(s.id)).toBe(true);
      expect(s.blurb.length).toBeGreaterThan(20);
    }
    expect(sledById("snowcat")).toBe(SLED);
    expect(isSledId("snowcat")).toBe(false);
  });

  it("keeps every machine inside the real bands it claims", () => {
    for (const s of SLEDS) {
      expect(s.dryMass).toBeGreaterThanOrEqual(190);
      expect(s.dryMass).toBeLessThanOrEqual(235);
      // 850-class two-strokes make 165 hp, the turbocharged one 180.
      expect(s.powerKw).toBeGreaterThanOrEqual(120);
      expect(s.powerKw).toBeLessThanOrEqual(135);
      // Mountain stances 34–36 in, trail stances up to 43–44 in.
      expect(s.skiStance).toBeGreaterThanOrEqual(0.86);
      expect(s.skiStance).toBeLessThanOrEqual(1.12);
      // Belts 120–175 in.
      expect(s.treadLength).toBeGreaterThanOrEqual(3.05);
      expect(s.treadLength).toBeLessThanOrEqual(4.45);
      expect(s.lugHeight).toBeGreaterThanOrEqual(0.025);
      expect(s.lugHeight).toBeLessThanOrEqual(0.075);
    }
  });

  it("prices the reference machine's footprint at exactly one on every axis", () => {
    const fit = footprintOf(SLED);
    expect(fit.sink).toBe(1);
    expect(fit.plane).toBe(1);
    expect(fit.powderDrive).toBe(1);
    expect(fit.packedSide).toBe(1);
    expect(fit.beltLoss).toBe(1);
    expect(harshSpeedOf(SLED)).toBeCloseTo(TUNING.air.harshSpeed, 9);
  });
});

describe("every machine, on the groomer", () => {
  for (const spec of SLEDS) {
    it(`${spec.id} reaches 100 km/h near its documented time`, () => {
      const t = timeTo(spec, PACKED, 100);
      expect(t).toBeGreaterThan(spec.accel0to100 * 0.8);
      expect(t).toBeLessThan(spec.accel0to100 * 1.2);
    });

    it(`${spec.id} tops out within a tenth of its documented top speed`, () => {
      const kmh = topOn(spec, PACKED);
      expect(kmh).toBeGreaterThan(spec.topSpeed * 0.9);
      expect(kmh).toBeLessThan(spec.topSpeed * 1.1);
    });
  }
});

describe("four answers to a kind of snow", () => {
  it("the trail sled is the quickest flat out on packed snow; the cross, geared short, the slowest", () => {
    const tops = new Map(SLEDS.map((s) => [s.id, topOn(s, PACKED)]));
    expect(Math.max(...tops.values())).toBe(tops.get("trail"));
    expect(Math.min(...tops.values())).toBe(tops.get("cross"));
    // ...and the long, tall belt costs the mountain sled the top end of
    // the crossover's, with more power under it.
    expect(tops.get("mountain")!).toBeLessThan(tops.get("crossover")!);
  });

  it("the wide, low trail sled tips last in a bend, the narrow mountain sled first", () => {
    const tips = SLEDS.map(tipLimit);
    expect(Math.max(...tips)).toBe(tipLimit(TRAIL_SLED));
    expect(Math.min(...tips)).toBe(tipLimit(MOUNTAIN_SLED));
  });

  it("the trail sled holds the groomer hardest in a bend, the mountain pushes widest", () => {
    const grips = SLEDS.map((s) => cornerGrip(s, 1));
    expect(Math.max(...grips)).toBe(cornerGrip(TRAIL_SLED, 1));
    expect(Math.min(...grips)).toBe(cornerGrip(MOUNTAIN_SLED, 1));
  });

  it("the mountain sled sinks least and gets going quickest in powder", () => {
    const sinks = SLEDS.map(restSink);
    expect(Math.min(...sinks)).toBe(restSink(MOUNTAIN_SLED));
    expect(restSink(MOUNTAIN_SLED)).toBeLessThan(TUNING.snow.powderSink * 0.85);
    const times = SLEDS.map((s) => timeTo(s, POWDER, 50));
    expect(Math.min(...times)).toBe(timeTo(MOUNTAIN_SLED, POWDER, 50));
    expect(timeTo(MOUNTAIN_SLED, POWDER, 50)).toBeLessThan(timeTo(SLED, POWDER, 50) * 0.7);
  });

  it("the trail and cross sleds, the least belt under the most weight, bog in powder", () => {
    for (const s of [TRAIL_SLED, CROSS_SLED]) {
      expect(footprintOf(s).sink).toBeGreaterThan(1);
      expect(timeTo(s, POWDER, 50)).toBeGreaterThan(timeTo(SLED, POWDER, 50));
    }
  });

  it("the cross sled's long, stiff stroke takes the hardest landing whole", () => {
    const harsh = SLEDS.map(harshSpeedOf);
    expect(Math.max(...harsh)).toBe(harshSpeedOf(CROSS_SLED));
    expect(harshSpeedOf(CROSS_SLED)).toBeGreaterThan(TUNING.air.harshSpeed * 1.2);
  });
});
