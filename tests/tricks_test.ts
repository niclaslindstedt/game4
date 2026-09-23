// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICKS: the strokes turn a flying sled only on a run that counts
// tricks, and only from a flight going up; a staged backflip, a front flip,
// a 360 and a pose each score; the combo banks on a clean landing, banks at
// its base on a sketchy one and is lost to a wipeout or a landing taken in a
// pose; the buzzer pays what is in hand; the by-the-metre half of the air
// weighs what the by-the-second half does; and the trick field (R20) is laid
// only on a map asked for one, graded, and passes its own analysis.

import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES,
  NEUTRAL_INPUT,
  TUNING,
  airPointsPerSecond,
  analyzeLevel,
  createGame,
  generateLevel,
  lengthPointsPerMetre,
  placeRun,
  poseOf,
  step,
  type GameEvent,
  type GameMode,
  type GameState,
  type RunMoment,
  type SledInput,
} from "@engine";
import { comboLine } from "../pwa/src/game/strings.ts";
import { comboTile } from "../pwa/src/game/trick-tile.ts";
import { flatLevel } from "./support/synthetic.ts";

/** A flight a kicker would have thrown: 1.2 m up, climbing 8.5 m/s, at
 * 80 km/h over packed snow — about 1.9 s in the air. */
const LAUNCH: RunMoment = { x: 1500, z: 200, heading: 0, speed: 22, height: 1.2, vy: 8.5 };

function staged(mode: GameMode = "tricks", moment: RunMoment = LAUNCH): GameState {
  const state = createGame({ level: flatLevel({ packed: 1 }), mode, countdown: 0, quiet: true });
  placeRun(state, moment);
  return state;
}

/** Ride `seconds` with the controls `at(t)` asks for; every event kept. */
function ride(state: GameState, seconds: number, at: (t: number) => Partial<SledInput>) {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, throttle: 1, ...at(i * TUNING.dt) });
    events.push(...state.events);
  }
  return events;
}

const tricksOf = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "trick" ? [e.trick] : []));
const BACKFLIP = (t: number): Partial<SledInput> => ({ lean: t < 1.2 ? 1 : 0 });

describe("a staged backflip", () => {
  it("scores: the flip, the air it was turned in, and the combo banked on a clean landing", () => {
    const state = staged();
    const events = ride(state, 4, BACKFLIP);
    expect(tricksOf(events)).toEqual(["air", "backflip"]);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind === "land" && land.harsh).toBe(false);
    const combo = events.find((e) => e.kind === "combo");
    expect(combo?.kind === "combo" && combo.mult).toBe(3);
    expect(combo?.kind === "combo" && combo.sketchy).toBe(false);
    expect(state.tricks.score).toBeGreaterThan(1500);
    expect(state.tricks.score).toBe(combo?.kind === "combo" ? combo.points : -1);
  });

  it("replays to the same score", () => {
    const a = staged();
    const b = staged();
    ride(a, 4, BACKFLIP);
    ride(b, 4, BACKFLIP);
    expect(a.tricks.score).toBe(b.tricks.score);
    expect(a.sled.x).toBe(b.sled.x);
  });

  it("is not a stroke on a run that does not count tricks", () => {
    const state = staged("race");
    ride(state, 0.5, BACKFLIP);
    expect(state.tricks.pumped).toBe(0);
    // The lean's own torque still pitches it: it is the air control.
    expect(state.sled.wx).toBeLessThan(0);
    const tricked = staged();
    ride(tricked, 0.5, BACKFLIP);
    expect(tricked.sled.wx).toBeLessThan(state.sled.wx - 1.5);
  });

  it("cannot be opened on the way down", () => {
    const state = staged("tricks", { ...LAUNCH, height: 5, vy: -1 });
    ride(state, 0.6, () => ({ lean: 1 }));
    expect(state.tricks.pumped).toBe(0);
    expect(state.tricks.tricking).toBe(false);
  });

  it("takes one stroke a tap, out of the flight's budget", () => {
    const state = staged();
    const tap = (t: number): Partial<SledInput> => ({
      lean: Math.floor(t / 0.05) % 2 === 0 ? 1 : 0,
    });
    ride(state, 1, tap);
    expect(state.tricks.pumped).toBeCloseTo(TUNING.tricks.flipCeiling, 6);
  });
});

