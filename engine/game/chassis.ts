// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHASSIS MEETING THE SNOW — the unsprung points (`suspension.ts`'s
// `hullOf`: the belly, the cowl, the bumper, the rider's helmet) that touch
// the snow when the springs have run out: a belly grounded on a crest, a nose
// buried in a face met too fast, a sled on its side or on its back.
//
// Resolved at the VELOCITY level, not with springs. A penalty spring stiff
// enough to hold three hundred kilos off a slope met at eighty kilometres an
// hour stores the whole impact and hands it back — the sled that hit the foot
// of a face was fired forty metres up it. So each point in the snow has the
// part of its velocity INTO the slope taken away by an impulse through the
// body's effective mass there (the angular term included, so a nose meeting
// the snow pitches the sled as well as stopping it), with `restitution` of it
// given back, plus a push-out capped at `pushOut` m/s for whatever depth it
// has already reached; and Coulomb friction takes the slide along the slope,
// up to `friction` of that impulse. One pass over the points, in order — the
// sequential-impulse solver's single iteration, which for a handful of points
// on one body settles within a couple of steps.
//
// The snow under a chassis point is the powder's FLOOR (`snow.ts`): deep
// powder does not hold a belly up, it is pushed aside by it.

import { rotate, unrotate, type Vec3 } from "../lib/quat.ts";
import type { Level } from "../mapgen/types.ts";
import { inertiaOf, totalMass } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf } from "./footprint.ts";
import { packedUnder, powderFloor } from "./snow.ts";
import { hullOf } from "./suspension.ts";
import type { SledState } from "./state.ts";

const H = TUNING.hull;
const n: Vec3 = { x: 0, y: 1, z: 0 };

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Apply the chassis contacts to the sled's velocities, on snow at the
 * run's depth dial (`GameState.snowDepth`, the new snow laid in —
 * `depthUnder`) with `fresh` m of new snow over the groomer. Returns the fastest
 * speed into the snow met this step, m/s (0 with no point touching). */
export function chassisContacts(c: SledState, level: Level, snowDepth = 1, fresh = 0): number {
  const m = totalMass(c.spec);
  const I = inertiaOf(c.spec);
  const sink = footprintOf(c.spec).sink;
  let worst = 0;
  let touched = false;
  for (const h of hullOf(c.spec)) {
    const r = rotate(c.q, h);
    const px = c.x + r.x;
    const py = c.y + r.y;
    const pz = c.z + r.z;
    const floor =
      level.groundAt(px, pz) -
      powderFloor(packedUnder(level.packedAt(px, pz), fresh), sink, snowDepth);
    const pen = floor - py;
    if (pen <= 0) continue;
    touched = true;
    level.normalAt(px, pz, n);
    const depth = pen * n.y;
    // The point's velocity: v + ω × r, with ω taken into the world frame.
    const w = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
    const wr = cross(w, r);
    const vx = c.vx + wr.x;
    const vy = c.vy + wr.y;
    const vz = c.vz + wr.z;
    const vn = vx * n.x + vy * n.y + vz * n.z;
    const target = Math.min(depth * H.pushRate, H.pushOut);
    if (vn >= target) continue;
    if (-vn > worst) worst = -vn;
    // The effective mass along the normal at this point.
    const rn = unrotate(c.q, cross(r, n));
    const k = 1 / m + rn.x * (rn.x / I.x) + rn.y * (rn.y / I.y) + rn.z * (rn.z / I.z);
    const goal = vn < 0 ? Math.max(target, -H.restitution * vn) : target;
    const jn = (goal - vn) / k;
    // Friction against the slide along the slope, bounded by Coulomb.
    let tx = vx - vn * n.x;
    let ty = vy - vn * n.y;
    let tz = vz - vn * n.z;
    const slide = Math.hypot(tx, ty, tz);
    let jt = 0;
    if (slide > 1e-4) {
      tx /= slide;
      ty /= slide;
      tz /= slide;
      const t = { x: tx, y: ty, z: tz };
      const rt = unrotate(c.q, cross(r, t));
      const kt = 1 / m + rt.x * (rt.x / I.x) + rt.y * (rt.y / I.y) + rt.z * (rt.z / I.z);
      jt = Math.min(slide / kt, H.friction * jn);
    }
    const Jx = n.x * jn - tx * jt;
    const Jy = n.y * jn - ty * jt;
    const Jz = n.z * jn - tz * jt;
    c.vx += Jx / m;
    c.vy += Jy / m;
    c.vz += Jz / m;
    const dL = unrotate(c.q, cross(r, { x: Jx, y: Jy, z: Jz }));
    c.wx += dL.x / I.x;
    c.wy += dL.y / I.y;
    c.wz += dL.z / I.z;
  }
  return touched ? Math.max(worst, 1e-6) : 0;
}
