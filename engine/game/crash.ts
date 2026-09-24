// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT — the rider coming off the sled, and the few seconds before
// the reset stands them both back on the track.
//
// THREE WAYS OFF, each a threshold on something the step has already
// measured, and each well past anything a clean ride meets (`TUNING.crash`):
//   - a TRUNK met hard — the `hit` event's closing speed past `treeSpeed`:
//     the trunk stops the sled, and the man on it goes on at the way it had
//     until the snow or the trunk itself stops him;
//   - a NOSE-IN LANDING — a `land` ending a flight of `noseAir` s or more,
//     past `noseImpact` m/s into the slope with the nose more than
//     `noseAngle` down against it: the skis dig and he goes over the bars.
//     The rebound hop after a touchdown is not judged — a sled that lands
//     tail-first and slaps down onto its nose is riding its own landing;
//   - a ROLLOVER AT SPEED — the sled lying over on the SNOW (its up under
//     `reset.overUp` of the snow's normal) for `rollHold` s, still going
//     `rollSpeed` or more. Turning over in the air is not yet a roll — the
//     landing decides — and a slow roll he hangs on through, the reset's
//     own clock (`reset.overFor`) standing it up as before.
//
// THE RIDER THROWN is a body of his own (`Thrown`): a RAGDOLL
// (`ragdoll.ts`) — the hips, the shoulders, the head and the four limbs as
// thirteen points held at the joints — laid where he sat and sent off at
// `keep` of the sled's velocity before the blow plus a climb, turning head
// over heels at his speed over `tumbleRadius` (with `carry` of the sled's
// own turning on top). Every point meets the snow and the trunks on its
// own, so he goes over once or twice with his arms and legs flung, is
// dragged down by the snow on every turn — at once in deep powder — and
// slides to rest lying on it, the way a body does. None of it is drawn from
// the stream: a crash is a pure function of the moment it started, so a run
// replays wipeout for wipeout.
//
// THE SLED goes on without him — the controls let go (`run.ts`), whatever
// the chassis makes of the ground — and a nose-in landing is given the
// nose-over its skis digging in would put into it. He takes no checkpoint
// while he is off it; the race clock runs.
//
// THE RESET comes once he has been off `lieMin` s and has lain still for
// `lieStill` of them, or at `lieMax` whatever he is doing — the engine's
// reset, reported `auto`. The still beat is the one the app's death cam
// (`camera-death.ts`) rises into the sky over him on.

import { clamp, hypot, hypot3 } from "../lib/math.ts";
import { rotate, type Vec3 } from "../lib/quat.ts";
import { TUNING } from "./defs/tuning.ts";
import { centreOf, stepRagdoll, throwBody } from "./ragdoll.ts";
import type { CrashCause, GameEvent, GameState, SledState, Thrown } from "./state.ts";

const K = TUNING.crash;
const dt = TUNING.dt;
const n: Vec3 = { x: 0, y: 1, z: 0 };

/** How far the sled's nose points DOWN against the snow under it, rad —
 * negative for a nose up off the slope. */
export function noseDown(state: GameState): number {
  const c = state.sled;
  state.level.normalAt(c.x, c.z, n);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  return Math.asin(clamp(-(f.x * n.x + f.y * n.y + f.z * n.z), -1, 1));
}

/** What, of this step's events and the sled's attitude, puts the rider off
 * — or null. `speed0` is the sled's speed before the step. */
export function wipeoutCause(
  state: GameState,
  events: readonly GameEvent[],
  speed0: number,
): CrashCause | null {
  for (const e of events) {
    if (e.kind === "hit" && e.speed >= K.treeSpeed) return "tree";
    // Only the touchdown that ends a real flight: the rebound hop off a
    // landing is that landing's own, however the nose comes down on it.
    if (
      e.kind === "land" &&
      e.airTime >= K.noseAir &&
      e.impact >= K.noseImpact &&
      noseDown(state) >= K.noseAngle
    ) {
      return "nose";
    }
  }
  // Over is over against the SNOW, not the sky — a sled climbing a face
  // stands well off vertical — and ON the snow: a sled turning over in the
  // air has not rolled until it comes down, and one that clips a side on
  // the way round and comes back onto its skis is ridden away. So the
  // clock is `rolledFor`, time lying over on the snow, held `rollHold`.
  const c = state.sled;
  const over = !c.airborne && overSnow(state);
  c.rolledFor = over ? c.rolledFor + dt : 0;
  return c.rolledFor >= K.rollHold && speed0 >= K.rollSpeed ? "roll" : null;
}

/** Whether the sled's up axis is under `reset.overUp` of the snow's own. */
function overSnow(state: GameState): boolean {
  const c = state.sled;
  state.level.normalAt(c.x, c.z, n);
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  return up.x * n.x + up.y * n.y + up.z * n.z < TUNING.reset.overUp;
}

/** Put the rider off the sled: `v0` is the sled's velocity before the
 * blow, which is what he carries on with. */
export function throwRider(
  state: GameState,
  cause: CrashCause,
  v0: Vec3,
  events: GameEvent[],
): Thrown {
  const c = state.sled;
  const flat = hypot(v0.x, v0.z);
  const speed = hypot3(v0.x, v0.y, v0.z);
  const heading = flat > 1 ? Math.atan2(v0.x, v0.z) : c.heading;
  // Head over heels about the axis across the way he goes, forward
  // positive (a right-handed turn about his right), and a share of the
  // machine's own turning — a sled rolling over rolls him with it.
  const over = Math.min(K.maxSpin, (flat * K.keep) / K.tumbleRadius);
  const own = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
  const w = {
    x: Math.cos(heading) * over + own.x * K.carry,
    y: own.y * K.carry,
    z: -Math.sin(heading) * over + own.z * K.carry,
  };
  const v = { x: v0.x * K.keep, y: Math.max(0, v0.y) * K.keep + K.throwUp, z: v0.z * K.keep };
  const body = throwBody(c.q, c.x, c.y, c.z, v, w);
  const com = centreOf(body.points);
  const thrown: Thrown = {
    cause,
    t: 0,
    x: com.x,
    y: com.y,
    z: com.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    heading,
    tumble: 0,
    points: body.points,
    last: body.last,
    touching: false,
    still: 0,
  };
  if (cause === "nose") {
    // The skis dig and the machine goes over its nose: a nose-down pitch
    // rate is a positive `wx`.
    const e = events.find((ev) => ev.kind === "land");
    const impact = e && e.kind === "land" ? e.impact : 0;
    c.wx += Math.min(K.sledKickMax, K.sledKick * impact);
  }
  c.thrown = thrown;
  events.push({ kind: "wipeout", t: state.t, cause, speed, x: c.x, z: c.z });
  return thrown;
}

/** One step of the rider's own body on the snow. */
export function stepThrown(state: GameState, b: Thrown): void {
  b.t += dt;
  stepRagdoll(state, b);
}

/** Whether the rider has lain long enough for the reset to stand them up. */
export function crashOver(b: Thrown): boolean {
  if (b.t >= K.lieMax) return true;
  return b.t >= K.lieMin && b.still >= K.lieStill;
}

/** The sled's riderless share of the step's bookkeeping: nothing is asked
 * of the automatic reset's clocks while the crash owns the run. */
export function quietClocks(c: SledState): void {
  c.overFor = 0;
  c.stuckFor = 0;
  c.trenchFor = 0;
  c.boggedFor = 0;
  c.rolledFor = 0;
}
