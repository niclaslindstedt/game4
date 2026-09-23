// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE: the start line first, then every checkpoint in order and the
// line again to close a lap; a checkpoint gone past is flagged and not
// credited; the laps and the flag; the reset, asked for and automatic.

import { describe, expect, it } from "vitest";

import {
  bearingToNext,
  createGame,
  crossedCheckpoint,
  crossingsToFinish,
  fromEuler,
  NEUTRAL_INPUT,
  placeRun,
  resetPose,
  step,
  TUNING,
  type Checkpoint,
  type GameEvent,
  type GameState,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

/** Teleport the sled across a checkpoint's line along its heading: stand it
 * a step short, then let one step carry it over. */
function crossAt(state: GameState, cp: Checkpoint, lateral = 0): GameEvent[] {
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  placeRun(state, {
    x: cp.x - fx * 0.1 + rx * lateral,
    z: cp.z - fz * 0.1 + rz * lateral,
    heading: cp.heading,
    speed: 20,
  });
  step(state, { ...NEUTRAL_INPUT, throttle: 1 });
  return [...state.events];
}

function freshRace(laps = 2): GameState {
  return createGame({ level: syntheticLevel({ laps }), rivals: 0, countdown: 0, quiet: true });
}

describe("crossing a checkpoint", () => {
  const cp: Checkpoint = { x: 0, z: 0, y: 0, heading: 0, width: 10, s: 0 };
  it("counts a move through its width in its facing direction", () => {
    expect(crossedCheckpoint(cp, 1, -1, 1, 1)).toBeCloseTo(1);
    expect(crossedCheckpoint(cp, 6, -1, 6, 1)).toBeCloseTo(6); // within the grace
    expect(crossedCheckpoint(cp, 9, -1, 9, 1)).toBeNull();
    expect(crossedCheckpoint(cp, 1, 1, 1, -1)).toBeNull(); // backwards
  });
});

describe("the race's order", () => {
  it("owes the start line first, then each checkpoint in turn, and counts laps", () => {
    const state = freshRace(2);
    const cps = state.level.checkpoints;
    expect(state.progress.nextCheckpoint).toBe(0);
    const first = crossAt(state, cps[0]);
    expect(first.some((e) => e.kind === "checkpoint" && e.index === 0)).toBe(true);
    expect(state.progress.started).toBe(true);
    expect(state.progress.lap).toBe(0);
    for (let lap = 1; lap <= 2; lap++) {
      for (let i = 1; i < cps.length; i++) crossAt(state, cps[i]);
      const closing = crossAt(state, cps[0]);
      expect(closing.some((e) => e.kind === "lap" && e.lap === lap)).toBe(true);
      expect(state.progress.lap).toBe(lap);
    }
    expect(state.progress.finished).toBe(true);
    expect(state.phase).toBe("finished");
    expect(state.progress.passed).toBe(crossingsToFinish(state));
    expect(state.progress.lapTimes).toHaveLength(2);
  });

  it("does not credit a checkpoint out of turn, and flags the one gone past", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const skipped = crossAt(state, cps[2]);
    expect(skipped.some((e) => e.kind === "checkpoint")).toBe(false);
    expect(state.progress.nextCheckpoint).toBe(1);
    const missed = crossAt(state, cps[2]);
    expect(missed.some((e) => e.kind === "checkpoint")).toBe(false);
    // Gone past checkpoint 1 when crossing 2's line: the arrow points back.
    crossAt(state, cps[1], 30);
    expect(state.progress.nextCheckpoint).toBe(1);
    const back = crossAt(state, cps[1]);
    expect(back.some((e) => e.kind === "checkpoint" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBeNull();
  });

  it("flags a checkpoint ridden past", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const events = crossAt(state, cps[2]);
    expect(events.some((e) => e.kind === "missed" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBe(1);
    const bearing = bearingToNext(state)!;
    expect(bearing.index).toBe(1);
  });

  it("does not count a crossing outside the checkpoint's width", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const wide = crossAt(state, cps[1], cps[1].width / 2 + TUNING.course.grace + 3);
    expect(wide.some((e) => e.kind === "checkpoint")).toBe(false);
  });

  it("is generous on the start line's first crossing only", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    const off = cps[0].width / 2 + TUNING.course.grace + TUNING.course.startGrace / 2;
    expect(crossAt(state, cps[0], off).some((e) => e.kind === "checkpoint")).toBe(true);
    for (let i = 1; i < cps.length; i++) crossAt(state, cps[i]);
    expect(crossAt(state, cps[0], off).some((e) => e.kind === "lap")).toBe(false);
  });
});

describe("the reset", () => {
  it("stands the sled on the track past the last checkpoint taken, at rest", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    crossAt(state, cps[1]);
    placeRun(state, { x: 300, z: 200, heading: 1, speed: 10 });
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.events.some((e) => e.kind === "reset" && e.checkpoint === 1 && !e.auto)).toBe(
      true,
    );
    const c = state.sled;
    expect(Math.hypot(c.x - cps[1].x, c.z - cps[1].z)).toBeLessThan(TUNING.course.resetAhead + 1);
    expect(c.speed).toBe(0);
    expect(state.level.packedAt(c.x, c.z)).toBe(1);
    expect(state.progress.nextCheckpoint).toBe(2);
  });

  it("before the start line, stands the sled short of it", () => {
    const state = freshRace();
    const pose = resetPose(state);
    expect(pose.checkpoint).toBe(-1);
    const cp = state.level.checkpoints[0];
    const along = (pose.x - cp.x) * Math.sin(cp.heading) + (pose.z - cp.z) * Math.cos(cp.heading);
    expect(along).toBeLessThan(0);
  });

  it("happens by itself to a sled left on its back", () => {
    const state = freshRace();
    placeRun(state, { x: 300, z: 300, heading: 0 });
    state.sled.q = fromEuler(0, 0, Math.PI);
    state.sled.y += 1;
    const events: GameEvent[] = [];
    for (let i = 0; i < 5 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      events.push(...state.events);
    }
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
  });

  it("happens by itself to a sled held at full throttle going nowhere", () => {
    const state = freshRace();
    placeRun(state, { x: 300, z: 300, heading: 0 });
    const events: GameEvent[] = [];
    // Pinned: its way taken off it every step, as a sled wedged in a drift.
    for (let i = 0; i < 5 * TUNING.physicsHz; i++) {
      state.sled.vx = state.sled.vz = 0;
      step(state, { ...NEUTRAL_INPUT, throttle: 1 });
      state.sled.vx = state.sled.vz = 0;
      events.push(...state.events);
      if (events.some((e) => e.kind === "reset")) break;
    }
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
  });
});

describe("the lights", () => {
  it("count three, then GO, and hold the sled until then", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    expect(state.phase).toBe("countdown");
    const events: GameEvent[] = [];
    const x0 = state.sled.x;
    const z0 = state.sled.z;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, throttle: 1 });
      events.push(...state.events);
      if (state.phase === "countdown") {
        expect(Math.hypot(state.sled.x - x0, state.sled.z - z0)).toBeLessThan(0.3);
        expect(state.progress.time).toBe(0);
      }
    }
    expect(
      events.filter((e) => e.kind === "count").map((e) => e.kind === "count" && e.left),
    ).toEqual([3, 2, 1]);
    expect(events.some((e) => e.kind === "go")).toBe(true);
    expect(state.phase).toBe("racing");
    expect(state.progress.time).toBeGreaterThan(0.9);
  });
});
