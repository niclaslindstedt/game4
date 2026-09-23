// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE MACHINE MEETS THE SNOW — the probe layout, off the spec. Two
// SKI probes, one under the middle of each ski, on the front suspension;
// and the TREAD's footprint as four stations along its length by two
// across it, on the rear. Each probe is a spring-damper along the body's
// own down axis, cast from an attachment point on the chassis: the raycast
// vehicle, whose contact is wherever that ray meets the snow's support
// (`snow.ts`), with a bump stop at the end of its travel.
//
// THE REST LOAD each probe carries comes off the geometry rather than being
// authored: the skis and the tread's centroid either side of the centre of
// gravity split the weight by moment balance, and each attachment is placed
// so that probe's spring sits at exactly its rest sag with the CoG at
// `cogHeight` above the snow. So a sled put down on flat snow stands level
// at the height the spec says, and a spec with the skis moved forward
// carries less on them without a second number to keep in step.
//
// Beside them, the HULL: points on the chassis, the bumpers and the rider's
// helmet that are not sprung at all, and meet the snow only when the
// suspension has run out — a belly on a crest, a sled over on its side.

import { totalMass, type SledSpec, type SuspensionSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf, skiShare } from "./footprint.ts";

export type Probe = {
  kind: "ski" | "tread";
  /** -1 left, +1 right. */
  side: number;
  /** The attachment, body frame, m. The spring hangs down from here. */
  bx: number;
  by: number;
  bz: number;
  susp: SuspensionSpec;
  /** The load it carries at rest, N. */
  rest: number;
  /** Width of snow it presses, m, and whether it is at the FRONT of its
   * footprint and so ploughs (the tread's rear stations run in the trench
   * the front ones cut). */
  width: number;
  ploughs: boolean;
  /** Its share of the reference tread's sink, and its planing speed as a
   * multiple of `snow.planeSpeed` (`snow.ts`, `footprint.ts`). */
  sinkScale: number;
  planeScale: number;
};

export type HullPoint = { x: number; y: number; z: number };

/** Where the tread's footprint stations stand, as shares from its front
 * (0) to its rear (1). */
const TREAD_ROWS = [0, 1 / 3, 2 / 3, 1];

/** How far either side of the centreline the tread's two columns stand,
 * as a share of its half width — near its edges, where the lugs bear. */
const TREAD_EDGE = 0.7;

const layouts = new WeakMap<SledSpec, Probe[]>();
const hulls = new WeakMap<SledSpec, HullPoint[]>();

/** Every probe, skis first (left, right) then the tread front to back, left
 * before right. Built once per spec. */
export function probesOf(spec: SledSpec): Probe[] {
  const cached = layouts.get(spec);
  if (cached) return cached;
  const weight = totalMass(spec) * TUNING.g;
  const share = skiShare(spec);
  const probes: Probe[] = [];
  const attach = (susp: SuspensionSpec, rest: number): number =>
    -spec.cogHeight + susp.travel - rest / susp.rate;
  const skiRest = (weight * share) / 2;
  for (const side of [-1, 1]) {
    probes.push({
      kind: "ski",
      side,
      bx: (side * spec.skiStance) / 2,
      by: attach(spec.front, skiRest),
      bz: spec.skiForward,
      susp: spec.front,
      rest: skiRest,
      width: spec.skiWidth,
      ploughs: true,
      sinkScale: TUNING.snow.skiSink,
      planeScale: 1,
    });
  }
  const fit = footprintOf(spec);
  const stations = TREAD_ROWS.length * 2;
  const treadRest = (weight * (1 - share)) / stations;
  for (let r = 0; r < TREAD_ROWS.length; r++) {
    const bz = spec.treadFront + (spec.treadRear - spec.treadFront) * TREAD_ROWS[r];
    for (const side of [-1, 1]) {
      probes.push({
        kind: "tread",
        side,
        bx: (side * spec.treadWidth * TREAD_EDGE) / 2,
        by: attach(spec.rear, treadRest),
        bz,
        susp: spec.rear,
        rest: treadRest,
        width: spec.treadWidth / 2,
        ploughs: r === 0,
        sinkScale: fit.sink,
        planeScale: fit.plane,
      });
    }
  }
  layouts.set(spec, probes);
  return probes;
}

/** The chassis's own points, body frame: the belly's four corners, the
 * cowl's and the seat's upper corners, the front bumper low down, and the
 * crown of the rider's helmet. */
export function hullOf(spec: SledSpec): HullPoint[] {
  const cached = hulls.get(spec);
  if (cached) return cached;
  const w = spec.width / 2 - 0.1;
  const front = spec.length / 2;
  const rear = -spec.length / 2;
  const belly = -spec.cogHeight + 0.25;
  const top = spec.height - spec.cogHeight - 0.25;
  const points: HullPoint[] = [
    { x: -w, y: belly, z: front - 0.4 },
    { x: w, y: belly, z: front - 0.4 },
    { x: -w, y: belly, z: rear },
    { x: w, y: belly, z: rear },
    { x: -w, y: top, z: 0.6 },
    { x: w, y: top, z: 0.6 },
    { x: -w, y: top * 0.6, z: rear },
    { x: w, y: top * 0.6, z: rear },
    { x: 0, y: belly + 0.15, z: front },
    { x: 0, y: spec.height - spec.cogHeight + 0.2, z: -0.1 },
  ];
  hulls.set(spec, points);
  return points;
}
