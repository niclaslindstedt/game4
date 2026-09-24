// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT, THE TRENCH AND THE DAMAGE: a hard trunk, a nose-in landing
// and a rollover at speed each put the rider off, and nothing short of them
// does; he tumbles on his own and the reset stands them both back up; a
// sled bogged in powder digs itself in and is rocked back out; and a blow
// bends the machine only on a run that asked for damage.

import { describe, expect, it } from "vitest";

import {
  botInput,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  RAGDOLL,
  skiPull,
  SLEDS,
  step,
  trenchGrip,
  TUNING,
  type GameEvent,
  type GameState,
  type RunMoment,
  type SledInput,
  type Thrown,
} from "@engine";
import { flatLevel, LONE_TREE, STADIUM, syntheticLevel } from "./support/synthetic.ts";

const FULL: SledInput = { ...NEUTRAL_INPUT, throttle: 1 };

function ride(
  state: GameState,
  seconds: number,
  input: SledInput | ((t: number) => SledInput),
): GameEvent[] {
  const events: GameEvent[] = [];
  const t0 = state.t;
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, typeof input === "function" ? input(state.t - t0) : input);
    events.push(...state.events);
  }
  return events;
}

function staged(level = flatLevel({ packed: 1 }), moment: RunMoment, damage = false): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, damage, quiet: true });
  placeRun(state, moment);
  return state;
}

const atTree = (offset: number, kmh: number, damage = false): GameState =>
  staged(
    syntheticLevel(),
    { x: LONE_TREE.x + offset, z: LONE_TREE.z - 30, heading: 0, speed: kmh / 3.6 },
    damage,
  );

const wipeouts = (events: GameEvent[]) => events.filter((e) => e.kind === "wipeout");

/** How far up the sky his spine points: 1 stood, 0 lying flat. */
function spineUp(b: Thrown): number {
  const P = b.points;
  const at = (i: number, k: number) => P[3 * i + k];
  const R = RAGDOLL;
  const d = [0, 1, 2].map(
    (k) => at(R.shoulderL, k) + at(R.shoulderR, k) - at(R.hipL, k) - at(R.hipR, k),
  );
  return d[1] / Math.hypot(d[0], d[1], d[2]);
}

