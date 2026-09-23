// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SLED LEAVES IN THE SNOW, as arithmetic. Every probe the engine
// reports (`SledState.contacts` — the two skis, then the tread's stations)
// lays a CAPSULE from where it touched at the last stamp to where it
// touches now, so a trail is continuous at any speed and at any frame rate.
// `trail-map.ts` draws those capsules into the world-space trail map; this
// module decides what each one is, and is three-free so the suite reads it
// (`tests/world_render_test.ts`).
//
// THE DEPTH IS DRAWN, NOT MEASURED. The engine's `sink` is what its support
// model needs: a sled planing across powder at speed is carried a couple of
// centimetres into it, and a trough two centimetres deep is invisible from a
// chase camera. The eye knows better — a machine through fresh powder
// leaves a furrow a hand deep whatever its speed, because the snow it
// planed over has been PRESSED, not merely skimmed. So the drawn depth is
// the physics' sink or the powder's own furrow, whichever is deeper, with
// the furrow scaled by how much of the snow there was powder (`packedAt`):
// full in a virgin meadow, a faint scuff on the groomed track.
//
// THREE TRAILS, AND WHY. The skis stand a stance apart outside the tread
// and run a ski-width wide; the tread's stations, left and right, together
// press a band its own width between them. Laid over each other that is the
// snowmobile's signature — a wide band with two thin lines either side —
// and it falls out of the probes rather than being drawn as a decal.

import type { SnowContact } from "@engine";

export const TRAIL = {
  /** The deepest trough the map can hold, m — the encoding's full scale. */
  maxDepth: 0.5,
  /** The tallest berm, m — the second channel's full scale. */
  maxBerm: 0.12,
  /** The furrow a probe cuts in virgin powder, m, whatever the physics'
   * sink: a ski's and the tread's. */
  powderSki: 0.12,
  powderTread: 0.17,
  /** ...and on fully packed snow, m — a scuff the grain barely shows. */
  packedDepth: 0.012,
  /** The berm thrown up beside a furrow, as a share of its depth, and how
   * far it reaches out past the furrow's edge, as a share of its width. */
  bermShare: 0.35,
  bermReach: 0.9,
  /** A probe that has moved further than this since its last stamp is a
   * reset or a teleport, not a trail, m. */
  jump: 6,
  /** A THROWN RIDER's gouge (`bodyStampOf`): its width, m — shoulders and a
   * flung arm — and its depth in virgin powder, m. */
  body: 0.7,
  bodyDepth: 0.14,
};

/** One capsule of trail: from (ax, az) to (bx, bz), `half` wide either side
 * of that line, pressed `depth` m, with a berm `berm` m high beside it. */
export type Stamp = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
  depth: number;
  berm: number;
};

/** THE DEPTH A PROBE IS DRAWN AT, m, on snow `packed` (0 powder … 1
 * groomed) — its load share (`0..1`) scales the furrow, so a ski barely
 * kissing the snow on a hop leaves less than one carrying the nose, and the
 * run's snow dial (`GameState.snowDepth`) scales the powder's own furrow the
 * way it scales the physics' sink: a dusting leaves a scuff, a dump a
 * trench. */
export function drawnDepth(contact: SnowContact, packed: number, load = 1, depth = 1): number {
  const furrow = (contact.kind === "ski" ? TRAIL.powderSki : TRAIL.powderTread) * depth;
  const p = Math.min(1, Math.max(0, packed));
  const drawn = (furrow * (1 - p) + TRAIL.packedDepth * p) * Math.min(1, Math.max(0.25, load));
  return Math.min(TRAIL.maxDepth, Math.max(contact.sink, drawn));
}

/** The last place each probe of one rider was stamped. */
export type TrailPen = { xs: Float64Array; zs: Float64Array; down: Uint8Array };

export function createPen(probes: number): TrailPen {
  return {
    xs: new Float64Array(probes),
    zs: new Float64Array(probes),
    down: new Uint8Array(probes),
  };
}

/**
 * The capsules one rider lays since its last stamp, pushed onto `out`.
 * `packedAt` is the level's own; `nominalLoad` is the load (N) a probe
 * carries standing still, which is what "a full furrow" is measured
 * against; `depth` is the run's snow dial.
 */
