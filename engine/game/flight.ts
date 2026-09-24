// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR — what a rider can still do with the machine once the snow has
// let go of it, and what the snow charges when it takes it back.
//
// A sled in the air answers to three levers, all about its pitch axis:
// the LEAN (the rider's weight thrown back lifts the nose, forward drops
// it), the THROTTLE (spinning the tread up is a gyroscope being wound up, and
// its reaction on the chassis lifts the nose — the reason every rider
// "gasses it" off a lip that is pitching him forward) and the BRAKE
// (stopping twenty kilos of belt dead throws that angular momentum into the
// chassis and drops the nose — the correction for a sled going over
// backwards). The bars have a little yaw, the rider's body keeps the roll
// level (no control rolls a sled in the air), and the air damps every rate.
// All of it in the BODY frame; nose up is a NEGATIVE torque about x.
//
// A LANDING is the suspension's job and the springs take it — the model of a
// good one is nothing at all. What a bad one costs is decided here: past
// the machine's own `harshSpeedOf` (`air.harshSpeed` on the reference
// machine, more on a longer, stiffer stroke) of speed INTO the slope the
// suspension has bottomed and
// the machine pays a share of its way per m/s over, which is why landing on
// the downslope of a kicker is fast and landing flat after overshooting it
// is not.

import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";
import { SLED, inertiaOf } from "./defs/sled.ts";
import { footprintOf } from "./footprint.ts";
import type { Level } from "../mapgen/types.ts";
import type { SledState } from "./state.ts";

const A = TUNING.air;

/** The rider's torques in the air, body frame, N·m, added into `out`.
 * `level` is how much of the roll-levelling the run's assist grants (0..1,
 * `Assist.air`); the damping is the air's and is always there. */
export function airTorque(
  c: SledState,
  out: { x: number; y: number; z: number },
  level = 1,
  landing: Landing | null = null,
): void {
  // The gyro is the belt's: more rubber spun up is more to swing a flight
  // with (`Footprint.belt`).
  const belt = footprintOf(c.spec).belt;
  out.x +=
    -A.leanTorque * c.lean + belt * (-A.throttleTorque * c.throttle + A.brakeTorque * c.brake);
  out.y += A.steerTorque * c.steer;
  // Roll right-side-down is a negative rotation about the forward axis, so
  // a positive torque takes it back. Past a steep roll the rider has lost
  // it: a sled thrown onto its side comes down on its side.
  const reach = clamp((A.rollGiveUp - Math.abs(c.roll)) / 0.3, 0, 1);
  out.z += (A.rollLevel * level * c.roll - A.rollDamp * c.wz) * reach;
  // ...AND THE PITCH, which is the arcade's: with the lean left alone his
  // body eases the nose toward half the line the sled is flying along — up
  // off a lip — and, over the last `landLook` s before the snow comes back,
  // toward THE SLOPE IT WILL LAND ON (`landingAhead`), so both skis and the
  // tread meet it together and the springs take the landing between them.
  // A rider looks at his landing; aimed at the flight path alone, a sled
  // that overshot a kicker onto the flat came down on its skis 20° nose-down
  // and bottomed them. It gives way to the lean (a rider leaning is flying
  // the sled himself — a flip is a lean carried round) and gives up past
  // `pitchGiveUp`, and it is never more than `pitchLevelMax`.
  const path = Math.atan2(c.vy, Math.hypot(c.vx, c.vz));
  const look = landing ? clamp(1 - landing.t / A.landLook, 0, 1) : 0;
  const aim = clamp(
    path * 0.5 * (1 - look) + (landing ? landing.slope : 0) * look,
    -A.pitchAim,
    A.pitchAim,
  );
  // Stated on the reference machine and scaled by this one's pitch inertia:
  // a hand is an acceleration, and the touring sled's is a heavier body.
  const heft = inertiaOf(c.spec).x / inertiaOf(SLED).x;
  const hand =
    level *
    heft *
    (1 - Math.min(1, Math.abs(c.lean))) *
    clamp((A.pitchGiveUp - Math.abs(c.pitch - aim)) / 0.3, 0, 1);
  out.x += clamp(A.pitchLevel * (c.pitch - aim), -A.pitchLevelMax, A.pitchLevelMax) * hand;
  out.x -= A.damping * c.wx;
  out.y -= A.damping * c.wy;
  out.z -= A.damping * c.wz;
}

/** Where a flight comes down: `t` s from now, onto snow whose slope along
 * the sled's nose is `slope` rad (nose-up positive, as `pitch` is). */
export type Landing = { t: number; slope: number };

/** The arc's own time step, s, and how far ahead it is traced, s. */
const ARC_STEP = 1 / 30;
const ARC_HORIZON = 3;

/** WHERE THIS FLIGHT COMES DOWN — the ballistic arc from the CoG under the
 * flight's pull `fall` m/s² (air drag left out: over the three seconds
 * traced it is centimetres), traced until the CoG is back at its standing
 * height over the snow, and the slope there along the nose; null if the
 * snow does not come back within `ARC_HORIZON`. A pure function of the
 * sled and the map: it draws nothing and remembers nothing. */
export function landingAhead(c: SledState, level: Level, fall: number): Landing | null {
  const stand = c.spec.cogHeight;
  let x = c.x;
  let y = c.y;
  let z = c.z;
  let vy = c.vy;
  for (let t = ARC_STEP; t <= ARC_HORIZON; t += ARC_STEP) {
    x += c.vx * ARC_STEP;
    z += c.vz * ARC_STEP;
    vy -= fall * ARC_STEP;
    y += vy * ARC_STEP;
    if (y - stand > level.groundAt(x, z)) continue;
    level.normalAt(x, z, ground);
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const rise = -(ground.x * fx + ground.z * fz) / Math.max(0.2, ground.y);
    return { t, slope: Math.atan(rise) };
  }
  return null;
}

const ground = { x: 0, y: 1, z: 0 };

/** What a landing met at `impact` m/s into the slope costs a machine whose
 * suspension takes `harsh` m/s whole (`harshSpeedOf`): the share of the way
 * lost, 0 for one the suspension took whole. */
export function landingLoss(impact: number, harsh: number = A.harshSpeed): number {
  if (impact <= harsh) return 0;
  return clamp((impact - harsh) * A.harshLoss, 0, A.harshMax);
}
