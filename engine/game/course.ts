// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE — the checkpoints in order, the laps, the flag, and the way
// back onto the track.
//
// A CHECKPOINT is a line across the track, crossed by a move through it in
// its facing direction within its width (plus `course.grace` either side:
// at gate range, "did I clip that?" is answered in the rider's favour).
// ONE IS LIVE AT A TIME — the one the run owes — and nothing else counts:
// a rider who skips a checkpoint is not disqualified, the next one is simply
// not credited until the skipped one is taken, and the HUD's arrow points him
// back at it (`Progress.missed`, `bearingToNext`).
//
// THE LAPS: the grid stands on the track behind the start line and the run
// owes the START LINE (checkpoint 0) first — crossing it opens lap one. Then 1, 2, …
// the last, and 0 again closes the lap; after `rules.laps` of them the flag.
// So a race of `n` checkpoints over `L` laps is `1 + n·L` crossings, and the
// standings count them (`rivals.ts`).
//
// THE RESET stands the sled on the track a few metres past the last
// checkpoint it took, facing along it, at rest — or just short of the start
// line before it has taken one. It is the rider's (the key) and the
// engine's (`run.ts`: on its back, or held at full throttle going nowhere).

import { angleDiff } from "../lib/math.ts";
import { fromEuler } from "../lib/quat.ts";
import { nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Checkpoint, Level, Spawn } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./sled.ts";
import { depthUnder, packedUnder, sinkTarget } from "./snow.ts";
import { probesOf } from "./suspension.ts";
import type { GameEvent, GameState, Progress } from "./state.ts";

const K = TUNING.course;

export function freshProgress(level: Level): Progress {
  return {
    nextCheckpoint: 0,
    started: false,
    lap: 0,
    passed: 0,
    lastCheckpoint: -1,
    splits: level.checkpoints.map(() => NaN),
    lapTimes: [],
    lapStart: 0,
    time: 0,
    finished: false,
    missed: null,
    lastPassedAt: 0,
    lastResetAt: 0,
    bestAir: 0,
    distance: 0,
  };
}

/** Whether a plan move from (x0, z0) to (x1, z1) crossed the checkpoint's
 * line in its facing direction, and how far off its centre, m (positive to
 * the right); null if it did not cross at all. The width is not applied. */
