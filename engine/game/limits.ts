// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SLED CAN DO — the model's own ceilings, stated once. The physics
// enforces them and the bot plans around them; a bot planning off a number
// that only resembles the one the physics applies is a rider in a different
// machine. Nothing here has state: they are questions about a SPEC.

import type { SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { skiLockAt } from "./sled.ts";

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

/** HOW HARD A SLED CAN CORNER, m/s², on snow `packed` 0..1: the skis' and
 * the tread's sideways grip over the whole weight, which is what a sled
 * holding a line round a bend can call on. The bot reads it to judge a
 * corner's speed. */
export function cornerGrip(packed: number): number {
  const G = TUNING.grip;
  const ski = G.skiPacked * packed + G.skiPowder * (1 - packed);
  const tread = G.treadSidePacked * packed + G.treadSidePowder * (1 - packed);
  // The skis carry about a third of the weight and the tread the rest.
  return TUNING.g * (ski / 3 + (tread * 2) / 3);
}

/** How hard a sled can stop, m/s², on snow `packed` 0..1: the tread locked
 * on its grip, less what the skis carry. */
export function brakeDecel(packed: number): number {
  const G = TUNING.grip;
  return TUNING.g * (G.treadPacked * packed + G.treadPowder * (1 - packed)) * (2 / 3);
}
