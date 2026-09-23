// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS, BUILT — one flat-shaded, vertex-coloured quadruped a species,
// sized off the roster's row (`beast-defs.ts`) and shaped and painted off
// `BEAST_STYLES` here, and the material that walks it.
//
// SEEN ACROSS THE SNOW at chase range is the design constraint: what reads
// is the SILHOUETTE against white — the hare's long ears and its tucked
// shape, the fox's brush, the reindeer's antlers and pale neck, the moose's
// hump and long face over its pale legs, the lynx's tufts and stub tail —
// and the colour, which on a winter hill is mostly dark against light (and,
// on the one white animal, the black tips of its ears).
//
// THE LEGS MOVE IN THE VERTEX SHADER, the birds' wings' trick: each leg's
// vertices carry which leg they are (`aLeg`, its phase in the gait) and
// where its hip is (`aHip`), and the neck and head carry `aHead`; per
// instance the shader is told the GAIT (where in its cycle the animal is),
// the STRIDE (how hard it is going) and the GRAZE (how far the head is
// down), all read off `beastPose`. One draw call a species, whatever the
// herd is doing.

import * as THREE from "three";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { BeastId, BeastSpec, Gait } from "./beast-defs.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** How a species is shaped past its length and height, and painted. */
export type BeastStyle = {
  readonly coat: number;
  readonly belly: number;
  readonly legs: number;
  readonly head: number;
  /** The ears' colour (or their tips'), the tail's, and anything on the
   * head that is not the head — antlers. */
  readonly ears: number;
  readonly tail: number;
  readonly antlers?: number;
  /** The body's width as a share of the height, how thick a leg is as a
   * share of the height, how long the neck is as a share of the length and
   * how high it carries the head (0 level, 1 straight up), the head's own
   * length as a share of the length, the ears' length as a share of the
   * height, and the tail's length as a share of the length and its droop
   * (0 straight out behind, 1 straight down). */
  readonly width: number;
  readonly leg: number;
  readonly neck: number;
  readonly carriage: number;
  readonly headLength: number;
  readonly ear: number;
  readonly tailLength: number;
  readonly droop: number;
  /** How far down the body hangs between the legs, as a share of the
   * height: a hare is nearly all body, a moose is legs. */
  readonly depth: number;
  /** A shoulder hump, as a share of the height — the moose's. */
  readonly hump?: number;
};

export const BEAST_STYLES: Readonly<Record<BeastId, BeastStyle>> = {
  // White, with the black ear tips a winter hare keeps.
  hare: {
    coat: 0xeef1f2,
    belly: 0xf6f7f8,
    legs: 0xe8ebec,
    head: 0xeef1f2,
    ears: 0x1a1a1c,
    tail: 0xf8f9f9,
    width: 0.62,
    leg: 0.17,
    neck: 0.12,
    carriage: 0.55,
    headLength: 0.24,
    ear: 0.62,
    tailLength: 0.08,
    droop: 0.2,
    depth: 0.7,
  },
  // Rust on the snow, white bib, black stockings, the white-tipped brush.
  fox: {
    coat: 0xc2622a,
    belly: 0xf0ebe0,
    legs: 0x2a1e18,
    head: 0xc86a30,
    ears: 0x2a1e18,
    tail: 0xb85a26,
    width: 0.42,
    leg: 0.12,
    neck: 0.16,
    carriage: 0.35,
    headLength: 0.3,
    ear: 0.25,
    tailLength: 0.62,
    droop: 0.25,
    depth: 0.52,
  },
  // Grey-brown with the pale neck and the antlers the cows keep all winter.
  reindeer: {
    coat: 0x6e5f50,
    belly: 0xcfc8b8,
    legs: 0x54483c,
    head: 0x5a4c40,
    ears: 0x5a4c40,
    tail: 0xe0dace,
    antlers: 0x9c8a6e,
    width: 0.45,
    leg: 0.1,
    neck: 0.3,
    carriage: 0.55,
    headLength: 0.26,
    ear: 0.12,
    tailLength: 0.08,
    droop: 0.7,
    depth: 0.46,
  },
  // Near-black, the hump, the long heavy face, the pale grey stockings.
  moose: {
    coat: 0x2b211b,
    belly: 0x241c17,
    legs: 0xa09584,
    head: 0x33271f,
    ears: 0x2b211b,
    tail: 0x2b211b,
    width: 0.3,
    leg: 0.09,
    neck: 0.22,
    carriage: 0.45,
    headLength: 0.3,
    ear: 0.12,
    tailLength: 0.04,
    droop: 0.8,
    depth: 0.42,
    hump: 0.12,
  },
  // Grey-buff, pale beneath, black ear tufts and a black-tipped stub.
  lynx: {
    coat: 0xa89478,
    belly: 0xe6ddcc,
    legs: 0x9c8a70,
    head: 0xb09c80,
    ears: 0x1a1818,
    tail: 0x1e1a18,
    width: 0.4,
    leg: 0.15,
    neck: 0.14,
    carriage: 0.35,
    headLength: 0.22,
    ear: 0.2,
    tailLength: 0.16,
    droop: 0.55,
    depth: 0.5,
  },
};

