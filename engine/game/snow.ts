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
//
// DEEP SNOW — past the ordinary depth, up to a metre of fresh (`SNOW_DIAL`,
// a northern winter's usual by March) — is a different medium, and riders
// say so in the same three sentences: KEEP IT MOVING (stop and it sinks to
// the belly and digs itself in), KEEP THE NOSE UP (a buried hood is a
// plough), and RIDE IT LIKE A BIKE (the skis are buried, the snow under
// them is soft, and it is the rider's weight that holds the sled up). The
// ordinary snow has a settled base under it that the tread presses down
// to; deep snow has none in reach, so its model grows by the BOTTOMLESS
// share (`bottomlessOf`: none at the ordinary depth, where every race is
// ridden and nothing below changes by a bit, all of it at a metre):
//   - THE SNOW GIVES UNDER LOAD: the support a footprint finds sinks
//     further the more it carries, (L / L₀)^give — the pressure–sinkage
//     curve of a snow with no base in reach (Bekker's, whose exponent for
//     fresh snow is near one). So the loaded side of a sled rolled over
//     sinks further than the other and rolls it further: a buried ski
//     holds nothing, and the balance is the rider's;
//   - IT STAYS PRESSED: snow a stopped footprint has compacted does not
//     spring back when the load comes off it — only a footprint moving onto
//     new snow rises (`settleShare`) — so a sled that has sunk stays sunk;
//   - IT PLANES LATER: the deeper the loose layer, the more of it a
//     footprint must press into a ramp before the ramp carries it, so the
//     planing speed grows with the depth (`deepPlane`);
//   - THE BELLY PLOUGHS: once a sled has sunk past its belly pan's
//     clearance, the pan and the nose shove snow as the footprints do
//     (`bellyPlough`, applied by `sled.ts` off the belly's own depth under
//     the untouched surface).

import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";

const S = TUNING.snow;
const G = TUNING.grip;

/** The support depth a probe settles toward, m: `packed` 0..1 is the
 * surface's share of groomed track, `speed` the machine's, `scale` the
 * probe's own share of the reference tread's sink (the skis sink less, a
 * lightly loaded tread less again) and `plane` its planing speed as a
 * multiple of `snow.planeSpeed` (`footprint.ts`). `depth` is the run's
 * SNOW DIAL (`GameState.snowDepth`, `SNOW_DIAL`): the powder's own sink
 * scaled, the groomer's cut left alone. In DEEP snow (`deep`, the dial's
 * `bottomlessOf`) the sink grows with `load`, the probe's load over its
 * rest load, and the planing speed with the depth. */
export function sinkTarget(
  packed: number,
  speed: number,
  scale: number,
  plane = 1,
  depth = 1,
  load = 1,
  deep = 0,
): number {
  const r = speed / (S.planeSpeed * plane * (deep > 0 ? deepPlaneOf(depth) : 1));
  let powder = S.powderSink * depth * scale * Math.exp(-r * r);
  // THE SNOW GIVES: `load` is the probe's load over its rest load — down to
  // the depth the whole loose layer compacts to, and never past it.
  if (deep > 0) {
    const gave = powder * Math.pow(clamp(load, 0, S.deep.loadMax), S.deep.give * deep);
    powder = Math.min(gave, Math.max(powder, S.deep.compact * S.cover * depth));
  }
  return powder * (1 - packed) + S.packedSink * packed;
}

/** How BOTTOMLESS the powder is at a run's snow dial (`GameState.
 * snowDepth`), 0..1: none at or under the ordinary snow, where the tread
 * presses down to a settled base, all of it at `deep.full`. The dial's
 * alone: what a fall lays during a run is centimetres on top of the snow
 * it had (`depthUnder` sinks a sled by them), never enough to lose a base
 * — and a race snowed on stays the race it was. */
export function bottomlessOf(depth: number): number {
  return depth <= 1 ? 0 : Math.min(1, (depth - 1) / (S.deep.full - 1));
}

/** The planing speed's multiple at a snow dial `depth`: 1 at the ordinary
 * snow, growing as the depth's `deep.plane` power past it. */
export function deepPlaneOf(depth: number): number {
  return depth <= 1 ? 1 : Math.pow(depth, S.deep.plane);
}

/** IT STAYS PRESSED: the share of the way back up a probe's sink may come
 * this step when the support asks for less than it has — all of it on the
 * ordinary snow, and in snow `deep` bottomless (`bottomlessOf`) only as
 * fast as the footprint moves onto snow nobody has pressed (`deep.settle`
 * m/s along it is all of it). */
export function settleShare(deep: number, speed: number): number {
  return deep > 0 ? 1 - deep * (1 - clamp(Math.abs(speed) / S.deep.settle, 0, 1)) : 1;
}