export function crossedLine(
  cp: Checkpoint,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number | null {
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const s0 = (x0 - cp.x) * fx + (z0 - cp.z) * fz;
  const s1 = (x1 - cp.x) * fx + (z1 - cp.z) * fz;
  if (!(s0 < 0 && s1 >= 0)) return null;
  const f = s0 / (s0 - s1);
  const cx = x0 + (x1 - x0) * f;
  const cz = z0 + (z1 - z0) * f;
  return (cx - cp.x) * fz - (cz - cp.z) * fx;
}

/** Whether the move went THROUGH the checkpoint — inside its width and the
 * grace, and `extra` metres more — returning the offset, or null. */
export function crossedCheckpoint(
  cp: Checkpoint,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  extra = 0,
): number | null {
  const lateral = crossedLine(cp, x0, z0, x1, z1);
  if (lateral === null) return null;
  return Math.abs(lateral) <= cp.width / 2 + K.grace + extra ? lateral : null;
}

/** How many crossings a whole race is: the start line, then every
 * checkpoint once a lap. */
export function crossingsToFinish(state: GameState): number {
  return 1 + state.level.checkpoints.length * state.rules.laps;
}

/** Check the move the sled just made against the checkpoint the run owes.
 * The clock is run by `run.ts`, not here. */
export function stepCourse(state: GameState, x0: number, z0: number, events: GameEvent[]): void {
  const p = state.progress;
  if (p.finished) return;
  const cps = state.level.checkpoints;
  const n = cps.length;
  const c = state.sled;
  const owed = p.nextCheckpoint;
  const extra = p.started ? 0 : K.startGrace;
  if (crossedCheckpoint(cps[owed], x0, z0, c.x, c.z, extra) !== null) {
    p.passed += 1;
    p.lastCheckpoint = owed;
    p.splits[owed] = p.time;
    p.lastPassedAt = p.time;
    if (p.missed === owed) p.missed = null;
    p.nextCheckpoint = (owed + 1) % n;
    events.push({ kind: "checkpoint", t: state.t, index: owed, lap: p.lap, split: p.time });
    if (owed === 0) {
      if (!p.started) {
        p.started = true;
        p.lapStart = p.time;
      } else {
        p.lap += 1;
        const lapTime = p.time - p.lapStart;
        p.lapTimes.push(lapTime);
        p.lapStart = p.time;
        events.push({ kind: "lap", t: state.t, lap: p.lap, time: lapTime });
        if (p.lap >= state.rules.laps) {
          p.finished = true;
          p.missed = null;
          state.phase = "finished";
          events.push({ kind: "finish", t: state.t, time: p.time, place: placeOf(state) });
        }
      }
    }
    return;
  }
  // THE ARROW: crossing the NEXT checkpoint's line while this one is still
  // owed is a checkpoint gone past. Nothing is charged; the HUD points back.
  if (p.missed !== owed && crossedCheckpoint(cps[(owed + 1) % n], x0, z0, c.x, c.z) !== null) {
    p.missed = owed;
    events.push({ kind: "missed", t: state.t, index: owed });
  }
}

/** Where a run that has just finished stands: one more than the rivals
 * already home. A rival's own run has no field, so it reads 1 here and the
 * standings are the player's to work out (`racePlace`). */
function placeOf(state: GameState): number {
  let ahead = 0;
  for (const r of state.rivals) if (r.run.progress.finished) ahead += 1;
  return ahead + 1;
}

/** Where a reset stands the sled: on the track's centreline a few metres
 * past the last checkpoint taken (or short of the start line), facing
 * along the track. On a FREE RIDE, where no checkpoint is owed, it is the
 * point of the centreline nearest the sled — the groomer the rider was
 * last closest to, facing the way the loop runs there. */
export function resetPose(state: GameState): {
  x: number;
  z: number;
  heading: number;
  checkpoint: number;
} {
  if (!state.rules.course) {
    const near = nearestTrackPoint(state.level, state.sled.x, state.sled.z);
    const at = trackPointAt(state.level, near.s);
    return { x: at.x, z: at.z, heading: at.heading, checkpoint: -1 };
  }
  const cps = state.level.checkpoints;
  const last = state.progress.lastCheckpoint;
  const s = last < 0 ? cps[0].s - K.resetAhead * 2 : cps[last].s + K.resetAhead;
  const at = trackPointAt(state.level, s);
  return { x: at.x, z: at.z, heading: at.heading, checkpoint: last };
}

/** Put the sled down at rest at a plan point and heading, standing on its
 * suspension at its rest sag on the snow there, pitched and rolled to the
 * slope. */
export function standSled(state: GameState, x: number, z: number, heading: number): void {
  const c = state.sled;
  const level = state.level;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const L = c.spec.length / 2;
  const W = c.spec.skiStance / 2;
  const pitch = Math.atan2(
    level.groundAt(x + fx * L, z + fz * L) - level.groundAt(x - fx * L, z - fz * L),
    2 * L,
  );
  const roll = Math.atan2(
    level.groundAt(x - fz * W, z + fx * W) - level.groundAt(x + fz * W, z - fx * W),
    2 * W,
  );
  const packed = packedUnder(level.packedAt(x, z), state.fresh);
  const depth = depthUnder(state.snowDepth, state.fresh);
  const probes = probesOf(c.spec);
  for (let i = 0; i < probes.length; i++) {
    c.sinks[i] = sinkTarget(packed, 0, probes[i].sinkScale, 1, depth);
  }
  c.x = x;
  c.z = z;
  c.y = level.groundAt(x, z) - c.sinks[probes.length - 1] + c.spec.cogHeight;
  c.vx = c.vy = c.vz = 0;
  c.q = fromEuler(heading, pitch, roll);
  c.wx = c.wy = c.wz = 0;
  c.rpm = c.spec.idleRpm;
  c.throttle = 0;
  c.brake = 0;
  c.steer = 0;
  c.lean = 0;
  c.skiAngle = 0;
  c.riderRight = 0;
  c.riderAft = 0;
  c.treadSpeed = 0;
  c.slip = 0;
  c.packed = packed;
  c.airborne = false;
  c.airTime = 0;
  c.airReported = false;
  c.launchVy = 0;
  c.landing = 1e6;
  c.overFor = 0;
  c.stuckFor = 0;
  // Stood up out of its hole with the rider back on it; what the machine
  // has taken, it keeps.
  c.trench = 0;
  c.trenchFor = 0;
  c.boggedFor = 0;
  c.rolledFor = 0;
  c.thrown = null;
  c.hitCooldown = 0;
  c.bumpCooldown = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  c.comps.fill(0);
  derive(c);
}

/** How far clear of a trunk a free ride may be stood, m past its radius. */
const TREE_CLEAR = 2.5;

/** WHERE A FREE RIDE STARTS when the rider picked a spot on the chart: the
 * point held inside the map's edge (`TUNING.bounds`), facing the way the
 * loop runs at its nearest point — a direction the rider can read off the
 * chart — and, where the spot is inside a trunk, stood on that nearest
 * point of the track instead: a sled cannot be put down inside a tree. */
export function freeSpawn(level: Level, x: number, z: number): Spawn {
  const B = TUNING.bounds;
  const lo = B.margin + B.soft;
  const hi = level.size - lo;
  const px = Math.min(hi, Math.max(lo, x));
  const pz = Math.min(hi, Math.max(lo, z));
  const near = nearestTrackPoint(level, px, pz);
  const along = trackPointAt(level, near.s);
  for (const t of level.trees) {
    if (Math.hypot(t.x - px, t.z - pz) < t.radius + TREE_CLEAR) {
      return { x: along.x, z: along.z, heading: along.heading };
    }
  }
  return { x: px, z: pz, heading: along.heading };
}

/** `reset`: back on the track at the last checkpoint taken. */
export function resetSled(state: GameState, events: GameEvent[], auto: boolean): void {
  const pose = resetPose(state);
  standSled(state, pose.x, pose.z, pose.heading);
  state.progress.lastResetAt = state.progress.time;
  events.push({ kind: "reset", t: state.t, checkpoint: pose.checkpoint, auto });
}

/** The heading from the sled to the checkpoint the run owes, how far off
 * its own heading that is, and how far away — the HUD's arrow and the bot. */
export function bearingToNext(
  state: GameState,
): { bearing: number; error: number; distance: number; index: number } | null {
  const p = state.progress;
  if (p.finished) return null;
  const cp = state.level.checkpoints[p.nextCheckpoint];
  const c = state.sled;
  const bearing = Math.atan2(cp.x - c.x, cp.z - c.z);
  return {
    bearing,
    error: angleDiff(c.heading, bearing),
    distance: Math.hypot(cp.x - c.x, cp.z - c.z),
    index: p.nextCheckpoint,
  };
}
