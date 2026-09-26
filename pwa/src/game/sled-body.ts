// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS DRAWN — every machine built off TWO sources: its spec
// (`defs/sled.ts`: where the physics' skis and belt are, how tall it stands
// on its springs) and its class's TRACED LOOK (`sled-looks.ts`: the cowl,
// the screen, the bars, the seat, the tunnel and what rides on it, taken
// off a studio photograph of a real machine of the class and mapped onto
// the spec by `lookFrame`). Everything in the engine's own body frame — x
// right, y up, z forward, the origin at the centre of gravity of machine and
// rider — so a drawn ski stands where the ski probe is.
//
//   * THE CHASSIS — the cowl tapering to its nose, the headlamps under their
//     brow, the screen (tall on a work or touring machine, none on a mountain
//     or race sled), the bars on their riser (a mountain sled's loop over
//     them), the seat, what rides behind it (a tail pack, a cargo box on its
//     rail, a passenger's backrest, a trunk), the tunnel with its painted
//     flanks, the flap, the running boards, the bumpers, a race sled's plates.
//   * THE RUNNING GEAR — the skis on their front suspension and the belt on
//     its rear suspension, drawn in detail and posed off the engine's own
//     compressions (`sled-gear.ts`).
//   * THE RIDER (`rider.ts`), his hands on the traced grips: the figure is
//     set off by the traced grip's distance from `MOUNTS.grip`, so a machine
//     with its bars further forward or higher carries him there.
//
// Four colour schemes (`SLED_STYLES`), one per grid slot, their body paint
// read off `sled-colours.ts` so the minimap's dot is the same colour.

import * as THREE from "three";
import { type SledSpec, type SledState, type Thrown, type TrickPose } from "@engine";

import type { Pose } from "./interp.ts";
import { mergePosed } from "./posed-merge.ts";
import { createRider, type RiderFigure, type RiderStyle } from "./rider.ts";
import {
  MOUNTS,
  createRiderSpring,
  ragdollPose,
  riderPose,
  stepRiderSpring,
  type BodyFrame,
  type RiderInput,
} from "./rider-pose.ts";
import { SLED_BODY } from "./sled-colours.ts";
import { attachModels } from "./sled-models.ts";
import { BAR_TURN, buildGear, profile, strip } from "./sled-gear.ts";
import { LIVERIES, PATTERNS, type Livery, type PatternId } from "./sled-liveries.ts";
import { SLED_LOOKS, lookFrame } from "./sled-looks.ts";

export { REST_SAG } from "./sled-gear.ts";

export type SledStyle = {
  /** The paint, and the trim its graphics are cut in. */
  body: number;
  accent: number;
  rider: RiderStyle;
  /** The rest of a livery (`sled-liveries.ts`), when the style carries one:
   * the lower panels, the seat, the springs, the pattern. Left out, the
   * panels and seat are black, the springs the paint, and the pattern the
   * machine's own livery's. */
  panel?: number;
  seat?: number;
  spring?: number;
  pattern?: PatternId;
};

/** A grid slot's style dressed in a livery: the paint, the trim, the panels,
 * the seat, the springs and the pattern are the livery's; the rider's kit
 * stays the slot's. */
export function styleIn(style: SledStyle, livery: Livery): SledStyle {
  return {
    ...style,
    body: livery.body,
    accent: livery.trim,
    panel: livery.panel,
    seat: livery.seat,
    spring: livery.spring,
    pattern: livery.pattern,
  };
}

