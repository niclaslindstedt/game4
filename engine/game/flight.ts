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
import type { SledState } from "./state.ts";

const A = TUNING.air;

/** The rider's torques in the air, body frame, N·m, added into `out`.
 * `level` is how much of the roll-levelling the run's assist grants (0..1,
 * `Assist.air`); the damping is the air's and is always there. */
export function airTorque(c: SledState, out: { x: number; y: number; z: number }, level = 1): void {
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
  // off a lip, down onto a landing — so a long flight with the throttle
  // held lands on its skis rather than wherever the belt's gyro wound it
  // to. It gives way to the lean (a rider leaning is flying the sled
  // himself — a flip is a lean carried round) and gives up past
  // `pitchGiveUp`, and it is never more than `pitchLevelMax`.
  const path = Math.atan2(c.vy, Math.hypot(c.vx, c.vz));
  const aim = clamp(path * 0.5, -A.pitchAim, A.pitchAim);
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

/** What a landing met at `impact` m/s into the slope costs a machine whose
 * suspension takes `harsh` m/s whole (`harshSpeedOf`): the share of the way
 * lost, 0 for one the suspension took whole. */
export function landingLoss(impact: number, harsh: number = A.harshSpeed): number {
  if (impact <= harsh) return 0;
  return clamp((impact - harsh) * A.harshLoss, 0, A.harshMax);
}