describe("the wipeout", () => {
  it("a trunk met hard throws the rider on, and the reset stands them up", () => {
    const state = atTree(0.4, 50);
    const events: GameEvent[] = [];
    let off: GameState["sled"]["thrown"] = null;
    let first: GameState["sled"]["thrown"] = null;
    const tree = state.level.trees.find((t) => t.x === LONE_TREE.x)!;
    let closest = Infinity;
    for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
      step(state, FULL);
      events.push(...state.events);
      if (state.sled.thrown) {
        off = { ...state.sled.thrown };
        first ??= off;
        for (let k = 0; k < RAGDOLL.count; k++) {
          const px = off.points[3 * k];
          const pz = off.points[3 * k + 2];
          if (off.points[3 * k + 1] < tree.y + tree.height) {
            closest = Math.min(closest, Math.hypot(px - tree.x, pz - tree.z));
          }
        }
      }
      if (events.some((e) => e.kind === "reset")) break;
    }
    const w = wipeouts(events);
    expect(w).toHaveLength(1);
    expect(w[0].kind === "wipeout" && w[0].cause).toBe("tree");
    // He left the saddle at the way the sled had before the trunk took it —
    // met the trunk himself, no part of him passing through it — went over,
    // and came to rest lying on the snow.
    expect(off).not.toBeNull();
    expect(first!.vz).toBeGreaterThan(0.8 * TUNING.crash.keep * (50 / 3.6));
    expect(closest).toBeGreaterThanOrEqual(tree.radius + TUNING.crash.body.limb - 1e-6);
    expect(off!.tumble).toBeGreaterThan(Math.PI / 2);
    expect(Math.abs(spineUp(off!))).toBeLessThan(0.35);
    const reset = events.find((e) => e.kind === "reset");
    expect(reset && reset.kind === "reset" && reset.auto).toBe(true);
    expect(reset!.t - w[0].t).toBeGreaterThanOrEqual(TUNING.crash.lieMin - 1e-9);
    expect(reset!.t - w[0].t).toBeLessThanOrEqual(TUNING.crash.lieMax + TUNING.dt);
    expect(state.sled.thrown).toBeNull();
  });

  it("lies down in the snow as a body does — and deep powder stops him soonest", () => {
    // Over the bars at 60 km/h onto the groomer, onto ordinary powder and
    // onto the deepest: he lands, goes over, slides and lies still, flat —
    // not rolling on like a wheel — and the deeper the snow the sooner.
    const lie = (packed: number, snowDepth: number) => {
      const state = createGame({
        level: flatLevel({ packed }),
        rivals: 0,
        countdown: 0,
        quiet: true,
        snowDepth,
      });
      placeRun(state, {
        x: 1500,
        z: 200,
        heading: 0,
        speed: 60 / 3.6,
        height: 2.5,
        vy: -3,
        pitch: -0.7,
      });
      let body: Thrown | null = null;
      let down = -1;
      for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
        step(state, NEUTRAL_INPUT);
        const b = state.sled.thrown;
        if (!b) {
          if (body) break;
          continue;
        }
        body = { ...b, points: b.points.slice() };
        if (down < 0 && b.touching) down = b.tumble;
      }
      expect(body).not.toBeNull();
      const b = body!;
      const from = { x: 1500, z: 200 };
      return {
        slid: Math.hypot(b.x - from.x, b.z - from.z),
        rolled: b.tumble - down,
        flat: Math.abs(spineUp(b)),
        still: b.still,
      };
    };
    const groomer = lie(1, 1);
    const powder = lie(0, 1);
    const deep = lie(0, 2);
    for (const r of [groomer, powder, deep]) {
      expect(r.still).toBeGreaterThan(0);
      expect(r.flat).toBeLessThan(0.35);
      // On the snow he goes over a turn at the most, never over and over.
      expect(r.rolled).toBeLessThan(2 * Math.PI);
    }
    expect(powder.slid).toBeLessThan(groomer.slid - 5);
    expect(deep.slid).toBeLessThanOrEqual(powder.slid);
    expect(deep.rolled).toBeLessThanOrEqual(groomer.rolled + 1e-9);
  });

  it("a trunk clipped slowly is a hit he holds on through", () => {
    const state = atTree(0.7, 25);
    const events = ride(state, 5, (t) => ({ ...FULL, throttle: t < 1 ? 0.4 : 0.1 }));
    expect(events.some((e) => e.kind === "hit")).toBe(true);
    expect(wipeouts(events)).toHaveLength(0);
  });

  it("with the rider off, the sled is let go and takes no checkpoint", () => {
    const state = atTree(0.4, 50);
    ride(state, 2.4, FULL);
    expect(state.sled.thrown).not.toBeNull();
    const passed = state.progress.passed;
    ride(state, 0.5, FULL);
    expect(state.sled.throttle).toBeLessThan(0.05);
    expect(state.progress.passed).toBe(passed);
  });

  it("a landing taken on the nose goes over the bars; the same drop level does not", () => {
    const drop = (pitch: number): GameEvent[] =>
      ride(
        staged(undefined, {
          x: 1500,
          z: 200,
          heading: 0,
          speed: 60 / 3.6,
          height: 2.5,
          vy: -3,
          pitch,
        }),
        2,
        NEUTRAL_INPUT,
      );
    const nose = wipeouts(drop(-0.7));
    expect(nose).toHaveLength(1);
    expect(nose[0].kind === "wipeout" && nose[0].cause).toBe("nose");
    const flat = drop(0);
    expect(flat.some((e) => e.kind === "land")).toBe(true);
    expect(wipeouts(flat)).toHaveLength(0);
  });

  it("a stock kicker overshot at race speed is ridden out", () => {
    // Launched at 100–118 km/h, 1.4–1.6 s up under the arcade's heavier air,
    // and down on the flat past the landing tail-first up to 23° nose-up, at
    // 11–12 m/s into the snow: a hard landing, and no machine in the catalog
    // throws its rider for it.
    for (const spec of SLEDS) {
      const state = createGame({
        level: syntheticLevel(),
        rivals: 0,
        countdown: 0,
        spec,
        quiet: true,
      });
      placeRun(state, {
        x: STADIUM.kickerX + 70,
        z: STADIUM.zMid + STADIUM.radius,
        heading: -Math.PI / 2,
        speed: 75 / 3.6,
      });
      const events = ride(state, 6, FULL);
      expect(
        events.some((e) => e.kind === "land" && e.airTime > 1.2),
        spec.id,
      ).toBe(true);
      expect(wipeouts(events), spec.id).toHaveLength(0);
    }
  });

  it("a rollover at speed puts him off; the same roll at a crawl does not", () => {
    const over = (kmh: number): GameEvent[] =>
      ride(
        staged(undefined, {
          x: 1500,
          z: 200,
          heading: 0,
          speed: kmh / 3.6,
          height: 1.6,
          roll: 1.35,
        }),
        2,
        FULL,
      );
    const fast = wipeouts(over(70));
    expect(fast).toHaveLength(1);
    expect(fast[0].kind === "wipeout" && fast[0].cause).toBe("roll");
    expect(wipeouts(over(10))).toHaveLength(0);
  });

  it("on a free ride, the reset after a wipeout stands them on the nearest track", () => {
    const state = createGame({ level: syntheticLevel(), mode: "free", quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.4, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const events = ride(state, 6, FULL);
    expect(wipeouts(events)).toHaveLength(1);
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
    expect(state.level.packedAt(state.sled.x, state.sled.z)).toBe(1);
  });

  it("a time trial with a wipeout in it still reaches its flag", () => {
    const state = createGame({
      level: syntheticLevel({ laps: 1 }),
      seed: 7,
      mode: "timeTrial",
      laps: 1,
      quiet: true,
    });
    placeRun(state, { x: LONE_TREE.x + 0.4, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const events = ride(state, 4.5, FULL);
    expect(wipeouts(events)).toHaveLength(1);
    for (let i = 0; i < 300 * TUNING.physicsHz && !state.progress.finished; i++) {
      step(state, botInput(state));
    }
    expect(state.progress.finished).toBe(true);
  });

  it("is a pure function of the moment: two crashes are the same crash", () => {
    const a = atTree(0.4, 50);
    const b = atTree(0.4, 50);
    ride(a, 3.2, FULL);
    ride(b, 3.2, FULL);
    expect(a.sled.thrown).not.toBeNull();
    expect(b.sled.thrown).toEqual(a.sled.thrown);
  });
});

describe("the trench", () => {
  /** A sled pinned in powder at full throttle: its way taken off it. */
  function pinned(seconds: number, state: GameState, input = FULL): GameEvent[] {
    const events: GameEvent[] = [];
    for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
      state.sled.vx = state.sled.vz = 0;
      step(state, input);
      events.push(...state.events);
    }
    return events;
  }
  const inPowder = () => staged(flatLevel({ packed: 0 }), { x: 1500, z: 300, heading: 0 });

  it("digs a sled bogged in powder in, and says so once", () => {
    const state = inPowder();
    const events = pinned(4, state);
    expect(events.filter((e) => e.kind === "stuck")).toHaveLength(1);
    expect(state.sled.trench).toBeGreaterThan(TUNING.trench.stuckAt);
    expect(state.sled.trench).toBeLessThanOrEqual(TUNING.trench.max);
    expect(trenchGrip(state.sled.trench)).toBeLessThan(1);
    // A launch out of the same powder never gets near it.
    const launch = staged(flatLevel({ packed: 0 }), { x: 1500, z: 300, heading: 0 });
    ride(launch, 4, FULL);
    expect(launch.sled.trench).toBe(0);
  });

  it("is rocked back out, and the reset waits for the rider to try", () => {
    const state = inPowder();
    pinned(3, state);
    const dug = state.sled.trench;
    expect(dug).toBeGreaterThan(0.1);
    // Rocked: the lean fore and aft and the bars side to side, off the gas.
    const rock = (t: number): SledInput => {
      const s = Math.sin(2 * Math.PI * 1.2 * t) >= 0 ? 1 : -1;
      return { ...NEUTRAL_INPUT, throttle: 0.35, steer: s, lean: s };
    };
    const events = ride(state, 4, rock);
    expect(state.sled.trench).toBeLessThan(dug / 2);
    expect(events.some((e) => e.kind === "reset")).toBe(false);
  });

  it("stands a sled that never gets out back up after its own hold", () => {
    const state = inPowder();
    const events = pinned(TUNING.trench.holdFor + 3, state);
    const reset = events.find((e) => e.kind === "reset");
    expect(reset && reset.kind === "reset" && reset.auto).toBe(true);
    expect(reset!.t).toBeGreaterThan(TUNING.trench.holdFor);
  });
});

describe("damage", () => {
  it("is off unless asked for: a trunk bends nothing", () => {
    const state = atTree(0.4, 50);
    const events = ride(state, 3, FULL);
    expect(events.some((e) => e.kind === "damage")).toBe(false);
    expect(state.sled.damage).toEqual({ ski: [0, 0], suspension: 0 });
    expect(skiPull(state.sled)).toBe(0);
  });

  it("bends the ski on the side the trunk was met, and says so", () => {
    const state = atTree(0.6, 40, true);
    const events = ride(state, 3, FULL);
    const d = state.sled.damage;
    // The trunk stood left of the sled's line (it passed right of it).
    expect(d.ski[0]).toBeGreaterThan(d.ski[1]);
    expect(events.some((e) => e.kind === "damage" && e.part === "skiLeft")).toBe(true);
  });

  it("a bent ski pulls a sled ridden straight toward its side", () => {
    const run = (bent: [number, number]): number => {
      const state = staged(flatLevel({ packed: 1 }), {
        x: 1500,
        z: 200,
        heading: 0,
        speed: 60 / 3.6,
      });
      state.damage = true;
      state.sled.damage.ski = bent;
      ride(state, 4, { ...FULL, throttle: 0.5 });
      return state.sled.x - 1500;
    };
    expect(run([0, 0])).toBeCloseTo(0, 1);
    expect(run([0, 1])).toBeGreaterThan(5);
    expect(run([1, 0])).toBeLessThan(-5);
  });

  it("a landing the suspension could not take hurts it", () => {
    const state = staged(
      flatLevel({ packed: 1 }),
      { x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 5, vy: -4 },
      true,
    );
    const events = ride(state, 2, NEUTRAL_INPUT);
    const land = events.find((e) => e.kind === "land");
    expect(land && land.kind === "land" && land.harsh).toBe(true);
    expect(state.sled.damage.suspension).toBeGreaterThan(0);
  });

  it("is never dealt to a rival", () => {
    const state = createGame({ level: syntheticLevel(), damage: true, quiet: true });
    expect(state.damage).toBe(true);
    for (const r of state.rivals) expect(r.run.damage).toBe(false);
  });
});