/** THE BELLY PLOUGH, N, as a magnitude: the belly pan `width` m wide
 * buried `under` m below the untouched surface of powder `packed` 0..1 at
 * `speed` m/s, in snow `deep` bottomless (`bottomlessOf`) — the plough's
 * own law (`snow.plough`), over the belly's width, by that share. */
export function bellyPlough(
  packed: number,
  under: number,
  width: number,
  speed: number,
  deep: number,
): number {
  if (deep <= 0 || under <= 0) return 0;
  const buried = Math.min(under, S.deep.bellyMax);
  return S.plough * S.deep.belly * deep * width * buried * speed * speed * (1 - packed);
}

/** The deepest a sled can sink here — a resting machine's — m, for a tread
 * that sinks `scale` times the reference's (`Footprint.sink`). What the
 * chassis contacts read as the bottom of the snow (`chassis.ts`): deep
 * powder does not hold a belly up, it is pushed aside by it — down to the
 * base the machine's own tread has pressed, and no further. `depth` is the
 * run's snow dial, as `sinkTarget` takes it. */
export function powderFloor(packed: number, scale = 1, depth = 1): number {
  return S.powderSink * depth * Math.max(1, scale) * (1 - packed) + S.packedSink * packed;
}

/** THE NEW SNOW over the groomer (`GameState.fresh`, `snowfall.ts`): the
 * share of a surface `packed` 0..1 that still rides as packed under `fresh`
 * m of new fall — the whole of it under none, none of it once
 * `snow.freshBury` has fallen. Every probe, the chassis, a stood sled and a
 * thrown body read the surface through this, so the sink, the drag, the
 * grip and the hiss (`SledState.packed`) all feel the same layer. */
export function packedUnder(packed: number, fresh: number): number {
  return fresh > 0 ? packed * Math.max(0, 1 - fresh / S.freshBury) : packed;
}

/** The run's snow dial with `fresh` m of new snow laid over the powder: a
 * dial is a multiple of `snow.powderSink`, and the new snow deepens it by
 * its own depth. */
export function depthUnder(depth: number, fresh: number): number {
  return depth + Math.max(0, fresh) / S.powderSink;
}

/** How deep a sled at rest sinks into untouched powder at a run's snow
 * dial, m. */
export function restSinkOf(depth: number): number {
  return S.powderSink * depth;
}

/** How deep the loose snow IS at a run's snow dial, m — the figure the
 * start card reads the dial back as (`snow.cover` at the ordinary snow). */
export function snowCoverOf(depth: number): number {
  return S.cover * depth;
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

/** What BARE ICE leaves of a grip already read (`gripAt`), `ice` 0..1 of
 * the probe's footprint on it (R21's frozen river, `Level.iceAt`): each
 * coefficient eased toward its share of `grip.ice`. The ice is packed —
 * the level folds it into `packedAt` as hard as the groomer — so the
 * sink, the drag and the rolling are the groomer's already, and the grip
 * is the one thing ice takes away. */
export function onIce(out: Grip, ice: number): Grip {
  const I = G.ice;
  out.tread *= 1 - ice * (1 - I.tread);
  out.treadSide *= 1 - ice * (1 - I.side);
  out.ski *= 1 - ice * (1 - I.ski);
  return out;
}

/** The friction coefficients at `packed` 0..1, into `out`, for a machine
 * whose footprint (`footprint.ts`) is `fit`: lugs that bite `powderDrive`
 * times the reference's in powder — driving and holding sideways alike, a
 * paddle digs whichever way the snow is shoved — and hold `packedSide`
 * times its sideways grip on the groomer; studs worth `studded` of the
 * tread's packed grip; carbides worth `skiBite` of the skis' packed grip,
 * and a ski base worth `skiFloat` of their powder grip. The reference's
 * footprint is 1 on every one. */
export function gripAt(packed: number, out: Grip, fit: GripFit = UNIT_FIT): Grip {
  const p = 1 - packed;
  out.tread = G.treadPacked * fit.studded * packed + G.treadPowder * fit.powderDrive * p;
  out.treadSide =
    G.treadSidePacked * fit.packedSide * fit.studded * packed +
    G.treadSidePowder * fit.powderDrive * p;
  out.ski = G.skiPacked * fit.skiBite * packed + G.skiPowder * fit.skiFloat * p;
  return out;
}

/** The share of a footprint the grip reads (`Footprint` carries it). */
export type GripFit = {
  powderDrive: number;
  packedSide: number;
  studded: number;
  skiBite: number;
  skiFloat: number;
};

const UNIT_FIT: GripFit = { powderDrive: 1, packedSide: 1, studded: 1, skiBite: 1, skiFloat: 1 };
