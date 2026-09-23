// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRIVE — engine, CVT and tread, from the throttle to the force the
// tread offers the snow. What the snow actually TAKES of it is the grip's
// (`sled.ts` sums it probe by probe); this module owns the belt that sits
// between the two, and the engine that turns it.
//
// THE ENGINE is a power curve (`powerShare`) over rpm, rising to its peak at
// `peakRpm` and falling past it to the limiter at `maxRpm`.
//
// THE CVT is modelled by what it does rather than by its sheaves: with the
// throttle open it holds the engine at the rpm the lever asks for — from the
// clutch's engagement up to the power peak at full throttle — shifting up as
// the tread gains speed, until it runs out of ratio at `gearTop`. Past that
// the engine is locked to the belt and climbs with it to the limiter, which
// cuts the fuel. So the force the drive offers the belt is POWER over belt
// speed (`driveForce`) — flat power, falling force — floored at a launch
// speed so a standing start is the clutch slipping rather than a division by
// zero, and capped at what the peak torque can do through the lowest ratio.
//
// THE BELT (`stepTread`) is a mass of its own (`tread.beltMass`): the engine
// pushes it, the snow pushes back through the grip, its own rails and idlers
// drag it, and the brake clamps it. It can spin faster than the sled is going
// — wheelspin, in powder or off the line — and in the air it spins up free.
// It never runs backwards: the drive is one-way.

import { clamp } from "../lib/math.ts";
import type { SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";

const T = TUNING.tread;
const RPM_TO_RAD = (2 * Math.PI) / 60;

/** The engine's power at `rpm`, as a share of its peak. */
export function powerShare(spec: SledSpec, rpm: number): number {
  if (rpm <= spec.peakRpm) {
    const x = clamp((rpm - spec.idleRpm) / (spec.peakRpm - spec.idleRpm), 0, 1);
    return 0.12 + 0.88 * x * (2 - x);
  }
  const x = clamp((rpm - spec.peakRpm) / (spec.maxRpm - spec.peakRpm), 0, 1.5);
  return 1 - 0.25 * x * x;
}

/** The engine speed the belt would drive it at in the CVT's TOP ratio, rpm —
 * the floor the engine cannot sit below once the variator has run out. */
export function rpmAtTop(spec: SledSpec, treadSpeed: number): number {
  return (treadSpeed / spec.gearTop) * spec.maxRpm;
}

/** The most the drive can ever push the belt with, N: the peak torque
 * through the lowest ratio, less the driveline. */
export function maxDriveForce(spec: SledSpec): number {
  const torque = (spec.powerKw * 1000) / (spec.peakRpm * RPM_TO_RAD);
  const rpmPerMps = (spec.maxRpm * spec.gearSpan) / spec.gearTop;
  return torque * spec.driveline * rpmPerMps * RPM_TO_RAD;
}

/** The force the drive offers the belt, N, at engine `rpm`, `throttle`
 * 0..1 and the belt running at `treadSpeed` m/s. Negative with the throttle
 * shut: engine braking while the driven clutch is still engaged. */
export function driveForce(
  spec: SledSpec,
  rpm: number,
  throttle: number,
  treadSpeed: number,
): number {
  const top = rpmAtTop(spec, treadSpeed);
  if (throttle <= 0.01 || rpm < spec.engageRpm * 0.95) {
    return top > spec.engageRpm ? -T.engineBrake * treadSpeed : 0;
  }
  const power = spec.powerKw * 1000 * powerShare(spec, rpm) * throttle * spec.driveline;
  let force = Math.min(power / Math.max(treadSpeed, T.launchFloor), maxDriveForce(spec));
  // THE LIMITER: fuel cut over the last two per cent to the redline.
  force *= clamp((spec.maxRpm * 1.02 - top) / (spec.maxRpm * 0.02), 0, 1);
  return force;
}

/** Where the CVT holds the engine: the rpm the lever asks for, or the rpm
 * the belt drives it at in top ratio if that is higher. */
export function rpmGoal(spec: SledSpec, throttle: number, treadSpeed: number): number {
  const top = rpmAtTop(spec, treadSpeed);
  if (throttle <= 0.01) return top > spec.engageRpm ? top : spec.idleRpm;
  const asked = spec.engageRpm + (spec.peakRpm - spec.engageRpm) * clamp(throttle, 0, 1);
  return Math.min(Math.max(asked, top), spec.maxRpm * 1.03);
}

/** THE BELT'S STEP: advance its speed by the drive, the snow's reaction
 * (`ground`, N, the sum of the forces the tread's grip put INTO the snow —
 * positive when the belt is pushing the sled forward), its own losses and
 * the brake (0..1). Returns the new belt speed, m/s. */
export function stepTread(
  spec: SledSpec,
  treadSpeed: number,
  rpm: number,
  throttle: number,
  brake: number,
  ground: number,
  dt: number,
): number {
  const v = treadSpeed;
  const loss = T.lossLin * v + T.lossQuad * v * v;
  const net = driveForce(spec, rpm, throttle, v) - ground - loss;
  let next = v + (net / T.beltMass) * dt;
  // The brake is a clamp: it takes up to its force's worth of belt speed
  // off toward zero and holds the belt there if that is enough.
  const clampDv = (spec.brakeForce * brake * dt) / T.beltMass;
  if (next > 0) next = Math.max(0, next - clampDv);
  return Math.max(0, next);
}

/** The engine's own step toward where the CVT holds it, rpm. */
export function stepRpm(
  spec: SledSpec,
  rpm: number,
  throttle: number,
  treadSpeed: number,
  dt: number,
): number {
  const goal = rpmGoal(spec, throttle, treadSpeed);
  return rpm + (goal - rpm) * Math.min(1, T.rpmRate * dt);
}