/** Each leg's place in the gait cycle, as a share of it — left fore, right
 * fore, left hind, right hind. A walk is the four-beat, a trot the
 * diagonal pairs, a bound the pairs of fore and hind. */
export const LEG_PHASE: Readonly<Record<Gait, readonly [number, number, number, number]>> = {
  walk: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  bound: [0, 0.06, 0.5, 0.56],
};

/** How far a leg swings off plumb at a full stride, rad. */
export const LEG_SWING: Readonly<Record<Gait, number>> = { walk: 0.42, trot: 0.55, bound: 0.95 };

/** How far the head goes down at a full graze, rad. */
const GRAZE_ANGLE = 1.05;

type Tags = { leg: number[]; hip: number[]; head: number[] };

/** Tag every vertex emitted since `from` as one part. */
function tag(b: Builder, tags: Tags, from: number, leg: number, hip: number, head: number): void {
  for (let i = from; i < b.vertexCount; i++) {
    tags.leg[i] = leg;
    tags.hip[i] = hip;
    tags.head[i] = head;
  }
}

/**
 * One animal of a species, in metres, standing on y = 0 with its nose
 * toward +z, legs plumb and head up. Carries `aLeg` (0, or 1 + the leg's
 * phase share), `aHip` and `aHead` for the graft to read.
 */
export function buildBeast(
  spec: BeastSpec,
  style: BeastStyle,
): { geometry: THREE.BufferGeometry; pivot: { y: number; z: number } } {
  const b = new Builder();
  const tags: Tags = { leg: [], hip: [], head: [] };
  const L = spec.length;
  const H = spec.height;
  const depth = style.depth * H;
  const bodyY = H - depth / 2;
  const ry = depth / 2;
  const rx = (style.width * H) / 2;
  const hump = (style.hump ?? 0) * H;

  // ── The body: rings along z from the rump to the chest ────────────────
  const SIDES = 8;
  const stations: readonly [number, number, number][] = [
    // z share, radius share, rise (m)
    [-0.5, 0.45, 0],
    [-0.36, 0.95, 0],
    [0.05, 1, hump * 0.3],
    [0.3, 0.95, hump],
    [0.46, 0.55, hump * 0.5],
  ];
  const start = b.vertexCount;
  const rings: P[][] = stations.map(([zs, rs, rise]) =>
    Array.from({ length: SIDES }, (_, s) => {
      const a = (s / SIDES) * Math.PI * 2;
      return [Math.cos(a) * rx * rs, bodyY + rise + Math.sin(a) * ry * rs, zs * L] as P;
    }),
  );
  const paint = Array.from({ length: SIDES }, (_, s) =>
    Math.sin(((s + 0.5) / SIDES) * Math.PI * 2) > -0.3 ? style.coat : style.belly,
  );
  b.loft(rings, paint, true);
  b.cap(rings[0], style.coat, true);
  b.cap(rings[rings.length - 1], style.coat, false);
  tag(b, tags, start, 0, 0, 0);

  // ── The legs: plumb tubes, hip to snow ────────────────────────────────
  const phase = LEG_PHASE[spec.gait];
  const legR = style.leg * H * 0.5;
  const hipY = bodyY;
  const legs: readonly [number, number][] = [
    [-1, 0.36],
    [1, 0.36],
    [-1, -0.38],
    [1, -0.38],
  ];
  legs.forEach(([side, zs], k) => {
    const from = b.vertexCount;
    const x = side * rx * 0.55;
    const z = zs * L;
    // A hind leg is thicker at the top; a hare's is long and folded, which
    // at this size reads as a thick short one.
    const top = k >= 2 ? legR * 1.5 : legR * 1.15;
    b.tube([x, hipY, z], [x, 0.02, z], top, style.legs, 5, legR * 0.8);
    tag(b, tags, from, 1 + phase[k], hipY, 0);
  });

  // ── The neck and head, about the pivot at the withers ─────────────────
  const pivot = { y: bodyY + ry * 0.4 + hump * 0.5, z: L * 0.4 };
  const neckLen = style.neck * L;
  const lift = style.carriage;
  const headBase: P = [
    0,
    pivot.y + neckLen * lift,
    pivot.z + neckLen * Math.sqrt(Math.max(0, 1 - lift * lift)),
  ];
  const fromHead = b.vertexCount;
  b.tube(
    [0, pivot.y - ry * 0.3, pivot.z - L * 0.04],
    headBase,
    ry * 0.55,
    style.coat,
    6,
    ry * 0.42,
  );
  const hl = style.headLength * L;
  const hr = ry * 0.52;
  b.tube(headBase, [0, headBase[1] - hl * 0.3, headBase[2] + hl], hr, style.head, 6, hr * 0.55);
  // The ears, up and back off the crown.
  const earLen = style.ear * H;
  for (const side of [-1, 1]) {
    const root: P = [side * hr * 0.6, headBase[1] + hr * 0.6, headBase[2] + hl * 0.1];
    const tip: P = [side * hr * 1.1, root[1] + earLen, root[2] - earLen * 0.35];
    const mid: P = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2];
    b.tube(root, mid, hr * 0.3, style.head, 4, hr * 0.25);
    b.tube(mid, tip, hr * 0.25, style.ears, 4, hr * 0.06);
  }
  // Antlers: a beam up and back off each side of the crown, tines forward.
  if (style.antlers) {
    const a = style.antlers;
    const beam = H * 0.55;
    for (const side of [-1, 1]) {
      const root: P = [side * hr * 0.5, headBase[1] + hr * 0.8, headBase[2]];
      const bend: P = [side * beam * 0.45, root[1] + beam * 0.55, root[2] - beam * 0.25];
      const top: P = [side * beam * 0.35, root[1] + beam, root[2] + beam * 0.05];
      b.tube(root, bend, hr * 0.14, a, 4, hr * 0.12);
      b.tube(bend, top, hr * 0.12, a, 4, hr * 0.05);
      b.tube(
        bend,
        [side * beam * 0.55, bend[1] + beam * 0.2, bend[2] + beam * 0.3],
        hr * 0.08,
        a,
        3,
        hr * 0.03,
      );
      b.tube(
        root,
        [side * hr * 0.6, root[1] + beam * 0.2, root[2] + beam * 0.3],
        hr * 0.08,
        a,
        3,
        hr * 0.03,
      );
    }
  }
  tag(b, tags, fromHead, 0, 0, 1);

  // ── The tail ──────────────────────────────────────────────────────────
  const fromTail = b.vertexCount;
  const tl = style.tailLength * L;
  if (tl > 0.01) {
    const root: P = [0, bodyY + ry * 0.5, -L * 0.5];
    const d = style.droop;
    const tip: P = [0, root[1] - tl * d, root[2] - tl * Math.sqrt(Math.max(0, 1 - d * d))];
    b.tube(root, tip, ry * 0.22, style.tail, 5, ry * (spec.id === "fox" ? 0.2 : 0.12));
    // The fox's brush ends in white.
    if (spec.id === "fox") {
      const end: P = [0, tip[1] - tl * 0.1, tip[2] - tl * 0.15];
      b.tube(tip, end, ry * 0.2, 0xf4f2ee, 5, ry * 0.05);
    }
  }
  tag(b, tags, fromTail, 0, 0, 0);

  const geometry = b.geometry();
  geometry.setAttribute("aLeg", new THREE.Float32BufferAttribute(tags.leg, 1));
  geometry.setAttribute("aHip", new THREE.Float32BufferAttribute(tags.hip, 1));
  geometry.setAttribute("aHead", new THREE.Float32BufferAttribute(tags.head, 1));
  geometry.computeBoundingSphere();
  return { geometry, pivot };
}

