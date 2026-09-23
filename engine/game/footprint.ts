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
// them (`TUNING.tread.lossQuad`) — grow with how much belt there is to turn
// and how tall its lugs stand: `(treadLength / L₀) · (h / h₀)^lugLoss`. A
// longer belt with taller lugs is a slower one at the same track speed —
// riders put a 144-inch belt at a tenth off a 136-inch one at 60 mph, and a
// 156-inch belt with 2-inch lugs at a quarter off — and that is the long
// tread's top end gone, and nothing else takes it.
//
// THE STUDS bite the groomer: carbide spikes through the belt that key into
// packed snow, worth `studGrip` of the tread's packed grip per hundred —
// driving, braking and holding sideways alike — and nothing in powder,
// where there is nothing hard enough to key into.
//
// THE SKIS' TWO FACES: on the groomer a ski turns the sled on the CARBIDE
// under its keel, and a longer runner cuts a longer groove — `(c / c₀)^
// carbideExp` on the skis' packed grip, which is why a race or touring ski
// on twin runners bites a bend a mountain ski on a stub pushes through; in
// powder the keel is buried and the ski steers on its BASE, the wider the
// more — `(w / w₀)^skiFloat` on the skis' powder grip.
//
// THE BELT'S MASS — the rubber the engine has to spin up, and the
// gyroscope the throttle and the brake pitch the machine with in the air —
// goes as its area and, less, its lugs: `(L·W / L₀·W₀) · (h / h₀)^lugMass`.
// A long, wide paddle belt is slower to spin up and swings a flight
// harder; a short trail belt answers the lever at once.

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
  /** The tread's grip on packed snow — driving, braking and sideways —
   * as a multiple of `grip.treadPacked` / `.treadSidePacked`: the studs. */
  studded: number;
  /** The skis' grip on packed snow, as a multiple of `grip.skiPacked`: the
   * carbides. */
  skiBite: number;
  /** The skis' grip in powder, as a multiple of `grip.skiPowder`: their
   * width. */
  skiFloat: number;
  /** The belt's mass, as a multiple of `tread.beltMass` — what the drive
   * spins up and what the throttle and the brake swing a flight with. */
  belt: number;
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
    beltLoss: (spec.treadLength / SLED.treadLength) * Math.pow(lug, F.lugLoss),
    studded: 1 + (F.studGrip * (spec.studs - SLED.studs)) / 100,
    skiBite: Math.pow(spec.carbide / SLED.carbide, F.carbideExp),
    skiFloat: Math.pow(spec.skiWidth / SLED.skiWidth, F.skiFloat),
    belt:
      ((spec.treadLength * spec.treadWidth) / (SLED.treadLength * SLED.treadWidth)) *
      Math.pow(lug, F.lugMass),
  };
  cache.set(spec, fit);
  return fit;
}
