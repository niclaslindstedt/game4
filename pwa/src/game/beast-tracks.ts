// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT AN ANIMAL LEAVES IN THE SNOW — its prints, as stamps for the same
// trail map every sled's furrow goes into (`trail-map.ts`). Three-free, the
// sleds' `trail-stamp.ts` beside it, so the suite reads every print.
//
// A PRINT IS A STAMP, and nothing new: a short capsule along the line of
// travel, pressed to the animal's own depth in virgin powder and to a scuff
// on the groomer, with the berm a print throws. So a fox's line across a
// meadow is lowered into the snow by the terrain exactly as a ski's furrow
// is, shaded the same, and ridden over and flattened by a sled the same
// way — MAX blending keeps the deeper of the two.
//
// TWO KINDS OF PRINT. LAST NIGHT'S: every group has walked its round many
// times before the race began, so one whole lap of prints is laid over the
// map when the race is stood up (`priorPrints`) — which is why a meadow
// already has a fox's line across it on the first lap. And NEW ONES: an
// animal that has been frightened off its round lays fresh prints as it
// goes (`footfall`, stamped by `beasts.ts` as it walks), because the round
// it runs to has none.
//
// THE PATTERN is the species' (`Prints`): a fox's and a lynx's one straight
// line, each hind foot set in the fore's print; a hoofed animal's pairs,
// left and right; a hare's bound, the two long hind prints side by side
// AHEAD of the two small fore ones — the track that reads backwards to
// everyone who has not been told.

import { beastById, type BeastSpec } from "./beast-defs.ts";
import { memberSlot, roundAt, type BeastGroup } from "./beast-plan.ts";
import { TRAIL, type Stamp } from "./trail-stamp.ts";

/** How many of a herd's members leave a track worth laying: the leader and
 * a couple behind — the rest walk in their prints, as a herd does. */
export const TRACKED = 3;

/** How far apart a species' footfalls are, m: a bound per stride, and two
 * visible prints per stride on anything that walks or trots (the hind
 * foot lands in the fore's print). */
export function footfallSpacing(spec: BeastSpec): number {
  return spec.gait === "bound" ? spec.stride : spec.stride / 2;
}

/** One print at (`x`, `z`), `size` wide, long along the heading. */
function print(
  x: number,
  z: number,
  hx: number,
  hz: number,
  size: number,
  depth: number,
  out: Stamp[],
): void {
  const reach = size * 0.3;
  out.push({
    ax: x - hx * reach,
    az: z - hz * reach,
    bx: x + hx * reach,
    bz: z + hz * reach,
    half: size / 2,
    depth,
    berm: Math.min(TRAIL.maxBerm, depth * TRAIL.bermShare * 0.6),
  });
}

/**
 * The prints of footfall number `n` of an animal of `spec` at (`x`, `z`)
 * going along `heading`, on snow `packed` (0 powder … 1 groomed), pushed
 * onto `out`.
 */
export function footfall(
  spec: BeastSpec,
  x: number,
  z: number,
  heading: number,
  n: number,
  packed: number,
  out: Stamp[],
): void {
  const p = Math.min(1, Math.max(0, packed));
  const depth = spec.prints.depth * (1 - p) + TRAIL.packedDepth * p;
  const hx = Math.sin(heading);
  const hz = Math.cos(heading);
  // The right, in plan: heading 0 is +z and grows clockwise from above.
  const rx = hz;
  const rz = -hx;
  const g = spec.prints.gauge / 2;
  const size = spec.prints.size;
  if (spec.prints.pattern === "bound") {
    for (const side of [-1, 1]) {
      print(
        x + rx * g * side + hx * 0.12,
        z + rz * g * side + hz * 0.12,
        hx,
        hz,
        size * 1.3,
        depth,
        out,
      );
      print(
        x + rx * g * 0.4 * side - hx * 0.22,
        z + rz * g * 0.4 * side - hz * 0.22,
        hx,
        hz,
        size * 0.7,
        depth * 0.8,
        out,
      );
    }
    return;
  }
  const side = n % 2 === 0 ? 1 : -1;
  print(x + rx * g * side, z + rz * g * side, hx, hz, size, depth, out);
}

const at = { x: 0, z: 0, fx: 0, fz: 1 };

/**
 * LAST NIGHT'S PRINTS: one whole lap of `group`'s round, for each of its
 * tracked members, pushed onto `out`. `packedAt` is the map's own.
 */
export function priorPrints(
  group: BeastGroup,
  packedAt: (x: number, z: number) => number,
  out: Stamp[],
): void {
  const spec = beastById(group.species);
  const step = footfallSpacing(spec);
  const round = group.round;
  const members = Math.min(group.count, TRACKED);
  for (let i = 0; i < members; i++) {
    const { lag, side } = memberSlot(group, spec, i);
    let n = 0;
    for (let s = 0; s < round.length; s += step) {
      roundAt(round, s - lag, at);
      const x = at.x + at.fz * side;
      const z = at.z - at.fx * side;
      const heading = Math.atan2(at.fx * round.sense, at.fz * round.sense);
      footfall(spec, x, z, heading, n++, packedAt(x, z), out);
    }
  }
}