export const SLED_STYLES: SledStyle[] = [
  // The player's: the brand's red, and a racer's kit to match — a red
  // jacket with a black yoke, black pants, a black helmet under a red peak,
  // gold-mirrored goggles.
  {
    body: SLED_BODY[0],
    accent: 0xf4f4f4,
    rider: {
      jacket: 0xc92a1c,
      accent: 0x15171b,
      pants: 0x15171b,
      helmet: 0x1b1d21,
      visor: 0xd9a21a,
      peak: 0xe8412c,
      skin: 0xc68863,
    },
  },
  {
    body: SLED_BODY[1],
    accent: 0xf2f5f8,
    rider: {
      jacket: 0x2a6fd6,
      accent: 0xf2f2f2,
      pants: 0x1a1d24,
      helmet: 0xf2f2f2,
      visor: 0x6fb4e8,
      peak: 0x2a6fd6,
      skin: 0xe8b896,
    },
  },
  {
    body: SLED_BODY[2],
    accent: 0x151515,
    rider: {
      jacket: 0x252525,
      accent: 0xf2bf22,
      pants: 0x151515,
      helmet: 0xf2bf22,
      visor: 0x2b2f36,
      peak: 0x151515,
      skin: 0x8a5a3c,
    },
  },
  {
    body: SLED_BODY[3],
    accent: 0x0e1a14,
    rider: {
      jacket: 0x0f6b48,
      accent: 0x0e1a14,
      pants: 0x1b1f1d,
      helmet: 0x0e1a14,
      visor: 0xd96a2b,
      peak: 0x0f6b48,
      skin: 0xb07650,
    },
  },
];

export type SledModel = {
  root: THREE.Group;
  /** Pose from the engine's state, drawn at `at` (the interpolated place);
   * `sink` lowers the machine into the snow by the drawn furrow's extra
   * depth, m. */
  /** `trick` is a tricks run's pose held in the air, if any; `dt` is the
   * frame's, s — the rider's body on its legs moves with it (0 holds it);
   * `body` the rider thrown as drawn between two steps (`sampleBody`),
   * `sled.thrown` as stepped when not given. */
  pose(
    sled: SledState,
    at: Pose,
    sink: number,
    trick?: TrickPose | null,
    dt?: number,
    body?: Thrown | null,
  ): void;
  setRiderVisible(visible: boolean): void;
  /** Every mesh that draws the machine and its rider — what casts. */
  casters: THREE.Mesh[];
  /** The draw's bound in the world, at the last pose: grown while the
   * rider lies away from the machine. */
  bound(out: THREE.Sphere): THREE.Sphere;
  /** Lay the rider in a pose handed in whole rather than read off the
   * engine — the sled lab's (`tools/sled-harness.ts`), which holds him at an
   * exact moment. */
  poseRider(input: RiderInput): void;
  /** The lamps' glow, 0 (off) … 1 (full night) — `SkyLook.lamps` — seen
   * from `facing`: the cosine between the machine's nose and the way to
   * the lens (1 head-on, −1 from dead astern). A lamp is a lens that shines
   * one way: the headlamp glows at a lens in front, the taillight behind. */
  setLamps(level: number, facing: number): void;
  dispose(): void;
};

/** How far under the tunnel's top at its tail the rear lens sits, and how
 * far the glow round it stands behind the rearmost of the tail, m. */
const TAIL_LENS = { drop: 0.014, glowBack: 0.04 };

/** Where a machine's lamps are in its body frame, m: the headlamps where
 * its traced nose carries them, and the taillight as the lens across the
 * tunnel's tail at its top — the one lens that faces astern (the traced
 * taillight runs along the flank, edge-on from behind and hidden by the
 * flap). `glow` is where the tail's glow is hung: behind the flap and
 * everything else at the tail, or the machine's own flap buries it. The
 * headlamp's beam points along the body's forward axis, dipped by
 * `HEADLAMP_DIP`. */
export function lampMounts(spec: SledSpec): {
  head: [number, number, number];
  tail: [number, number, number];
  glow: [number, number, number];
} {
  const look = SLED_LOOKS[spec.id];
  const F = lookFrame(spec, look);
  const [end, top] = look.tunnelTop[0];
  const y = F.y(top - TAIL_LENS.drop);
  const back = Math.min(end, ...(look.flap ?? []).map((p) => p[0]));
  return {
    head: [0, F.y(look.lamps.y), F.z(look.lamps.z)],
    tail: [0, y, F.z(end)],
    glow: [0, y, F.z(back) - TAIL_LENS.glowBack],
  };
}

/** THE TAILLIGHT, lit: the lens's glow by day and what the dark adds to
 * it (emissive intensity), the brake's multiple of both (a combined tail
 * and brake lamp, the brake filament the brighter), and the glow round it
 * seen from behind at night, m across. */