describe("the other elements", () => {
  it("a front flip: the lean forward and the brake", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({
      lean: t < 1 ? -1 : 0,
      throttle: 0,
      brake: t < 0.55 ? 1 : 0,
    }));
    expect(tricksOf(events)).toContain("frontflip");
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("a 360: the bars thrown over", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({ steer: t < 0.4 ? 1 : 0 }));
    expect(tricksOf(events)).toContain("spin");
  });

  it("a pose held, let go before the snow: an element, and the combo kept", () => {
    const state = staged();
    const events = ride(state, 4, (t) => ({
      trick: t < 0.8,
      lean: t < 0.8 ? 1 : 0,
    }));
    expect(tricksOf(events)).toEqual(["air", "canCan"]);
    expect(events.some((e) => e.kind === "combo")).toBe(true);
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("a pose is picked by the lean and the bars", () => {
    const at = (steer: number, lean: number): string =>
      poseOf({ ...NEUTRAL_INPUT, steer, lean, trick: true });
    expect(at(1, 0)).toBe("oneFoot");
    expect(at(0, 1)).toBe("canCan");
    expect(at(0, -1)).toBe("tuck");
    expect(at(0, 0)).toBe("tuck");
  });
});

describe("losing the combo", () => {
  it("a landing taken still in a pose loses it", () => {
    const state = staged();
    const events = ride(state, 3, () => ({ trick: true }));
    const bail = events.find((e) => e.kind === "bail");
    expect(bail?.kind === "bail" && bail.cause).toBe("pose");
    expect(state.tricks.score).toBe(0);
  });

  it("a wipeout loses it", () => {
    // A nose-in landing (the ride lab's), with a combo in hand.
    const state = staged("tricks", {
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -0.7,
    });
    state.tricks.base = 400;
    state.tricks.mult = 3;
    const events = ride(state, 2, () => ({ throttle: 0 }));
    const bail = events.find((e) => e.kind === "bail");
    expect(bail?.kind === "bail" && bail.cause).toBe("wipeout");
    // What was in hand, and the fall's own air besides.
    expect(bail?.kind === "bail" && bail.lost).toBeGreaterThanOrEqual(1200);
    expect(state.tricks.score).toBe(0);
  });

  it("a sketchy landing banks it at its base alone", () => {
    // Flat from high: the suspension bottoms.
    const state = staged("tricks", { ...LAUNCH, height: 6, vy: 2 });
    state.tricks.base = 400;
    state.tricks.mult = 3;
    const events = ride(state, 3, () => ({ throttle: 0 }));
    const combo = events.find((e) => e.kind === "combo");
    expect(combo?.kind === "combo" && combo.sketchy).toBe(true);
    expect(combo?.kind === "combo" && combo.mult).toBe(1);
    expect(state.tricks.score).toBeLessThan(1200);
  });
});

describe("the tricks run", () => {
  it("ends at its buzzer and pays what is in hand", () => {
    const state = createGame({ level: flatLevel(), mode: "tricks", quiet: true });
    expect(state.rules.tricks).toBe(true);
    expect(state.rules.course).toBe(false);
    expect(state.rules.rivals).toBe(0);
    state.rules.limit = 1;
    state.tricks.base = 250;
    const events = ride(state, 5, () => ({}));
    expect(events.filter((e) => e.kind === "finish")).toHaveLength(1);
    expect(state.phase).toBe("finished");
    expect(state.tricks.score).toBe(250);
  });

  it("every other mode keeps no buzzer and turns no tricks", () => {
    for (const mode of ["race", "timeTrial", "free"] as const) {
      const state = createGame({ level: flatLevel(), mode, quiet: true });
      expect(state.rules.tricks).toBe(false);
      expect(state.rules.limit).toBe(0);
    }
  });
});

