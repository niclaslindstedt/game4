// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CATALOG: six machines, each an answer to a kind of snow and none a
// point on one scale. Every machine is held to its own documented
// expectations (`topSpeed`, `accel0to100`) on the groomer; then each is held
// to what its row CLAIMS — the trail sled holding a groomed bend hardest,
// the touring sled flat out fastest, the mountain sled paddling through
// powder, the work sled floating on it, the race sled taking the landing
// the others bottom on — and the reference machine's footprint to being
// exactly the one every shared number was tuned on. Staged on the
// synthetic drag strips (`support/synthetic.ts`) with `placeRun`.

import { describe, expect, it } from "vitest";

import {
  BEAVER,
  BISON,
  HARE,
  IBEX,
  NEUTRAL_INPUT,
  SLED,
  SLEDS,
  STOAT,
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
  it("is six machines with their own ids, the fox the default", () => {
    expect(SLEDS.map((s) => s.id)).toEqual(["fox", "hare", "ibex", "stoat", "bison", "beaver"]);
    expect(SLED.id).toBe("fox");
    for (const s of SLEDS) {
      expect(sledById(s.id)).toBe(s);
      expect(isSledId(s.id)).toBe(true);
      expect(s.blurb.length).toBeGreaterThan(20);
      expect(s.kind.length).toBeGreaterThan(3);
    }
    expect(sledById("snowcat")).toBe(SLED);
    expect(isSledId("snowcat")).toBe(false);
    // A pick stored under the catalog's old names falls back to the default.
    expect(sledById("crossover")).toBe(SLED);
  });

  it("keeps every machine inside the real bands it claims", () => {
    for (const s of SLEDS) {
      // Two-stroke sport sleds 195–235 kg dry; four-stroke work and touring
      // machines up to 315.
      expect(s.dryMass).toBeGreaterThanOrEqual(190);
      expect(s.dryMass).toBeLessThanOrEqual(315);
      // A race 600 makes 125–135 hp, a turbocharged four-stroke up to 200.
      expect(s.powerKw).toBeGreaterThanOrEqual(90);
      expect(s.powerKw).toBeLessThanOrEqual(150);
      // Mountain stances 34–36 in, trail stances up to 43–44 in.
      expect(s.skiStance).toBeGreaterThanOrEqual(0.86);
      expect(s.skiStance).toBeLessThanOrEqual(1.12);
      // Belts 120–175 in long, 15–24 in wide.
      expect(s.treadLength).toBeGreaterThanOrEqual(3.05);
      expect(s.treadLength).toBeLessThanOrEqual(4.45);
      expect(s.treadWidth).toBeGreaterThanOrEqual(0.37);
      expect(s.treadWidth).toBeLessThanOrEqual(0.62);
      expect(s.lugHeight).toBeGreaterThanOrEqual(0.025);
      expect(s.lugHeight).toBeLessThanOrEqual(0.08);
      expect(s.studs).toBeGreaterThanOrEqual(0);
      expect(s.studs).toBeLessThanOrEqual(160);
      // Carbides 4–8 in.
      expect(s.carbide).toBeGreaterThanOrEqual(0.09);
      expect(s.carbide).toBeLessThanOrEqual(0.21);
    }
  });

  it("prices the reference machine's footprint at exactly one on every axis", () => {
    const fit = footprintOf(SLED);
    expect(fit.sink).toBe(1);
    expect(fit.plane).toBe(1);
    expect(fit.powderDrive).toBe(1);
    expect(fit.packedSide).toBe(1);
    expect(fit.beltLoss).toBe(1);
    expect(fit.studded).toBe(1);
    expect(fit.skiBite).toBe(1);
    expect(fit.skiFloat).toBe(1);
    expect(fit.belt).toBe(1);
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

describe("six answers to a kind of snow", () => {
  it("the touring sled is the quickest flat out on packed snow; the race sled, geared short, the slowest", () => {
    const tops = new Map(SLEDS.map((s) => [s.id, topOn(s, PACKED)]));
    expect(Math.max(...tops.values())).toBe(tops.get("bison"));
    expect(Math.min(...tops.values())).toBe(tops.get("stoat"));
    // ...and the long, tall belt costs the mountain sled the top end of
    // the crossover's, with more power under it.
    expect(tops.get("ibex")!).toBeLessThan(tops.get("fox")!);
  });

  it("the wide, low trail sled tips last in a bend; the narrow, tall ones first", () => {
    const tips = SLEDS.map(tipLimit);
    expect(Math.max(...tips)).toBe(tipLimit(HARE));
    for (const s of [IBEX, BEAVER]) expect(tipLimit(s)).toBeLessThan(tipLimit(SLED));
  });

  it("the trail sled holds the groomer hardest in a bend, the mountain pushes widest", () => {
    const grips = SLEDS.map((s) => cornerGrip(s, 1));
    expect(Math.max(...grips)).toBe(cornerGrip(HARE, 1));
    expect(Math.min(...grips)).toBe(cornerGrip(IBEX, 1));
  });

  it("the work sled's wide belt sinks least; the mountain sled's paddles get going quickest in powder", () => {
    const sinks = SLEDS.map(restSink);
    expect(Math.min(...sinks)).toBe(restSink(BEAVER));
    expect(restSink(IBEX)).toBeLessThan(TUNING.snow.powderSink * 0.85);
    const times = SLEDS.map((s) => timeTo(s, POWDER, 50));
    expect(Math.min(...times)).toBe(timeTo(IBEX, POWDER, 50));
    expect(timeTo(IBEX, POWDER, 50)).toBeLessThan(timeTo(SLED, POWDER, 50) * 0.7);
  });

  it("the trail, race and touring sleds, the least belt under the most weight, bog in powder", () => {
    for (const s of [HARE, STOAT, BISON]) {
      expect(footprintOf(s).sink).toBeGreaterThan(1);
      expect(timeTo(s, POWDER, 50)).toBeGreaterThan(timeTo(SLED, POWDER, 50));
    }
  });

  it("the race sled's long, stiff stroke takes the hardest landing whole", () => {
    const harsh = SLEDS.map(harshSpeedOf);
    expect(Math.max(...harsh)).toBe(harshSpeedOf(STOAT));
    expect(harshSpeedOf(STOAT)).toBeGreaterThan(TUNING.air.harshSpeed * 1.2);
  });
});
