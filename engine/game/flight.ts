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
// `air.harshSpeed` of speed INTO the slope the suspension has bottomed and
// the machine pays a share of its way per m/s over, which is why landing on
// the downslope of a kicker is fast and landing flat after overshooting it
// is not.

import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";
import type { SledState } from "./state.ts";

const A = TUNING.air;

/** The rider's torques in the air, body frame, N·m, added into `out`.
 * `level` is how much of the roll-levelling the run's assist grants (0..1,
 * `Assist.air`); the damping is the air's and is always there. */
export function airTorque(c: SledState, out: { x: number; y: number; z: number }, level = 1): void {
  out.x += -A.leanTorque * c.lean - A.throttleTorque * c.throttle + A.brakeTorque * c.brake;
  out.y += A.steerTorque * c.steer;
  // Roll right-side-down is a negative rotation about the forward axis, so
  // a positive torque takes it back. Past a steep roll the rider has lost
  // it: a sled thrown onto its side comes down on its side.
  const reach = clamp((A.rollGiveUp - Math.abs(c.roll)) / 0.3, 0, 1);
  out.z += (A.rollLevel * level * c.roll - A.rollDamp * c.wz) * reach;
  out.x -= A.damping * c.wx;
  out.y -= A.damping * c.wy;
  out.z -= A.damping * c.wz;
}

/** What a landing met at `impact` m/s into the slope costs: the share of
 * the way lost, 0 for one the suspension took whole. */
export function landingLoss(impact: number): number {
  if (impact <= A.harshSpeed) return 0;
  return clamp((impact - A.harshSpeed) * A.harshLoss, 0, A.harshMax);
}