const TAIL_LIT = { day: 0.6, night: 2.4, brake: 1.2, glow: 1.5 };

/** THE HEADLAMPS, lit: the lenses' glow by day and what the dark adds
 * (emissive intensity), and each lens's glow seen from ahead at night, m
 * across — larger than the tail's, as a lamp that has to show a rider 30 m
 * of snow is far brighter than one that only has to be seen. */
const HEAD_LIT = { day: 0.8, night: 3.2, glow: 1.8 };

/** How far below the body's forward axis the headlamp is aimed, rad. */
export const HEADLAMP_DIP = 0.1;

/** Where a machine carries its rider in its body frame, m: his own grip
 * (`MOUNTS.grip`) set onto the traced one, so his hands are on the bars. */
export function riderSeat(spec: SledSpec): THREE.Vector3 {
  const grip = lookFrame(spec).point(SLED_LOOKS[spec.id].grip);
  return new THREE.Vector3(0, grip[1] - MOUNTS.grip.y, grip[0] - MOUNTS.grip.z);
}

/** Whether `o` hangs anywhere under `group`. */
function isUnder(o: THREE.Object3D, group: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === group) return true;
  return false;
}

/** A soft round glow, white at the middle — every lamp's sprite. */
let glowTexture: THREE.DataTexture | null = null;
function glow(): THREE.DataTexture {
  if (glowTexture) return glowTexture;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const v = Math.max(0, 1 - r);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * v * v * v);
    }
  }
  glowTexture = new THREE.DataTexture(data, n, n);
  // A DataTexture samples NEAREST unless told otherwise: stretched over a
  // metre and a half, every texel was a square.
  glowTexture.magFilter = glowTexture.minFilter = THREE.LinearFilter;
  glowTexture.needsUpdate = true;
  return glowTexture;
}

/** Narrow a cowl toward its nose and its crown: every vertex's x scaled by
 * how far forward and how high it is — the photographed cowls are a wedge
 * in plan and rounded over the top, and one extrusion is neither. */
function taper(
  g: THREE.BufferGeometry,
  from: number,
  to: number,
  nose: number,
  low: number,
  high: number,
): void {
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const along = THREE.MathUtils.clamp((z - from) / (to - from), 0, 1);
    const up = THREE.MathUtils.clamp((y - low) / (high - low), 0, 1);
    pos.setX(i, pos.getX(i) * (1 - (1 - nose) * along * along) * (1 - 0.28 * up * up));
  }
  g.computeVertexNormals();
}

/** The part of a closed outline on the left of the line from `a` to `b`
 * (seen with z to the right and y up) — Sutherland and Hodgman against one
 * half-plane. */
