// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN'S SHADOW STANDS, and which trees cast into it. Three-free,
// so `tests/shadow_box_test.ts` reads it without a browser; `environment.ts`
// aims the key light's box off it and `forest.ts` fills its casters off it.
//
// ONE MAP, SO ONE PLACE. A directional shadow map is a fixed number of
// texels, so it covers a patch of the basin and not the basin. The patch is
// a CIRCLE on the snow `reach` metres round a centre standing ahead of the
// lens — where the picture is — rather than round the sled, which a chase
// camera puts at the bottom of the frame. Inside it every shadow is drawn;
// over its last `SHADOW_FADE` a shadow fades to nothing (`haze.ts`'s graft
// on every world material), so the rim is a gradient that travels with the
// lens and never a line a shadow pops across.
//
// WHAT CASTS IS DECIDED BY WHERE THE SHADOW FALLS, not by how near the tree
// is to the lens. A tree casts when its shadow — a stroke from its trunk
// down-sun, as long as the sun's height makes it — can reach the circle.
// So a tree behind the lens whose shadow lies across the track casts, a
// tree in the full-detail band and one in the sketch band cast alike, and
// riding closer to a wood never switches its shadows on.

/** How far ahead of the lens the circle's centre stands, as a share of the
 * reach: the lens sits half a reach back from the centre, so the circle
 * runs one and a half reaches out in front of it. */
export const SHADOW_AHEAD = 0.5;

/** The share of the reach, at its rim, over which a shadow fades out. */
export const SHADOW_FADE = 0.3;

/** The longest shadow followed, as a share of the reach: a sun on the
 * horizon throws one to infinity, and past this the tree's shadow is so
 * thin and stretched it is not worth a place in the pass. */
export const SHADOW_TAIL = 1.5;

/** The light's box is the reach plus this each way, m, so a crown standing
 * over the rim and the relief under it both fit in the map. */
export const SHADOW_MARGIN = 12;

/** Where the shadow stands this frame. `sx, sy, sz` is the unit vector
 * TOWARD the sun. */
export type ShadowBox = {
  x: number;
  y: number;
  z: number;
  reach: number;
  sx: number;
  sy: number;
  sz: number;
};

/** Stand the circle's centre ahead of a lens at (`ex`, `ez`) looking along
 * (`lx`, `lz`) in plan. A lens looking straight down keeps its own spot. */
export function aimShadow(
  out: ShadowBox,
  ex: number,
  ez: number,
  lx: number,
  lz: number,
  reach: number,
): ShadowBox {
  const h = Math.hypot(lx, lz);
  const ahead = h > 1e-3 ? (SHADOW_AHEAD * reach) / h : 0;
  out.x = ex + lx * ahead;
  out.z = ez + lz * ahead;
  out.reach = reach;
  return out;
}

/** The plan distance from the circle's centre inside which a shadow is
 * drawn whole, and the one past which it is gone: the fade's two ends. */
export function shadowFade(reach: number): [number, number] {
  return [reach * (1 - SHADOW_FADE), reach];
}

/** How long a shadow a tree `height` m tall throws on level snow, m, capped
 * at `SHADOW_TAIL` reaches. */
export function shadowLength(box: ShadowBox, height: number): number {
  const plan = Math.hypot(box.sx, box.sz);
  const cap = SHADOW_TAIL * box.reach;
  if (box.sy <= 1e-3) return cap;
  return Math.min(cap, (height * plan) / box.sy);
}

/** Whether a tree at (`x`, `z`), `height` tall with a crown `crown` wide,
 * can put any of its shadow inside the circle: the plan distance from the
 * centre to the stroke from its trunk down-sun is under the reach. */
export function castsInto(
  box: ShadowBox,
  x: number,
  z: number,
  height: number,
  crown: number,
): boolean {
  const r = box.reach + crown;
  const px = box.x - x;
  const pz = box.z - z;
  const plan = Math.hypot(box.sx, box.sz);
  const len = plan > 1e-6 ? shadowLength(box, height) : 0;
  if (len <= 0) return px * px + pz * pz < r * r;
  // Down-sun, in plan.
  const dx = -box.sx / plan;
  const dz = -box.sz / plan;
  const along = Math.max(0, Math.min(len, px * dx + pz * dz));
  const qx = px - dx * along;
  const qz = pz - dz * along;
  return qx * qx + qz * qz < r * r;
}