describe("the air's two halves", () => {
  it("weigh the same at the reference speed", () => {
    const T = TUNING.tricks;
    const v = T.lengthKnee / T.airKnee;
    const dt = 1e-3;
    let seconds = 0;
    let metres = 0;
    for (let t = 0; t < 3; t += dt) {
      seconds += airPointsPerSecond(t) * dt;
      metres += lengthPointsPerMetre(v * t) * v * dt;
    }
    expect(metres).toBeCloseTo(seconds, 6);
  });
});

describe("the trick field (R20)", () => {
  const seed = 3;
  const race = generateLevel(seed);
  const tricks = generateLevel(seed, { tricks: true });
  const field = (tricks.kickers ?? []).filter((k) => k.trick);
  const F = LEVEL_RULES.trick;

  it("is laid only on a map asked for one, on the seed's own loop", () => {
    expect((race.kickers ?? []).some((k) => k.trick)).toBe(false);
    expect(field.length).toBeGreaterThanOrEqual(F.count.min);
    expect(field.length).toBeLessThanOrEqual(F.count.max);
    expect(tricks.attempt).toBe(race.attempt);
    expect(tricks.track.length).toBe(race.track.length);
    expect(tricks.checkpoints.map((c) => c.s)).toEqual(race.checkpoints.map((c) => c.s));
  });

  it("is graded, spaced and clear of the start line", () => {
    field.forEach((k, i) => {
      expect(k.height).toBe(F.heights[i % F.heights.length]);
      expect((k.s ?? 0) - k.ramp).toBeGreaterThanOrEqual(F.lead - 1e-6);
      expect((k.s ?? 0) + k.landing).toBeLessThanOrEqual(tricks.track.length - F.lead + 1e-6);
      const next = field[i + 1];
      if (next)
        expect((next.s ?? 0) - next.ramp - ((k.s ?? 0) + k.landing)).toBeGreaterThan(F.gap - 1e-6);
      // Stamped: the lip stands its height over the graded line (less what
      // the two-metre grid shaves off a kink).
      const lift = tricks.groundAt(k.x, k.z) - race.groundAt(k.x, k.z);
      expect(lift).toBeGreaterThan(k.height * 0.85);
      expect(lift).toBeLessThan(k.height + 0.01);
    });
  });

  it("passes its own analysis", () => {
    const errors = analyzeLevel(tricks).findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("is what a tricks run is ridden on", () => {
    const state = createGame({ seed, mode: "tricks", quiet: true });
    expect((state.level.kickers ?? []).filter((k) => k.trick)).toHaveLength(field.length);
  });
});

describe("the score as read (strings.ts, trick-tile.ts)", () => {
  it("names a combo in the order it was won, a revolution read into its first", () => {
    expect(
      comboLine([
        { kind: "air", spins: 1, flight: 1 },
        { kind: "backflip", spins: 1, flight: 1 },
        { kind: "backflip", spins: 2, flight: 1 },
        { kind: "spin", spins: 1, flight: 1 },
        { kind: "twist", spins: 1, flight: 1 },
        { kind: "canCan", spins: 1, flight: 2 },
      ]),
    ).toBe("BIG AIR + DOUBLE BACKFLIP + 360 + TWIST + CAN-CAN");
    expect(comboLine([{ kind: "spin", spins: 2, flight: 1 }])).toBe("720");
  });

  it("is up on a tricks run only, with the combo in hand and then what it paid", () => {
    expect(comboTile(staged("race"))).toBeNull();
    const state = staged();
    ride(state, 1.8, BACKFLIP);
    const inAir = comboTile(state);
    expect(inAir?.combo?.line).toBe("BIG AIR + BACKFLIP");
    expect(inAir?.combo?.mult).toBe(3);
    ride(state, 1.6, () => ({}));
    const after = comboTile(state);
    expect(after?.combo).toBeNull();
    expect(after?.last?.points).toBe(state.tricks.score);
    expect(after?.left).toBeCloseTo(state.rules.limit - state.progress.time, 6);
  });
});
