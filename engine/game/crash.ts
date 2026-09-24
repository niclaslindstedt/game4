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
// THE RIDER THROWN is a body of his own (`Thrown`): a point with a radius
// leaving at `keep` of the sled's velocity before the blow plus a climb,
// under gravity, stopped by a trunk as the sled is (`collision.ts`'s own
// hash), meeting the snow as the chassis does — the speed into it
// taken away with a little back, Coulomb friction on the slide, harder in
// powder, which a sprawled body ploughs. Over it a TUMBLE: head over heels
// at the speed over a rolling radius, chasing the slide on the snow, and
// settling flat once he has stopped. None of it is drawn from the stream:
// a crash is a pure function of the moment it started, so a run replays
// wipeout for wipeout.
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
import { treesNear } from "./collision.ts";
import { packedUnder } from "./snow.ts";
import type { CrashCause, GameEvent, GameState, SledState, Thrown } from "./state.ts";

const K = TUNING.crash;
const dt = TUNING.dt;
const n: Vec3 = { x: 0, y: 1, z: 0 };
const near: number[] = [];

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
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  const h = c.spec.riderHeight + K.radius;
  const flat = hypot(v0.x, v0.z);
  const speed = hypot3(v0.x, v0.y, v0.z);
  const thrown: Thrown = {
    cause,
    t: 0,
    x: c.x + up.x * h,
    y: c.y + up.y * h,
    z: c.z + up.z * h,
    vx: v0.x * K.keep,
    vy: Math.max(0, v0.y) * K.keep + K.throwUp,
    vz: v0.z * K.keep,
    heading: flat > 1 ? Math.atan2(v0.x, v0.z) : c.heading,
    tumble: 0,
    spin: Math.min(K.maxSpin, (flat * K.keep) / K.tumbleRadius),
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

/** The nearest angle a body lying flat on its back or front is turned to. */
function lying(tumble: number): number {
  return Math.round((tumble - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
}

/** One step of the rider's own body on the snow. */
export function stepThrown(state: GameState, b: Thrown): void {
  const level = state.level;
  const g = TUNING.g;
  b.t += dt;
  b.vy -= g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  const lo = TUNING.bounds.margin;
  const hi = level.size - TUNING.bounds.margin;
  b.x = clamp(b.x, lo, hi);
  b.z = clamp(b.z, lo, hi);
  // A trunk stops him as it stops the sled — pushed out along the line of
  // centres, the speed into it gone but for a little, the rest scrubbed.
  treesNear(level, b.x, b.z, K.radius, near);
  for (const i of near) {
    const t = level.trees[i];
    if (b.y > t.y + t.height) continue;
    const dx = b.x - t.x;
    const dz = b.z - t.z;
    const d = hypot(dx, dz) || 1e-6;
    const reach = K.radius + t.radius;
    if (d >= reach) continue;
    const nx = dx / d;
    const nz = dz / d;
    b.x = t.x + nx * reach;
    b.z = t.z + nz * reach;
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      b.vx = (b.vx - vn * nx) * 0.5 - K.restitution * vn * nx;
      b.vz = (b.vz - vn * nz) * 0.5 - K.restitution * vn * nz;
    }
  }
  const packed = packedUnder(level.packedAt(b.x, b.z), state.fresh);
  const floor = level.groundAt(b.x, b.z) - K.sink * (1 - packed) + K.radius;
  b.touching = b.y <= floor;
  if (b.touching) {
    level.normalAt(b.x, b.z, n);
    b.y = floor;
    const vn = b.vx * n.x + b.vy * n.y + b.vz * n.z;
    // Into the snow: taken away, with a little back from a real arrival
    // and none from a body merely lying on it.
    const into = Math.max(0, -vn);
    const back = into > 1 ? K.restitution : 0;
    b.vx += (1 + back) * into * n.x;
    b.vy += (1 + back) * into * n.y;
    b.vz += (1 + back) * into * n.z;
    // Along it: Coulomb, on the weight and on the arrival.
    const un = b.vx * n.x + b.vy * n.y + b.vz * n.z;
    const tx = b.vx - un * n.x;
    const ty = b.vy - un * n.y;
    const tz = b.vz - un * n.z;
    const slide = hypot3(tx, ty, tz);
    if (slide > 1e-6) {
      const mu = K.frictionPacked * packed + K.frictionPowder * (1 - packed);
      const take = Math.min(slide, mu * (g * n.y * dt + into));
      const s = take / slide;
      b.vx -= tx * s;
      b.vy -= ty * s;
      b.vz -= tz * s;
    }
    // The tumble chases the slide; once he has stopped, he lies flat.
    const along = b.vx * Math.sin(b.heading) + b.vz * Math.cos(b.heading);
    const roll = clamp(along / K.tumbleRadius, -K.maxSpin, K.maxSpin);
    b.spin += (roll - b.spin) * Math.min(1, K.spinGrip * dt);
    if (hypot(b.vx, b.vz) < K.restSpeed) {
      b.spin = 0;
      b.tumble += (lying(b.tumble) - b.tumble) * Math.min(1, 3 * dt);
    }
  }
  b.tumble += b.spin * dt;
  b.still = b.touching && hypot3(b.vx, b.vy, b.vz) < K.restSpeed ? b.still + dt : 0;
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