function cutBy(
  points: [number, number][],
  a: [number, number],
  b: [number, number],
): [number, number][] {
  const side = (p: [number, number]) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** The part of a closed outline above (`keep` 1) or below (-1) the level
 * line y = `at`. */
function clip(points: [number, number][], at: number, keep: 1 | -1): [number, number][] {
  return keep > 0 ? cutBy(points, [0, at], [1, at]) : cutBy(points, [1, at], [0, at]);
}

export function createSledModel(
  spec: SledSpec,
  style: SledStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SledModel {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (params: THREE.MeshStandardMaterialParameters, name = "sled") => {
    const m = wrap(new THREE.MeshStandardMaterial(params), name);
    mats.push(m);
    return m;
  };
  const paint = mat({ color: style.body, roughness: 0.32, metalness: 0.05 });
  const accent = mat({ color: style.accent, roughness: 0.4 });
  const black = mat({ color: 0x1c1f23, roughness: 0.75 });
  const panel = mat({ color: style.panel ?? 0x1c1f23, roughness: 0.6 });
  const seatMat = mat({ color: style.seat ?? 0x2a2d33, roughness: 0.6 });
  const rubber = mat({ color: 0x121315, roughness: 0.95 });
  const alloy = mat({ color: 0x9aa1a9, roughness: 0.3, metalness: 0.8 });
  // The springs are painted the machine's own colour, as the photographed
  // coil-overs are — the one bright thing in the running gear.
  const spring = mat({ color: style.spring ?? style.body, roughness: 0.35, metalness: 0.3 });
  const pattern = PATTERNS[style.pattern ?? LIVERIES[spec.id][0].pattern];
  // THE HEADLAMPS' LENSES, lit the same way as the tail's below, and out
  // of the merged draw for the same reason.
  const lamp = mat({
    color: 0xfff6dc,
    emissive: 0xfff2cc,
    emissiveIntensity: HEAD_LIT.day,
    roughness: 0.2,
  });
  // THE TAILLIGHT'S LENS: a lamp, not paint — lit from inside, always on
  // (a sled's tail lamp burns whenever it runs, and must read from 150 m
  // behind it in the dark), brighter on the brake. It is its own mesh, out
  // of the merged draw, because the merged draw has one colour per part and
  // no light of its own: merged, it went as dark as the tunnel at night.
  const tailLens = mat({
    color: 0x4a0606,
    emissive: 0xff1c0c,
    emissiveIntensity: TAIL_LIT.day,
    roughness: 0.3,
  });
  const glass = wrap(
    new THREE.MeshStandardMaterial({
      color: 0x2c3a48,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
    "sled-glass",
  );
  mats.push(glass);

  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const look = SLED_LOOKS[spec.id];
  const F = lookFrame(spec, look);
  const pts = (list: [number, number][]) => list.map((p) => F.point(p));
  const grip = F.point(look.grip);
  const post = F.point(look.post);
  const seat = riderSeat(spec);
  const feetY = MOUNTS.foot.y + seat.y;

  // THE COWL: the traced outline, as wide as the class's hood, narrowed to
  // its nose and rounded over its crown.
  const hood = pts(look.hood);
  const hz = hood.map((p) => p[0]);
  const hy = hood.map((p) => p[1]);
  const zMin = Math.min(...hz);
  const zMax = Math.max(...hz);
  const yMin = Math.min(...hy);
  const yMax = Math.max(...hy);
  // Painted above the side panels and black below them, as the
  // photographed cowls are: the one outline cut in two at a level line.
  const cut = yMin + 0.4 * (yMax - yMin);
  const cowlTaper = (g: THREE.BufferGeometry) =>
    taper(
      g,
      zMin + (zMax - zMin) * 0.35,
      zMax,
      look.noseWidth / look.hoodWidth,
      yMin + 0.3 * (yMax - yMin),
      yMax,
    );
  const upper = profile(clip(hood, cut, 1), look.hoodWidth, 0.05);
  cowlTaper(upper);
  add(upper, paint);
  const lower = profile(clip(hood, cut, -1), look.hoodWidth * 0.97, 0.04);
  cowlTaper(lower);
  add(lower, panel);
  // THE LIVERY'S GRAPHICS on the cowl's flanks, in the trim: each decal
  // stated in the flank's own (u, v) — tail to nose, paint line to crown —
  // and laid a hair proud of the paint, narrowed with it.
  const flank = (u: number, v: number): [number, number] => [
    zMin + (zMax - zMin) * u,
    cut + (yMax - cut) * v,
  ];
  if (pattern.split) {
    const [p0, p1] = pattern.split;
    const g = profile(
      cutBy(clip(hood, cut, 1), flank(p1[0], p1[1]), flank(p0[0], p0[1])),
      look.hoodWidth + 0.012,
      0,
    );
    cowlTaper(g);
    add(g, accent);
  }
  for (const decal of pattern.cowl) {
    const g = profile(
      decal.map(([u, v]) => flank(u, v)),
      look.hoodWidth + 0.012,
      0,
    );
    cowlTaper(g);
    add(g, accent);
  }
  // The belly pan under the cowl, in black.
  add(
    profile(
      [
        [zMin + 0.05, yMin + 0.12],
        [zMax - 0.15, yMin + 0.1],
        [zMax - 0.3, yMin - 0.01],
        [zMin + 0.05, yMin - 0.01],
      ],
      look.hoodWidth * 0.8,
      0.02,
    ),
    black,
  );
  // THE HEADLAMPS under a dark brow, and the bumper at the nose.
  const lampY = F.y(look.lamps.y);
  const lampZ = F.z(look.lamps.z);
  for (const side of [-1, 1]) {
    const l = add(new THREE.BoxGeometry(0.12, 0.06, 0.04), lamp);
    l.position.set((side * look.lamps.width) / 3, lampY, lampZ);
    l.rotation.set(-0.5, side * 0.3, 0);
  }
  const brow = add(new THREE.BoxGeometry(look.lamps.width + 0.08, 0.03, 0.12), black);
  brow.position.set(0, lampY + 0.06, lampZ - 0.02);
  brow.rotation.x = -0.35;
  const bumper = add(new THREE.TorusGeometry(look.bumperWidth / 2, 0.018, 5, 12, Math.PI), alloy);
  bumper.rotation.set(-Math.PI / 2, 0, 0);
  bumper.position.set(0, F.y(look.hood[0][1]) - 0.04, zMax - 0.06);
  bumper.scale.set(1, 0.6, 1);
  if (look.plates || pattern.plates) {
    // THE RACE PLATES: a flat plate on each flank of the cowl and one on
    // the nose — white, or the trim on a machine painted white.
    const light = new THREE.Color(style.body).getHSL({ h: 0, s: 0, l: 0 }).l > 0.8;
    const plateMat = light ? accent : mat({ color: 0xf3f4f6, roughness: 0.5 });
    const [pz, py] = flank(0.55, 0.62);
    for (const side of [-1, 1]) {
      const plate = add(new THREE.BoxGeometry(0.014, 0.2, 0.3), plateMat);
      plate.position.set((side * look.hoodWidth) / 2 + side * 0.006, py, pz);
      plate.rotation.y = side * 0.12;
    }
    const nose = add(new THREE.BoxGeometry(0.26, 0.16, 0.012), plateMat);
    nose.position.set(0, lampY + 0.14, lampZ - 0.14);
    nose.rotation.x = -0.9;
  }

  // THE SCREEN, its four traced corners, raked as traced — and the mirrors
  // at its corners where the class carries them.
  let screen: THREE.Mesh | null = null;
  if (look.screen) {
    const S = look.screen;
    const sheet = profile(pts([S.foot, S.base, S.top, S.back]), S.width, 0);
    taper(sheet, F.z(S.foot[0]), F.z(S.top[0]) + 0.3, 1, F.y(S.base[1]), F.y(S.top[1]) + 0.2);
    screen = add(sheet, glass);
  }
  if (look.mirror) {
    const [m0, m1] = pts(look.mirror);
    const across = (look.screen?.width ?? 0.6) / 2 + 0.06;
    for (const side of [-1, 1]) {
      const m = add(new THREE.BoxGeometry(0.1, Math.abs(m0[1] - m1[1]), 0.03), black);
      m.position.set(side * across, (m0[1] + m1[1]) / 2, (m0[0] + m1[0]) / 2);
    }
  }

  // THE TUNNEL: the traced top edge back from the seat to the tail, and its
  // underside; the deck black, its flanks in the paint.
  const top = pts(look.tunnelTop);
  const under = pts(look.tunnelBottom);
  const front = under[under.length - 1];
  const tunnel = [
    ...top,
    [front[0], top[top.length - 1][1]] as [number, number],
    ...[...under].reverse(),
  ];
  add(profile(tunnel, look.tunnelWidth, 0.01), black);
  for (const side of [-1, 1]) {
    add(profile(tunnel, 0.012, 0, (side * look.tunnelWidth) / 2), paint);
  }
  if (pattern.tunnel) {
    // The livery's band down the tunnel's flank, under its top edge.
    const band = strip(
      top.map(([z, y]): [number, number] => [z, y - 0.03]),
      0.05,
    );
    for (const side of [-1, 1]) add(profile(band, 0.014, 0, (side * look.tunnelWidth) / 2), accent);
  }
  // THE FLAP off the tail, and the TAILLIGHT.
  if (look.flap) add(profile(strip(pts(look.flap), 0.015), look.tunnelWidth, 0), black);
  // The lens across the tunnel's tail, as the modelled machine carries it
  // (`scripts/blender/sled.py`'s `taillight_rear`), tipped back a little.
  const lens = lampMounts(spec).tail;
  const tail = add(new THREE.BoxGeometry(look.tunnelWidth * 0.475, 0.03, 0.012), tailLens);
  tail.position.set(lens[0], lens[1], lens[2] - 0.005);
  tail.rotation.x = 0.21;
  // The grab loop over the tail's tip.
  const grab = add(new THREE.TorusGeometry(look.tunnelWidth * 0.42, 0.015, 5, 10, Math.PI), alloy);
  grab.rotation.set(Math.PI / 2 - 0.25, 0, 0);
  grab.position.set(0, top[0][1] + 0.03, top[0][0] + 0.04);

  // THE SEAT, its traced top line over its base.
  const line = pts(look.seat).sort((a, b) => a[0] - b[0]);
  const seatFloor = F.y(look.seatBase);
  add(
    profile(
      [[line[0][0], seatFloor], ...line, [line[line.length - 1][0], seatFloor]],
      look.cargo || look.luggage ? 0.46 : 0.4,
      0.05,
    ),
    seatMat,
  );
  // WHAT RIDES BEHIND IT: a tail pack in the paint; a cargo box on its
  // rail and a passenger's backrest (a work sled); a trunk, a backrest and
  // grab handles (a touring machine).
  const closed = (list: [number, number][]): [number, number][] => [
    ...list,
    [list[list.length - 1][0], list[0][1]],
  ];
  if (look.tailbox) add(profile(closed(pts(look.tailbox)), 0.38, 0.03), paint);
  if (look.cargo) add(profile(pts(look.cargo), 0.6, 0.03), black);
  if (look.luggage) add(profile(pts(look.luggage), 0.55, 0.04), paint);
  if (look.backrest) add(profile(pts(look.backrest), 0.34, 0.03), seatMat);
  const rails = (list: [number, number][] | undefined, across: number) => {
    if (!list) return;
    const p = pts(list);
    for (const side of [-1, 1]) {
      for (let i = 1; i < p.length; i++) {
        const [z0, y0] = p[i - 1];
        const [z1, y1] = p[i];
        const bar = add(
          new THREE.CylinderGeometry(0.016, 0.016, Math.hypot(z1 - z0, y1 - y0), 6),
          alloy,
        );
        bar.position.set(side * across, (y0 + y1) / 2, (z0 + z1) / 2);
        bar.rotation.x = Math.atan2(z1 - z0, y1 - y0);
      }
    }
  };
  rails(look.rack, 0.33);
  rails(look.grabHandle, 0.25);

  // THE RUNNING BOARDS where the rider's boots are, over the traced stretch:
  // two rails either side on a mountain or race sled, a deck on the rest.
  const b0 = F.z(look.boards.from);
  const b1 = F.z(look.boards.to);
  for (const side of [-1, 1]) {
    const x = side * (look.tunnelWidth / 2 + 0.12);
    if (look.boards.open) {
      for (const dx of [-0.07, 0.07]) {
        const r = add(new THREE.BoxGeometry(0.025, 0.025, b1 - b0), alloy);
        r.position.set(x + dx, feetY - 0.045, (b0 + b1) / 2);
      }
    } else {
      const deck = add(new THREE.BoxGeometry(0.22, 0.025, b1 - b0), alloy);
      deck.position.set(x, feetY - 0.045, (b0 + b1) / 2);
    }
    // The toe hook at the front of the board.
    const hook = add(new THREE.BoxGeometry(0.16, 0.05, 0.04), black);
    hook.position.set(x, feetY - 0.01, b1 + 0.02);
    // The side panel between the cowl and the board.
    const panel = add(new THREE.BoxGeometry(0.03, 0.24, 0.4), paint);
    panel.position.set(side * (look.tunnelWidth / 2 + 0.03), feetY + 0.08, b1 - 0.1);
  }

  // THE BARS on their riser, turning about the steering post. A mountain
  // sled's loop rises over the middle of them.
  const bars = new THREE.Group();
  bars.position.set(0, grip[1], grip[0] + 0.04);
  root.add(bars);
  const riser = grip[1] - post[1];
  add(new THREE.CylinderGeometry(0.022, 0.028, riser, 6), alloy, bars).position.set(
    0,
    -riser / 2,
    0.02,
  );
  const bar = add(new THREE.CylinderGeometry(0.014, 0.014, look.barWidth + 0.04, 6), alloy, bars);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0, -0.04);
  for (const side of [-1, 1]) {
    const g = add(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), black, bars);
    g.rotation.z = Math.PI / 2;
    g.position.set(side * (look.barWidth / 2 - 0.02), 0, -0.04);
    // The handguards, in the class's second colour.
    const guard = add(new THREE.BoxGeometry(0.05, 0.08, 0.16), accent, bars);
    guard.position.set(side * (look.barWidth / 2 + 0.02), 0.02, 0.02);
  }
  if (look.handle) {
    const loop = add(
      new THREE.TorusGeometry(look.handle.width / 2, 0.013, 5, 10, Math.PI),
      alloy,
      bars,
    );
    loop.position.set(0, 0.02, -0.04);
    loop.scale.set(1, (look.handle.height + 0.03) / (look.handle.width / 2), 1);
  }

  // THE RUNNING GEAR, posed off the engine's compressions.
  const gear = buildGear(spec, look, root, {
    add,
    keep: (g) => geos.push(g),
    paint,
    black,
    rubber,
    alloy,
    spring,
  });

  const figure: RiderFigure = createRider(style.rider, wrap);
  figure.group.position.copy(seat);
  root.add(figure.group);
  const legs = createRiderSpring();

  // THE WHOLE MACHINE AND ITS RIDER AS ONE DRAW (`posed-merge.ts`): every
  // opaque part keeps its place in the tree for the posing and is drawn
  // through one vertex-coloured mesh, each part a bone of it. The windshield
  // stays its own mesh — it is the one transparent thing on the machine.
  const parts: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (
      o instanceof THREE.Mesh &&
      o.material !== glass &&
      o.material !== lamp &&
      o.material !== tailLens
    ) {
      parts.push(o);
    }
  });
  const merged = mergePosed(
    root,
    parts,
    mat({ vertexColors: true, roughness: 0.55, metalness: 0.05 }, "sled-merged"),
  );
  const mounts = lampMounts(spec);

  // THE MODELLED MACHINE AND RIDER, where this build draws them
  // (`sled-models.ts`): the code's drawn parts collapsed out of the merged
  // draw — the figure by hiding its group, the machine by hiding every
  // other part and its own lenses — and the models posed beside them.
  const models = attachModels({
    spec,
    root,
    machine: style,
    rider: style.rider,
    shared: { lamp, tail: tailLens, glass },
    wrap,
  });
  if (models?.machine) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && !isUnder(o, figure.group) && !models.meshes.includes(o)) {
        o.visible = false;
      }
    });
  }
  if (models?.rider) figure.group.visible = false;
  merged.update();

  // THE LAMPS' GLOW, drawn over the merged machine: additive sprites that
  // come up as the light goes, so a rival reads as two lights in the dark.
  const glowOf = (colour: number, size: number, at: [number, number, number]) => {
    const m = new THREE.SpriteMaterial({
      map: glow(),
      color: colour,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    mats.push(m);
    const sprite = new THREE.Sprite(m);
    sprite.scale.set(size, size, size);
    sprite.position.set(...at);
    sprite.visible = false;
    sprite.renderOrder = 6;
    root.add(sprite);
    return sprite;
  };
  // One glow on each lens: a machine coming at you is two lights.
  const headGlows = [-1, 1].map((side) =>
    glowOf(0xfff0d0, HEAD_LIT.glow, [
      (side * look.lamps.width) / 3,
      mounts.head[1],
      mounts.head[2] + 0.05,
    ]),
  );
  const tailGlow = glowOf(0xff2a1a, TAIL_LIT.glow, mounts.glow);
  // Over the snow cloud (drawn at 6): a sled's own tail hangs round its
  // lamps, and a glow drawn under it was buried there — the red the cloud
  // took from the lamp then had no lamp to come from.
  tailGlow.renderOrder = 7;
  for (const g of headGlows) g.renderOrder = 7;
  let braking = 0;

  const toRoot = new THREE.Quaternion();
  const thrown = new THREE.Quaternion();
  const trunk = new THREE.Matrix4();
  const axis = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  const frame: BodyFrame = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  // The merged draw's bound: the machine's own, grown while the rider is
  // lying away from it.
  const bound = merged.mesh.geometry.boundingSphere!;
  const BOUND = bound.radius;

  return {
    root,
    casters: [
      ...(models?.machine ? [] : screen ? [screen] : []),
      merged.mesh,
      ...(models?.meshes ?? []),
    ],
    bound(out) {
      out.center.copy(bound.center);
      root.localToWorld(out.center);
      out.radius = bound.radius;
      return out;
    },
    pose(sled, at, sink, trick = null, dt = 0, body) {
      root.position.set(at.x, at.y - sink, at.z);
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      gear.pose(sled, sink);
      const off = body === undefined ? sled.thrown : body;
      if (off) {
        // THE RIDER THROWN (`crash.ts`): off the machine, his figure hung
        // on the engine's ragdoll — laid in the root's frame at his trunk's
        // own place and turn, so the one merged draw still carries him, and
        // the draw's bound grown to reach him.
        const p = ragdollPose(off.points, frame);
        toRoot.set(at.q.x, at.q.y, at.q.z, at.q.w).invert();
        figure.group.position
          .set(frame.origin.x - at.x, frame.origin.y - (at.y - sink), frame.origin.z - at.z)
          .applyQuaternion(toRoot);
        trunk.makeBasis(
          axis.x.set(frame.x.x, frame.x.y, frame.x.z),
          axis.y.set(frame.y.x, frame.y.y, frame.y.z),
          axis.z.set(frame.z.x, frame.z.y, frame.z.z),
        );
        thrown.setFromRotationMatrix(trunk);
        figure.group.quaternion.copy(toRoot).multiply(thrown);
        figure.sprawl(p);
        models?.poseRider(p, figure.group);
        bound.radius = BOUND + figure.group.position.length();
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.copy(seat);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        stepRiderSpring(legs, sled.vy, sled.speed, sled.airborne, dt);
        const input: RiderInput = {
          stand: legs.stand,
          bump: legs.bump,
          riderRight: sled.riderRight,
          riderAft: sled.riderAft,
          lean: sled.lean,
          steer: sled.steer,
          airborne: sled.airborne,
          landing: sled.landing,
          trick,
        };
        figure.pose(input);
        models?.poseRider(riderPose(input), figure.group);
      }
      bars.rotation.y = sled.steer * BAR_TURN;
      braking = sled.brake;
      models?.pose(sled, sink, dt);
      merged.update();
    },
    setLamps(level, facing) {
      const ahead = THREE.MathUtils.smoothstep(facing, -0.2, 0.6);
      const behind = THREE.MathUtils.smoothstep(-facing, -0.1, 0.5);
      const on = Math.min(1, level);
      const brake = 1 + TAIL_LIT.brake * braking;
      tailLens.emissiveIntensity = (TAIL_LIT.day + TAIL_LIT.night * on) * brake;
      tailGlow.scale.setScalar(TAIL_LIT.glow * (1 + 0.4 * braking));
      lamp.emissiveIntensity = HEAD_LIT.day + HEAD_LIT.night * on;
      for (const [sprite, k] of [
        [headGlows[0], ahead],
        [headGlows[1], ahead],
        [tailGlow, behind * Math.min(1, 0.9 * brake)],
      ] as const) {
        const o = on * k;
        sprite.visible = o > 0.02;
        (sprite.material as THREE.SpriteMaterial).opacity = o;
      }
    },
    poseRider(input) {
      figure.pose(input);
      models?.poseRider(riderPose(input), figure.group);
      merged.update();
    },
    setRiderVisible(v) {
      models?.setRiderVisible(v);
      if (models?.rider || figure.group.visible === v) return;
      figure.group.visible = v;
      merged.update();
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      merged.dispose();
      figure.dispose();
      models?.dispose();
    },
  };
}
