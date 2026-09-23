// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD — the other riders in a race, from the grid they start on to
// the shoulder they lean on you with.
//
// A RIVAL IS A RUN. Each one is a whole `GameState` of its own — its sled,
// its progress, its input and its events — over the SAME world, sharing the
// player's level, rules and random stream by reference. So a rival is stepped
// by the very function the player is (`run.ts`), ridden by the very bot the
// sim rides (`sim/bot.ts`), and meets a tree, a kicker and a checkpoint
// exactly as the player's sled would. What tells one from the next is two
// draws off the run's own stream at the grid, so the same seed deals the
// same field: the throttle its bot is allowed (`Rival.pace`), and the
// machine it is on — any of the catalog's (`SLEDS`), so a drifted map has a
// mountain sled in the field as often as a groomed one has a trail sled.
//
// THE GRID is the level's (`Level.grid`): four slots side by side in the
// powder off the track, the player in the first. A field bigger than the
// level's grid stands its extra riders a row behind.
//
// SLED AGAINST SLED is two plan circles down each machine's length, pushed
// apart along the line between their centres with the closing speed traded
// at `RACE.bump.restitution` — a shoulder, not a solver: sleds are ridden
// side by side, and what matters is that they cannot pass through each other.

import { botInput } from "../sim/bot.ts";
import type { Spawn } from "../mapgen/types.ts";
import { freshProgress, standSled } from "./course.ts";
import { FULL_ASSIST, RACE } from "./defs/modes.ts";
import { SLEDS } from "./defs/sled.ts";
import { NEUTRAL_INPUT, type GameEvent, type GameState, type SledState } from "./state.ts";
import { stepRun } from "./run.ts";
import { freshSled } from "./sled.ts";

/** How far behind the level's grid an extra row stands, m. */
const ROW_BACK = 8;

/** Where slot `slot` of the grid stands. */
export function gridSlot(state: GameState, slot: number): Spawn {
  const grid = state.level.grid;
  if (slot < grid.length) return grid[slot];
  const base = grid[slot % grid.length];
  const row = Math.floor(slot / grid.length);
  return {
    x: base.x - Math.sin(base.heading) * ROW_BACK * row,
    z: base.z - Math.cos(base.heading) * ROW_BACK * row,
    heading: base.heading,
  };
}

/** STAND THE FIELD: `count` rivals, each on its slot with its pace and its
 * machine dealt.
 * Called once, from `createGame`, and only for a run with rivals in it. */
export function createRivals(state: GameState, count: number): void {
  state.rivals = [];
  for (let i = 0; i < count; i++) {
    const pace = state.rng.range(RACE.paceBand.min, RACE.paceBand.max);
    const run: GameState = {
      ...state,
      sled: freshSled(state.rng.pick(SLEDS)),
      input: { ...NEUTRAL_INPUT },
      // The player's help is the player's: the bot rides every rival with
      // every hand on, so a harder setting is a harder sled, not a slower field.
      assist: { ...FULL_ASSIST },
      // ...and so is his damage: a rival's machine is never bent.
      damage: false,
      progress: freshProgress(state.level),
      rivals: [],
      events: [],
    };
    const at = gridSlot(state, i + 1);
    standSled(run, at.x, at.z, at.heading);
    state.rivals.push({
      id: i,
      run,
      pace,
    });
  }
}

/** Step every rival by the step the world has just taken: the bot rides
 * each one's own run, throttled to its pace, under the player's lights. */
export function stepRivals(state: GameState): void {
  for (const rival of state.rivals) {
    const run = rival.run;
    run.t = state.t;
    run.tick = state.tick;
    run.countdown = state.countdown;
    run.phase = run.progress.finished
      ? "finished"
      : state.phase === "countdown"
        ? "countdown"
        : "racing";
    run.events.length = 0;
    const input = run.phase === "racing" ? botInput(run) : NEUTRAL_INPUT;
    run.input.steer = input.steer;
    run.input.throttle = Math.min(input.throttle, rival.pace);
    run.input.brake = input.brake;
    run.input.lean = input.lean;
    run.input.reset = input.reset;
    stepRun(run, run.input, run.events);
  }
}

