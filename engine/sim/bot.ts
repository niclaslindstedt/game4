// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bot rider — a deterministic player stand-in that reads the same
// GameState the HUD reads and produces the same SledInput a thumb produces.
// It rides the TRACK'S CENTRELINE: a point a speed-dependent distance ahead
// of where it stands on the loop is what it steers at; it reads the bends
// coming and brakes for the ones it cannot take at the speed it has; off
// the track before the start line (a hand-built map's grid in the powder),
// it rides onto the track short of the line, so it crosses it riding along
// it; it levels the machine to the slope
// it is going to land on while in the air; it steers round a trunk in its
// way; and it asks to be reset when a checkpoint has not come for too long.
//
// It must never reach into the physics' internals: everything it knows it
// reads off the state, the level and `limits.ts`. The target is a COMPETENT
// rider — human capability, never a superhuman one: it sees the track ahead
// the way a rider does and brakes with the grip a rider has.

import { angleDiff, clamp } from "../lib/math.ts";
import { rotate } from "../lib/quat.ts";
import { arcAhead, nearestTrackPoint, trackPointAt } from "../mapgen/index.ts";
import type { Kicker, Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { treesNear } from "../game/collision.ts";
import { brakeDecel, cornerGrip, harshSpeedOf } from "../game/limits.ts";
import type { SledSpec } from "../game/defs/sled.ts";
import { NEUTRAL_INPUT, type GameState, type SledInput } from "../game/state.ts";

export type BotProfile = {
  /** How far ahead along the track the aim point stands, m, at rest, and
   * how many more metres per m/s of speed. */
  lookBase: number;
  lookPerSpeed: number;
  /** Steering gain on the bearing error, per radian, and how far ahead the
   * bot reads its own yaw rate, s — the correction is judged against the
   * heading the sled will have carried itself to. */
  steerGain: number;
  yawLead: number;
  /** In powder: how much further ahead the yaw is read (a share more of
   * `yawLead`), and how much of the gain is given up. */
  powderLead: number;
  powderEase: number;
  /** The share of the corner grip (`limits.ts`) the bot rides a bend at,
   * and of the braking grip it plans its braking on. */
  cornerShare: number;
  brakeShare: number;
  /** How far off the arc a bend is measured over, m, either side. */
  bendSpan: number;
  /** Pitch gains in the air: on the error to the slope ahead, and on the
   * pitch rate. */
  airGain: number;
  airDamp: number;
  /** Before the start line: how far short of it the bot aims onto the
   * track, as a share of how far off the track it is, and the least and
   * most that may be, m. */
  entryShare: number;
  entryMin: number;
  entryMax: number;
  /** How far ahead it watches for a trunk, m, how wide a corridor, m, and
   * how far off its line it moves its aim to miss one, m. */
  treeLook: number;
  treeCorridor: number;
  dodge: number;
  /** Seconds without a checkpoint before it asks to be reset. */
  giveUpAfter: number;
  /** The least speed any turn is planned at, m/s — a sled slower than this
   * steers poorly and bogs in powder. */
  crawl: number;
  /** The share of the harsh-landing speed (`air.harshSpeed`) a kicker is
   * planned to be landed under. */
  kickerMargin: number;
  /** The turn onto the track out of the grid's lane is planned at this
   * radius, m. */
  entryRadius: number;
};

export const RIDER_BOT: BotProfile = {
  lookBase: 7,
  lookPerSpeed: 0.45,
  steerGain: 1.8,
  yawLead: 0.5,
  powderLead: 1,
  powderEase: 0.45,
  cornerShare: 0.65,
  brakeShare: 0.7,
  bendSpan: 8,
  airGain: 2.2,
  airDamp: 0.6,
  entryShare: 0.15,
  entryMin: 8,
  entryMax: 14,
  treeLook: 28,
  treeCorridor: 1.6,
  dodge: 4,
  giveUpAfter: 35,
  crawl: 7,
  kickerMargin: 0.85,
  entryRadius: 12,
};

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const near: number[] = [];

/** Where on the loop the rider stands, restricted to the stretch between
 * the last checkpoint he took and the one he owes — so a hairpin's other leg
 * a few metres away is never mistaken for his own, and a checkpoint gone
 * past is ridden back to. Writes `hit`. */
function locate(state: GameState): TrackHit {
  const level = state.level;
  const p = state.progress;
  const cps = level.checkpoints;
  const c = state.sled;
  const sNext = cps[p.nextCheckpoint].s;
  const from = p.lastCheckpoint >= 0 ? cps[p.lastCheckpoint].s - 20 : sNext - 200;
  const span = arcAhead(level, from, sNext + 20);
  nearestTrackPoint(level, c.x, c.z, hit);
  if (arcAhead(level, from, hit.s) <= span) return hit;
  // The nearest centreline is another stretch's: walk this one.
  const pts = level.track.points;
  let best = Infinity;
  for (let d = 0; d <= span; d += 2) {
    const at = trackPointAt(level, from + d, pa);
    const dd = Math.hypot(at.x - c.x, at.z - c.z);
    if (dd < best) {
      best = dd;
      hit.s = at.s;
      hit.x = at.x;
      hit.z = at.z;
      hit.distance = dd;
    }
  }
  hit.index = Math.min(pts.length - 1, Math.floor((hit.s / level.track.length) * pts.length));
  return hit;
}

/** How sharp the loop bends at arc `s`, 1/m. */
function bendAt(level: Level, s: number, span: number): number {
  trackPointAt(level, s - span, pa);
  trackPointAt(level, s + span, pb);
  return Math.abs(angleDiff(pa.heading, pb.heading)) / (2 * span);
}

/** THE SPEED A KICKER WANTS, m/s: the fastest a sled can leave its lip and
 * still come down on its landing rather than past it — found by flying a
 * point off the lip at the ramp's own angle over the real snow, at each
 * speed in turn, until the impact into the slope would bottom the
 * suspension of the machine he is on. A rider learns this on his first lap;
 * the bot is handed it. Worked out once per kicker per machine. */
const kickerSpeeds = new WeakMap<SledSpec, WeakMap<Kicker, number>>();
function kickerSpeed(level: Level, k: Kicker, spec: SledSpec, profile: BotProfile): number {
  let mine = kickerSpeeds.get(spec);
  if (!mine) {
    mine = new WeakMap();
    kickerSpeeds.set(spec, mine);
  }
  const known = mine.get(k);
  if (known !== undefined) return known;
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const lip = level.groundAt(k.x, k.z);
  const angle = Math.atan((lip - level.groundAt(k.x - fx * 2, k.z - fz * 2)) / 2);
  const floor = 0.55;
  const limit = harshSpeedOf(spec) * profile.kickerMargin;
  const n = { x: 0, y: 1, z: 0 };
  let best = 8;
  for (let v = 8; v <= 40; v += 1) {
    let x = k.x;
    let z = k.z;
    let y = lip + floor;
    const h = v * Math.cos(angle);
    let vy = v * Math.sin(angle);
    let impact = 0;
    for (let t = 0; t < 5; t += 0.02) {
      x += fx * h * 0.02;
      z += fz * h * 0.02;
      vy -= TUNING.g * 0.02;
      y += vy * 0.02;
      if (y <= level.groundAt(x, z) + floor) {
        level.normalAt(x, z, n);
        impact = -(fx * h * n.x + vy * n.y + fz * h * n.z);
        break;
      }
    }
    if (impact > limit) break;
    best = v;
  }
  mine.set(k, best);
  return best;
}

/** The fastest the rider may be going NOW for every bend and kicker within
 * braking reach to be taken at its own speed, m/s. */
function speedAllowed(state: GameState, s: number, speed: number, profile: BotProfile): number {
  const level = state.level;
  const spec = state.sled.spec;
  const aLat = cornerGrip(spec, 1) * profile.cornerShare;
  const decel = brakeDecel(spec, 1) * profile.brakeShare;
  const reach = (speed * speed) / (2 * decel) + 30;
  let allowed = Infinity;
  for (let d = 0; d <= reach; d += 4) {
    const k = bendAt(level, s + d, profile.bendSpan);
    if (k < 1e-4) continue;
    const corner = Math.sqrt(aLat / k);
    const now = Math.sqrt(corner * corner + 2 * decel * Math.max(0, d - 6));
    if (now < allowed) allowed = now;
  }
  for (const k of level.kickers ?? []) {
    if (!k.onTrack || k.s === undefined) continue;
    const d = arcAhead(level, s, k.s);
    if (d > reach) continue;
    const v = kickerSpeed(level, k, spec, profile);
    const now = Math.sqrt(v * v + 2 * decel * d);
    if (now < allowed) allowed = now;
  }
  return allowed;
}

/** Move the aim off a trunk standing in the line from the rider to it. */
function dodgeTrees(
  state: GameState,
  tx: number,
  tz: number,
  profile: BotProfile,
): [number, number] {
  const c = state.sled;
  const dx = tx - c.x;
  const dz = tz - c.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const look = Math.min(len, profile.treeLook);
  treesNear(state.level, c.x + (ux * look) / 2, c.z + (uz * look) / 2, look / 2 + 2, near);
  let bestAlong = Infinity;
  let side = 0;
  for (const i of near) {
    const t = state.level.trees[i];
    const rx = t.x - c.x;
    const rz = t.z - c.z;
    const along = rx * ux + rz * uz;
    if (along <= 0 || along > look) continue;
    const across = rx * uz - rz * ux;
    if (Math.abs(across) > profile.treeCorridor + t.radius) continue;
    if (along < bestAlong) {
      bestAlong = along;
      // Pass on the side the trunk is NOT on (positive across is to the
      // right of travel, since right of (ux, uz) is (uz, −ux)).
      side = across >= 0 ? -1 : 1;
    }
  }
  if (side === 0) return [tx, tz];
  // Right of travel is (uz, −ux).
  return [tx + uz * side * profile.dodge, tz - ux * side * profile.dodge];
}

/** The bot's controls for this step. */
export function botInput(state: GameState, profile: BotProfile = RIDER_BOT): SledInput {
  const c = state.sled;
  const p = state.progress;
  const level = state.level;
  if (p.finished) return { ...NEUTRAL_INPUT };
  // GIVE UP on a stretch that has gone nowhere for too long.
  if (p.time - Math.max(p.lastPassedAt, p.lastResetAt) > profile.giveUpAfter) {
    return { ...NEUTRAL_INPUT, reset: true };
  }
  const speed = c.speed;
  const on = locate(state);
  const cps = level.checkpoints;
  let aimS = on.s + profile.lookBase + profile.lookPerSpeed * speed;
  // BEFORE THE START LINE and off the track (a grid in the powder, on a
  // hand-built map): aim onto the track
  // SHORT of the line, so it is crossed riding along the track.
  const halfWidth = trackPointAt(level, on.s, pa).width / 2;
  if (!p.started && p.nextCheckpoint === 0 && on.distance > halfWidth) {
    const short = clamp(on.distance * profile.entryShare, profile.entryMin, profile.entryMax);
    const ahead = arcAhead(level, on.s, cps[0].s);
    const toLine = ahead > level.track.length / 2 ? ahead - level.track.length : ahead;
    if (toLine - short <= aimS - on.s) aimS = cps[0].s - short;
  }
  const aim = trackPointAt(level, aimS, pb);
  const [tx, tz] = dodgeTrees(state, aim.x, aim.z, profile);

  const input: SledInput = { steer: 0, throttle: 1, brake: 0, lean: 0, reset: false };
  if (c.airborne) {
    // LEVEL TO THE LANDING: pitch toward the slope under where the sled is
    // going, the fall line of the snow a half second on.
    const hs = Math.hypot(c.vx, c.vz);
    const ux = hs > 0.5 ? c.vx / hs : Math.sin(c.heading);
    const uz = hs > 0.5 ? c.vz / hs : Math.cos(c.heading);
    const ax = c.x + c.vx * 0.5;
    const az = c.z + c.vz * 0.5;
    const slope =
      (level.groundAt(ax + ux * 2, az + uz * 2) - level.groundAt(ax - ux * 2, az - uz * 2)) / 4;
    const target = Math.atan(slope);
    const pitchRate = -c.wx;
    input.lean = clamp(profile.airGain * (target - c.pitch) - profile.airDamp * pitchRate, -1, 1);
    input.throttle = 0.6;
    return input;
  }

  // STEER at the aim, against the heading the yaw rate is carrying it to.
  const bearing = Math.atan2(tx - c.x, tz - c.z);
  // In powder the sled turns off its roll — the carve — which lags the bars
  // by the time it takes to lay the machine over, so the bot looks further
  // ahead along its own yaw and asks for less.
  const powder = 1 - c.packed;
  const yaw = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz }).y;
  const error = angleDiff(
    c.heading + yaw * profile.yawLead * (1 + powder * profile.powderLead),
    bearing,
  );
  input.steer = clamp(profile.steerGain * (1 - powder * profile.powderEase) * error, -1, 1);

  // THE THROTTLE AND THE BRAKE, off the bends within reach — on the track;
  // out in the powder there is nothing to brake for but the track itself.
  const onTrack = on.distance <= halfWidth + 2;
  let allowed = onTrack ? speedAllowed(state, on.s, speed, profile) : Infinity;
  // ...and the turn onto the aim itself: pure pursuit's own curvature,
  // 2·sin(error) over the distance to the aim, taken at the grip of the
  // snow the sled is on — which is what slows it for the turn onto the
  // track out of the powder, and back onto it after running wide.
  // ...and the turn onto the track at the end of the grid's lane, braked
  // for before the lane runs out.
  if (!p.started && on.distance > halfWidth) {
    const grip = cornerGrip(c.spec, c.packed) * profile.cornerShare;
    const turn = Math.sqrt(grip * profile.entryRadius);
    const left = on.distance - halfWidth;
    allowed = Math.min(
      allowed,
      Math.sqrt(turn * turn + 2 * brakeDecel(c.spec, c.packed) * profile.brakeShare * left),
    );
  }
  const reach = Math.hypot(tx - c.x, tz - c.z);
  const bend = (2 * Math.abs(Math.sin(angleDiff(c.heading, bearing)))) / Math.max(reach, 1);
  if (bend > 1e-3) {
    const grip = cornerGrip(c.spec, c.packed) * profile.cornerShare;
    allowed = Math.min(allowed, Math.max(profile.crawl, Math.sqrt(grip / bend)));
  }
  if (speed > allowed + 1) {
    input.throttle = 0;
    input.brake = clamp((speed - allowed) / 2.5, 0.25, 1);
  } else if (speed > allowed - 1) {
    input.throttle = 0.4;
  }
  return input;
}