/**
 * The species' material: Lambert, flat, vertex-coloured, in the haze, with
 * the legs' swing and the head's graze grafted into its vertex shader.
 */
export function beastMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
  haze: HazeUniforms,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return hazeMaterial(material, haze, `beast:${spec.id}`, gaitGraft(spec, pivot));
}

/** The shadow's material: the same graft over three's depth pass, so the
 * shadow on the snow walks with the legs that cast it. */
export function beastDepthMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const graft = gaitGraft(spec, pivot);
  material.onBeforeCompile = (shader) => graft(shader);
  material.customProgramCacheKey = (): string => `beast-depth:${spec.id}`;
  return material;
}

/** The legs' swing and the head's graze, as a vertex-shader graft. */
function gaitGraft(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): (shader: { vertexShader: string }) => void {
  const num = (v: number): string => v.toFixed(4);
  return (shader) => {
    shader.vertexShader = `attribute float aLeg;
attribute float aHip;
attribute float aHead;
attribute float aGait;
attribute float aStride;
attribute float aGraze;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aLeg > 0.5) {
\t\tfloat ph = aGait + (aLeg - 1.0) * 6.2831853;
\t\tfloat swing = sin(ph) * aStride * ${num(LEG_SWING[spec.gait])};
\t\tfloat dy = transformed.y - aHip;
\t\tfloat lift = max(0.0, cos(ph)) * aStride * ${num(spec.height * 0.12)} * clamp(-dy / ${num(spec.height)}, 0.0, 1.0);
\t\ttransformed.y = aHip + dy * cos(swing) + lift;
\t\ttransformed.z += dy * sin(swing);
\t}
\tif (aHead > 0.5) {
\t\tfloat g = aGraze * ${num(GRAZE_ANGLE)};
\t\tfloat hy = transformed.y - ${num(pivot.y)};
\t\tfloat hz = transformed.z - ${num(pivot.z)};
\t\ttransformed.y = ${num(pivot.y)} + hy * cos(g) - hz * sin(g);
\t\ttransformed.z = ${num(pivot.z)} + hy * sin(g) + hz * cos(g);
\t}`,
    );
  };
}
