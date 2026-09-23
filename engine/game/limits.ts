// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SLED CAN DO — the model's own ceilings, stated once. The physics
// enforces them and the bot plans around them; a bot planning off a number
// that only resembles the one the physics applies is a rider in a different
// machine. Nothing here has state: they are questions about a SPEC.

import { SLED, totalMass, type SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf, skiShare } from "./footprint.ts";
import { gripAt, type Grip } from "./snow.ts";
import { probesOf } from "./suspension.ts";
import { skiLockAt } from "./sled.ts";

const scratch: Grip = { tread: 0, treadSide: 0, ski: 0 };

/** The redline, rpm. */
export function maxRpm(spec: SledSpec): number {
  return spec.maxRpm;
}

/** The documented top speed on packed snow, m/s — what the bot reads as
 * flat out; `tests/sled_test.ts` holds the physics to it. */
export function topSpeedOf(spec: SledSpec): number {
  return spec.topSpeed / 3.6;
}

/** The tread's speed at the redline in top ratio, m/s — nothing drives the
 * sled faster over flat snow. */
export function treadCeiling(spec: SledSpec): number {
  return spec.gearTop;
}

/** The full ski lock at a speed, rad (`sled.ts` owns it). */
export function lockAt(spec: SledSpec, speed: number): number {
  return skiLockAt(spec, speed);
}

/** THE TIPPING POINT, as a lateral acceleration over g: past it a sled
 * lifts its inside ski before it slides. Half the ski stance, plus how far
 * the rider hanging off carries the whole machine's weight outboard, over
 * the height of the centre of gravity — the static stability factor, which
 * is why a wide, low trail sled holds a bend a narrow mountain sled lifts
 * a ski in, and why long travel (a taller machine) gives some of it back. */
export function tipLimit(spec: SledSpec): number {
  const hang = (spec.riderReach * spec.riderMass) / totalMass(spec);
  return ((spec.skiStance / 2 + hang) / spec.cogHeight) * TUNING.arcade.hangOff;
}

/** HOW HARD A SLED CAN CORNER, m/s², on snow `packed` 0..1: the skis' and
 * the tread's sideways grip over the whole weight, each on the share of it
 * the geometry puts there (`skiShare`) — or the tipping point, whichever
 * comes first. That is what a sled holding a line round a bend can call on;
 * the bot reads it to judge a corner's speed. */
export function cornerGrip(spec: SledSpec, packed: number): number {
  const grip = gripAt(packed, scratch, footprintOf(spec));
  const ski = grip.ski;
  const tread = grip.treadSide;
  const share = skiShare(spec);
  return (
    TUNING.g *
    Math.min((ski * share + tread * (1 - share)) * TUNING.arcade.sideGrip, tipLimit(spec))
  );
}

/** How hard a sled can stop, m/s², on snow `packed` 0..1: the tread locked
 * on its grip, less what the skis carry. */
export function brakeDecel(spec: SledSpec, packed: number): number {
  const tread = gripAt(packed, scratch, footprintOf(spec)).tread;
  return TUNING.g * tread * (1 - skiShare(spec));
}

const harsh = new WeakMap<SledSpec, number>();

/** THE HARDEST LANDING A MACHINE TAKES WHOLE, m/s into the slope. A spring
 * stroked to its bump stop has stored ½·k·x², and the landing it can take
 * without bottoming is the one whose energy that covers: v = √(2E / m). So
 * `air.harshSpeed` — measured on the reference machine — scales as the
 * square root of the stroke energy per kilo, summed over every probe, which
 * is how long travel on stiff springs lands what a soft short stroke
 * bottoms on. Read by the landing (`flight.ts`) and by the bot, which plans
 * a kicker's speed against it. */
export function harshSpeedOf(spec: SledSpec): number {
  const hit = harsh.get(spec);
  if (hit !== undefined) return hit;
  const stroke = (s: SledSpec): number =>
    probesOf(s).reduce((sum, p) => sum + 0.5 * p.susp.rate * p.susp.travel ** 2, 0) / totalMass(s);
  const v = TUNING.air.harshSpeed * Math.sqrt(stroke(spec) / stroke(SLED));
  harsh.set(spec, v);
  return v;
}
