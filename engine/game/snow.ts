// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW UNDER A PROBE — how far it lets the machine sink, what it costs
// to push through, and how hard it can be gripped. The sled's water: a
// groomed track is a hard surface with a few centimetres of cut in it, and
// untouched powder is a medium the machine floats on only while it is going
// fast enough.
//
// THE SINK is the planing hull's draft carried straight over. Snow under a
// moving footprint has less time to yield the faster it is crossed, so the
// support rises with speed: at rest the tread is buried to its rails
// (`snow.powderSink`), and it comes up as exp(−(v / planeSpeed)²) — a third of
// that at the planing speed and a few centimetres by 40 km/h, which is the
// moment a rider feels the machine lift onto the top of the snow. The sink is
// the SUPPORT's depth under the untouched surface: the suspension springs push
// against `groundAt − sink`, and the trail the renderer stamps is that deep.
//
// THE RESISTANCE is three terms, all along the probe's line of travel:
// rolling resistance as a share of the load (the groomer's surface, or the
// powder's), the PLOUGH — snow shoved aside by a sunk footprint's front,
// growing with the square of the speed and with the depth it is sunk, the bow
// wave of a displacement hull — and POWDER DRAG, the cost of compacting fresh
// snow, linear in speed. The plough is why a bogged sled wants momentum and
// the sink falling away with speed is why it gets easier once it has some.

import { TUNING } from "./defs/tuning.ts";

const S = TUNING.snow;
const G = TUNING.grip;

/** The support depth a probe settles toward, m: `packed` 0..1 is the
 * surface's share of groomed track, `speed` the machine's, `scale` the
 * probe's own share of the reference tread's sink (the skis sink less, a
 * lightly loaded tread less again) and `plane` its planing speed as a
 * multiple of `snow.planeSpeed` (`footprint.ts`). */
export function sinkTarget(packed: number, speed: number, scale: number, plane = 1): number {
  const r = speed / (S.planeSpeed * plane);
  const powder = S.powderSink * scale * Math.exp(-r * r);
  return powder * (1 - packed) + S.packedSink * packed;
}

/** The deepest a sled can sink here — a resting machine's — m. What the
 * chassis contacts read as the bottom of the snow (`sled.ts`): deep powder
 * does not hold a belly up, it is pushed aside by it. */
export function powderFloor(packed: number): number {
  return S.powderSink * (1 - packed) + S.packedSink * packed;
}

/** The resistance along a probe's line of travel, N, as a magnitude (the
 * caller gives it the sign against the motion): rolling, the plough off a
 * footprint `width` m wide sunk `sink` m into powder, and powder drag, at
 * `speed` m/s with `load` N on it. A groomed track's few centimetres of cut
 * is rolling resistance and nothing else: there is no powder to shove.
 * `compact` scales the powder drag for the footprint pressing it: the work
 * of compacting snow goes as how far it is pressed down (Bekker's
 * compaction resistance), so a footprint that sinks less pays less
 * (`Footprint.sink`). */
export function snowDrag(
  packed: number,
  sink: number,
  width: number,
  load: number,
  speed: number,
  compact = 1,
): number {
  const v = Math.abs(speed);
  const crr = S.crrPacked * packed + S.crrPowder * (1 - packed);
  const plough = S.plough * width * sink * v * v * (1 - packed);
  const powder = S.powderDrag * compact * load * v * (1 - packed);
  return crr * load + plough + powder;
}

export type Grip = { tread: number; treadSide: number; ski: number };

/** The friction coefficients at `packed` 0..1, into `out`, for a tread
 * whose lugs bite `powderDrive` times the reference's in powder — driving
 * and holding sideways alike, a paddle digs whichever way the snow is
 * shoved — and hold `packedSide` times its sideways grip on the groomer
 * (`footprint.ts`). */
export function gripAt(packed: number, out: Grip, powderDrive = 1, packedSide = 1): Grip {
  const p = 1 - packed;
  out.tread = G.treadPacked * packed + G.treadPowder * powderDrive * p;
  out.treadSide = G.treadSidePacked * packedSide * packed + G.treadSidePowder * powderDrive * p;
  out.ski = G.skiPacked * packed + G.skiPowder * p;
  return out;
}