/** Push two sleds apart if they overlap; returns the closing speed, m/s. */
function clipPair(a: SledState, b: SledState): number {
  const B = RACE.bump;
  let worst = 0;
  const af = { x: Math.sin(a.heading), z: Math.cos(a.heading) };
  const bf = { x: Math.sin(b.heading), z: Math.cos(b.heading) };
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      const ax = a.x + af.x * B.offset * sa;
      const az = a.z + af.z * B.offset * sa;
      const bx = b.x + bf.x * B.offset * sb;
      const bz = b.z + bf.z * B.offset * sb;
      const dx = bx - ax;
      const dz = bz - az;
      const d = Math.hypot(dx, dz);
      if (d >= 2 * B.radius || Math.abs(a.y - b.y) > 1.5) continue;
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      const pen = 2 * B.radius - d;
      a.x -= (nx * pen) / 2;
      a.z -= (nz * pen) / 2;
      b.x += (nx * pen) / 2;
      b.z += (nz * pen) / 2;
      const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (closing <= 0) continue;
      // Equal masses: each takes half the exchange.
      const j = ((1 + B.restitution) * closing) / 2;
      a.vx -= j * nx;
      a.vz -= j * nz;
      b.vx += j * nx;
      b.vz += j * nz;
      if (closing > worst) worst = closing;
    }
  }
  return worst;
}

/** Every sled against every other, once a step, after all have moved. The
 * player's own contacts are reported (`bump`). */
export function clipRiders(state: GameState, events: GameEvent[]): void {
  const n = state.rivals.length;
  if (n === 0) return;
  const me = state.sled;
  for (let i = 0; i < n; i++) {
    const r = state.rivals[i];
    const closing = clipPair(me, r.run.sled);
    if (closing >= RACE.bump.speed && me.bumpCooldown <= 0) {
      me.bumpCooldown = RACE.bump.cooldown;
      events.push({ kind: "bump", t: state.t, rival: r.id, speed: closing });
    }
    for (let k = i + 1; k < n; k++) clipPair(r.run.sled, state.rivals[k].run.sled);
  }
}

/** HOW FAR ROUND THE RACE A RUN IS: crossings credited, plus a share of the
 * way to the next checkpoint. The share is NOT floored at zero, so a rider
 * further back on the approach reads behind one nearer it. */
export function raceProgress(run: GameState): number {
  const p = run.progress;
  const cps = run.level.checkpoints;
  const next = cps[p.nextCheckpoint];
  const from = p.lastCheckpoint >= 0 ? cps[p.lastCheckpoint] : run.level.spawn;
  const leg = Math.hypot(next.x - from.x, next.z - from.z) || 1;
  const left = Math.hypot(next.x - run.sled.x, next.z - run.sled.z);
  return p.passed + Math.min(0.999, 1 - left / leg);
}

/** Whether run `a` stands ahead of run `b`: home first, by the clock; then
 * further round. */
function ahead(a: GameState, b: GameState): boolean {
  if (a.progress.finished || b.progress.finished) {
    if (a.progress.finished && b.progress.finished) return a.progress.time < b.progress.time;
    return a.progress.finished;
  }
  return raceProgress(a) > raceProgress(b);
}

/** THE WHOLE FIELD IN ORDER, best first: every rival's id, and `null`
 * where the player stands among them. */
export function fieldOrder(state: GameState): (number | null)[] {
  const runs: { id: number | null; run: GameState }[] = [
    { id: null, run: state },
    ...state.rivals.map((r) => ({ id: r.id, run: r.run })),
  ];
  runs.sort((a, b) => (ahead(a.run, b.run) ? -1 : ahead(b.run, a.run) ? 1 : 0));
  return runs.map((r) => r.id);
}

/** THE PLAYER'S PLACE, 1-based: one more than the rivals ahead of him. */
export function racePlace(state: GameState): number {
  let place = 1;
  for (const r of state.rivals) if (ahead(r.run, state)) place += 1;
  return place;
}
