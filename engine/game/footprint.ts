// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A MACHINE'S FOOTPRINT IS WORTH ON SNOW — the per-sled half of the
// snow model, read off the spec and nothing else. `snow.ts` states how snow
// behaves under a footprint; this module states how much footprint each
// machine brings to it, as multipliers on the shared numbers. The CROSSOVER
// (`SLED`) is the reference every shared number was tuned on, so every
// multiplier here is exactly 1 for it and the model it was measured with is
// unchanged by the catalog existing.
//
// THE PRESSURE is the tread's share of the weight (`skiShare`, the moment
// balance) over the belt's footprint on the snow — its run from `treadFront`
// to `treadRear`, by its width. It is the planing hull's loading carried over
// again (the sink already is — `snow.ts`): a lightly loaded footprint sinks
// less at rest, `(p / p₀)^floatExp`, and comes up onto the top of the snow
// sooner, the planing speed going as √(p / p₀) because the support a
// footprint gets from crossing the snow goes as the square of the speed.
//
// The same sink prices the COMPACTION: the powder drag a footprint pays is
// the work of pressing the snow down, which goes as how far it is pressed
// (Bekker), so `sink` scales the tread's powder drag as well as its depth.
//
// THE LUGS are the paddle. In powder the drive is the lugs shoving snow
// back, and a taller paddle moves more of it: `(h / h₀)^lugPowder` on the
// tread's powder grip, driving and sideways alike. On the groomer the same lug is a column standing on
// its end, and a tall one folds over under a sideways load, which is the
// long-tread machine pushing wide on a packed bend: `(h₀ / h)^lugSide` on
// the tread's sideways grip there.
//
// THE BELT'S OWN LOSSES — the rails, the idlers and the belt flexing round
// them, the biggest drag a sled has at speed (`TUNING.tread.lossQuad`) —
// grow with how much belt there is to turn: `treadLength / L₀`. That is the
// long tread's top end gone, and nothing else takes it.

import { SLED, totalMass, type SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";

export type Footprint = {
  /** The tread's ground pressure at rest, Pa. */
  pressure: number;
  /** The tread's rest sink in powder, and the powder drag it pays, as a
   * multiple of the reference's. */
  sink: number;
  /** The planing speed, as a multiple of `snow.planeSpeed`. */
  plane: number;
  /** The tread's grip in powder, driving and sideways, as a multiple of
   * `grip.treadPowder` / `.treadSidePowder`. */
  powderDrive: number;
  /** The tread's sideways grip on packed snow, as a multiple of
   * `grip.treadSidePacked`. */
  packedSide: number;
  /** The belt's internal losses, as a multiple of `tread.lossQuad` /
   * `.lossLin`. */
  beltLoss: number;
};

/** The share of the weight the skis carry together at rest: the moment
 * balance of the ski line and the tread's centroid about the CoG. */
export function skiShare(spec: SledSpec): number {
  const tread = -(spec.treadFront + spec.treadRear) / 2;
  return tread / (spec.skiForward + tread);
}

/** The tread's ground pressure at rest, Pa. */
export function pressureOf(spec: SledSpec): number {
  const load = totalMass(spec) * TUNING.g * (1 - skiShare(spec));
  return load / ((spec.treadFront - spec.treadRear) * spec.treadWidth);
}

const cache = new WeakMap<SledSpec, Footprint>();

/** THE FOOTPRINT of a machine, built once per spec. */
export function footprintOf(spec: SledSpec): Footprint {
  const hit = cache.get(spec);
  if (hit) return hit;
  const F = TUNING.footprint;
  const pressure = pressureOf(spec);
  const ratio = pressure / pressureOf(SLED);
  const lug = spec.lugHeight / SLED.lugHeight;
  const fit: Footprint = {
    pressure,
    sink: Math.pow(ratio, F.floatExp),
    plane: Math.sqrt(ratio),
    powderDrive: Math.pow(lug, F.lugPowder),
    packedSide: Math.pow(1 / lug, F.lugSide),
    beltLoss: spec.treadLength / SLED.treadLength,
  };
  cache.set(spec, fit);
  return fit;
}