export function stampsOf(
  contacts: readonly SnowContact[],
  pen: TrailPen,
  packedAt: (x: number, z: number) => number,
  nominalLoad: number,
  out: Stamp[],
  depth = 1,
): void {
  for (let i = 0; i < contacts.length && i < pen.xs.length; i++) {
    const c = contacts[i];
    if (!c.touching) {
      pen.down[i] = 0;
      continue;
    }
    const was = pen.down[i] === 1;
    const ax = was ? pen.xs[i] : c.x;
    const az = was ? pen.zs[i] : c.z;
    const moved = Math.hypot(c.x - ax, c.z - az);
    pen.xs[i] = c.x;
    pen.zs[i] = c.z;
    pen.down[i] = 1;
    if (moved > TRAIL.jump) continue;
    const load = nominalLoad > 0 ? c.load / nominalLoad : 1;
    const drawn = drawnDepth(c, packedAt(c.x, c.z), load, depth);
    out.push({
      ax,
      az,
      bx: c.x,
      bz: c.z,
      half: c.width * 0.5,
      depth: drawn,
      berm: Math.min(TRAIL.maxBerm, drawn * TRAIL.bermShare),
    });
  }
}

/** THE BODY'S TRAIL: a thrown rider (`Thrown`, `crash.ts`) sliding on the
 * snow ploughs a wide, shallow gouge of his own — a body is a footprint
 * too, and the sprawl it leaves is the one mark on the map that says a
 * crash happened here. One capsule from where he last touched to where he
 * touches now, drawn as a furrow of `TRAIL.body` width at the powder's own
 * depth (a scuff on the groomer); `pen` is a one-probe pen of its own. */
export function bodyStampOf(
  body: { x: number; z: number; touching: boolean },
  pen: TrailPen,
  packedAt: (x: number, z: number) => number,
  out: Stamp[],
): void {
  if (!body.touching) {
    pen.down[0] = 0;
    return;
  }
  const was = pen.down[0] === 1;
  const ax = was ? pen.xs[0] : body.x;
  const az = was ? pen.zs[0] : body.z;
  pen.xs[0] = body.x;
  pen.zs[0] = body.z;
  pen.down[0] = 1;
  if (Math.hypot(body.x - ax, body.z - az) > TRAIL.jump) return;
  const p = Math.min(1, Math.max(0, packedAt(body.x, body.z)));
  const depth = TRAIL.bodyDepth * (1 - p) + TRAIL.packedDepth * 2 * p;
  out.push({
    ax,
    az,
    bx: body.x,
    bz: body.z,
    half: TRAIL.body / 2,
    depth,
    berm: Math.min(TRAIL.maxBerm, depth * TRAIL.bermShare),
  });
}

/** The cross-section of one furrow at `d` m from its centreline: how far
 * the snow is pressed (0..1 of the stamp's depth) and how much berm stands
 * there (0..1 of its berm). The GLSL in `trail-map.ts` is this, verbatim. */
export function furrowProfile(d: number, half: number): { press: number; berm: number } {
  const u = d / Math.max(half, 1e-6);
  const press = u < 1 ? 1 - u * u * u * u : 0;
  const reach = TRAIL.bermReach;
  const v = (u - 0.8) / reach;
  const berm = v > 0 && v < 1 ? Math.sin(Math.PI * v) : 0;
  return { press, berm };
}

/**
 * WHERE THE FINE WINDOW STANDS. The fine map is a square `span` m wide that
 * follows the player; it is moved only when he has ridden `slack` m off its
 * centre, and then onto a multiple of `texel` so a texel of the old map
 * lands exactly on a texel of the new one. Returns the new centre, or null
 * when the window stays.
 */
export function recentre(
  cx: number,
  cz: number,
  px: number,
  pz: number,
  slack: number,
  texel: number,
): { x: number; z: number } | null {
  if (Math.abs(px - cx) < slack && Math.abs(pz - cz) < slack) return null;
  return { x: Math.round(px / texel) * texel, z: Math.round(pz / texel) * texel };
}
