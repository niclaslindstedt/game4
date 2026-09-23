// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS — every trunk the generator stood (`Level.trees`, the ones a
// sled can hit), drawn as a snow-loaded conifer.
//
// A SPRUCE UNDER SNOW is a stack of drooping skirts, each one white on its
// upper face where the snow has settled and dark green under the lip where
// it has not — that two-tone banding, tier over tier, is what reads as a
// loaded tree at a glance, and it is built into the vertex colours rather
// than painted. Two shapes: a narrow spruce and a broader, heavier-laden
// fir; each tree is one of them, scaled to its own height and crown, turned
// and tinted by a hash of where it stands.
//
// TENS OF THOUSANDS OF THEM, so they are instanced, and in THREE bands of
// distance: NEAR (the full tree, casting into the shadow map), MID (the
// same tree, no shadow), FAR (a two-tier sketch of it at a tenth of the
// triangles). The trees are binned into 64 m cells once; each frame the
// cells in reach are tested against the view frustum and their trees are
// copied into the three bands' instance buffers. Past the far band the
// terrain's own forest tint (`snow-glsl.ts`) carries the woods to the rim.

import * as THREE from "three";
import type { Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { ForestLook } from "./settings-video.ts";

/** Where the three bands end (the FOREST row's `near` and `mid`, the
 * DISTANCE row's `far`, all m) and the share of the far band's sketches that
 * stand — `settings-video.ts` says what each stop buys. */
export type ForestOptions = ForestLook & { far: number };

const CELL = 64;

const SNOW = new THREE.Color(0xeef4fb);
const SNOW_SHADE = new THREE.Color(0xc4d6ea);
const NEEDLE = new THREE.Color(PALETTE.pine);
const NEEDLE_DARK = new THREE.Color(PALETTE.pineDark);
const BARK = new THREE.Color(0x3a2c22);

type Tier = { bottom: number; top: number; radius: number; snow: number };

/** A small deterministic hash for the geometry's own irregularity. */
function jitter(i: number): number {
  const s = Math.sin(i * 91.345 + 17.13) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * One tree's geometry, unit height (y 0..1) and unit crown radius. Each
 * tier is a skirt of `sides` jagged, drooping boughs: a cap of settled snow
 * over its upper part, green boughs with snow lying along their tops below
 * that, and a dark underside. The normals are not the facets' own but a
 * soft "volume" normal pointing out of the crown and up — foliage lit as a
 * mass rather than as a pile of flat plates.
 */
function conifer(tiers: Tier[], sides: number, trunk: boolean, seed: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const c = new THREE.Color();
  const push = (p: [number, number, number], colour: THREE.Color, up: number) => {
    pos.push(p[0], p[1], p[2]);
    col.push(colour.r, colour.g, colour.b);
    const r = Math.hypot(p[0], p[2]) || 1;
    const n = new THREE.Vector3((p[0] / r) * 0.65, up, (p[2] / r) * 0.65).normalize();
    nrm.push(n.x, n.y, n.z);
  };
  if (trunk) {
    const r = 0.035;
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * Math.PI * 2;
      const a1 = ((i + 1) / 5) * Math.PI * 2;
      const p0: [number, number, number] = [Math.cos(a0) * r, 0, Math.sin(a0) * r];
      const p1: [number, number, number] = [Math.cos(a1) * r, 0, Math.sin(a1) * r];
      const q0: [number, number, number] = [p0[0], 0.25, p0[2]];
      const q1: [number, number, number] = [p1[0], 0.25, p1[2]];
      for (const v of [p0, q1, p1, p0, q0, q1]) push(v, BARK, 0);
    }
  }
  tiers.forEach((t, ti) => {
    const twist = ti * 0.9 + seed;
    const rim: [number, number, number][] = [];
    const mid: [number, number, number][] = [];
    const snowy: boolean[] = [];
    for (let i = 0; i < sides; i++) {
      const k = seed * 31 + ti * 17 + i;
      const a = ((i + (jitter(k) - 0.5) * 0.5) / sides) * Math.PI * 2 + twist;
      const jag = i % 2 === 0 ? 1 : 0.7 + jitter(k + 3) * 0.12;
      const r = t.radius * jag * (0.9 + jitter(k + 5) * 0.2);
      const droop = (t.top - t.bottom) * (0.12 + 0.1 * jitter(k + 7)) * jag;
      rim.push([Math.cos(a) * r, t.bottom - droop, Math.sin(a) * r]);
      const mr = r * 0.55;
      mid.push([Math.cos(a) * mr, t.bottom + (t.top - t.bottom) * 0.5, Math.sin(a) * mr]);
      snowy.push(jitter(k + 11) < t.snow);
    }
    const apex: [number, number, number] = [0, t.top, 0];
    const under: [number, number, number] = [0, t.bottom + (t.top - t.bottom) * 0.15, 0];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // The cap of settled snow.
      const capTone = c
        .copy(SNOW)
        .lerp(SNOW_SHADE, jitter(i + ti * 5) * 0.35)
        .clone();
      push(apex, SNOW, 1);
      push(mid[j], capTone, 0.9);
      push(mid[i], capTone, 0.9);
      // The boughs: green, with snow lying along the tops of some of them.
      const boughI = snowy[i] ? c.copy(SNOW).lerp(NEEDLE, 0.25).clone() : NEEDLE;
      const boughJ = snowy[j] ? c.copy(SNOW).lerp(NEEDLE, 0.25).clone() : NEEDLE;
      const tipI = i % 2 === 0 ? NEEDLE : NEEDLE_DARK;
      const tipJ = j % 2 === 0 ? NEEDLE : NEEDLE_DARK;
      push(mid[i], boughI, 0.6);
      push(mid[j], boughJ, 0.6);
      push(rim[j], tipJ, 0.25);
      push(mid[i], boughI, 0.6);
      push(rim[j], tipJ, 0.25);
      push(rim[i], tipI, 0.25);
      // The underside, in its own shade.
      push(under, NEEDLE_DARK, -0.3);
      push(rim[i], NEEDLE_DARK, -0.1);
      push(rim[j], NEEDLE_DARK, -0.1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

function tiersOf(count: number, base: number, snow: number, taper: number): Tier[] {
  const out: Tier[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const bottom = base + (1 - base) * u * 0.92;
    const top = Math.min(1, bottom + (1 - base) * (1.9 / count));
    out.push({ bottom, top, radius: Math.pow(1 - u * 0.95, taper) * (1 - 0.08 * u), snow });
  }
  return out;
}

const SHAPES = [
  // A narrow spruce: many tiers, a spire.
  { tiers: tiersOf(8, 0.1, 0.45, 1.1), sides: 9 },
  // A fir carrying more snow: fewer, broader tiers.
  { tiers: tiersOf(6, 0.08, 0.7, 0.95), sides: 8 },
];

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** How close the lens may come to a drawn crown before the tree is taken
 * out of the picture, m. */
export const LENS_CLEAR = 2.4;

/** Whether the lens, `d` m from the trunk in plan at height `y`, is within
 * `LENS_CLEAR` of the tree as drawn — a cone of boughs from a tenth of its
 * height to its tip. */
function atLens(t: Level["trees"][number], d: number, y: number): boolean {
  const f = (y - t.y) / t.height;
  if (f > 1.05) return false;
  const crown = f < 0.08 ? t.radius : t.crown * 0.95 * Math.max(0, 1 - (f - 0.08) / 0.92);
  return d - Math.max(t.radius, crown) < LENS_CLEAR;
}

export type Forest = {
  group: THREE.Group;
  update(camera: THREE.PerspectiveCamera): void;
  /** Force the next update to recompute (a new frame of reference). */
  invalidate(): void;
  /** New bands (a picture row moved); takes effect on the next update. */
  setOptions(next: ForestOptions): void;
  dispose(): void;
};

export function createForest(level: Level, haze: HazeUniforms, initial: ForestOptions): Forest {
  let options = { ...initial };
  const group = new THREE.Group();
  const trees = level.trees;
  const count = trees.length;
  // Every tree's matrix and shape, once.
  const matrices = new Float32Array(count * 16);
  const colours = new Float32Array(count * 3);
  const shapeOf = new Uint8Array(count);
  /** Each tree's place in the far band's thinning: a sketch stands while
   * this is under `farShare`, so a thinner wood is a subset of a thicker
   * one and walking the row never swaps one tree for another. */
  const thin = new Float32Array(count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = trees[i];
    const h = hash(t.x, t.z);
    shapeOf[i] = h < 0.62 ? 0 : 1;
    thin[i] = hash(t.x * 1.7 + 11, t.z * 0.6 - 5);
    q.setFromAxisAngle(up, h * Math.PI * 2);
    // The crown the generator gives is the collision's idea of it; drawn a
    // touch narrower so a wood keeps gaps between its trees.
    s.set(t.crown * 0.95, t.height, t.crown * 0.95);
    // Sunk a little, so a tree on a slope stands in the snow.
    p.set(t.x, t.y - 0.3, t.z);
    m.compose(p, q, s).toArray(matrices, i * 16);
    const tone = 0.9 + hash(t.z, t.x) * 0.2;
    colours[i * 3] = tone;
    colours[i * 3 + 1] = tone;
    colours[i * 3 + 2] = tone;
  }
  // Binned by cell.
  const cols = Math.ceil(level.size / CELL);
  const bins: number[][] = Array.from({ length: cols * cols }, () => []);
  for (let i = 0; i < count; i++) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(trees[i].x / CELL)));
    const r = Math.min(cols - 1, Math.max(0, Math.floor(trees[i].z / CELL)));
    bins[r * cols + c].push(i);
  }
  const binTop = new Float32Array(cols * cols).fill(-Infinity);
  const binLow = new Float32Array(cols * cols).fill(Infinity);
  for (let b = 0; b < bins.length; b++) {
    for (const i of bins[b]) {
      binTop[b] = Math.max(binTop[b], trees[i].y + trees[i].height);
      binLow[b] = Math.min(binLow[b], trees[i].y);
    }
  }

  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    "tree",
  );
  const detailed = SHAPES.map((sh, k) => conifer(sh.tiers, sh.sides, true, k + 1));
  const sketch = [
    conifer(tiersOf(3, 0.1, 0.45, 1.05), 5, false, 3),
    conifer(tiersOf(3, 0.08, 0.7, 0.95), 5, false, 4),
  ];

  // Six instanced meshes: two shapes × three bands.
  type Band = { meshes: THREE.InstancedMesh[]; fill: number[] };
  const makeBand = (geos: THREE.BufferGeometry[], cast: boolean): Band => {
    const meshes = geos.map((g) => {
      const im = new THREE.InstancedMesh(g, material, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = cast;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      group.add(im);
      return im;
    });
    return { meshes, fill: [0, 0] };
  };
  const near = makeBand(detailed, true);
  const mid = makeBand(detailed, false);
  const far = makeBand(sketch, false);
  // THE TREES AT THE LENS: a crown a metre or two off the lens is not a tree
  // but a wall of green across a third of the frame, so a tree the lens
  // stands that close to is taken out of the picture — and kept in the
  // shadow map, through a band whose material writes nothing, so the snow
  // under it does not light up as the lens goes by.
  const ghostMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ghost = makeBand(detailed, true);
  for (const im of ghost.meshes) {
    im.material = ghostMaterial;
    im.receiveShadow = false;
  }

  const frustum = new THREE.Frustum();
  const box = new THREE.Box3();
  const pv = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const lastAt = new THREE.Vector3(Infinity, 0, 0);
  const lastLook = new THREE.Vector3();
  let lastFov = 0;

  function place(band: Band, i: number) {
    const sh = shapeOf[i];
    const im = band.meshes[sh];
    const k = band.fill[sh]++;
    (im.instanceMatrix.array as Float32Array).set(matrices.subarray(i * 16, i * 16 + 16), k * 16);
    (im.instanceColor!.array as Float32Array).set(colours.subarray(i * 3, i * 3 + 3), k * 3);
  }

  return {
    group,
    update(camera) {
      // Only when the lens has moved or turned enough to change the answer.
      camera.getWorldDirection(look);
      if (
        camera.position.distanceToSquared(lastAt) < 0.5 &&
        look.dot(lastLook) > 0.9998 &&
        camera.fov === lastFov
      ) {
        return;
      }
      lastAt.copy(camera.position);
      lastLook.copy(look);
      lastFov = camera.fov;
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      for (const b of [near, mid, far, ghost]) b.fill = [0, 0];
      const reach = Math.ceil(options.far / CELL) + 1;
      const c0 = Math.floor(cx / CELL);
      const r0 = Math.floor(cz / CELL);
      const near2 = options.near * options.near;
      const mid2 = options.mid * options.mid;
      const far2 = options.far * options.far;
      for (let r = Math.max(0, r0 - reach); r <= Math.min(cols - 1, r0 + reach); r++) {
        for (let c = Math.max(0, c0 - reach); c <= Math.min(cols - 1, c0 + reach); c++) {
          const b = r * cols + c;
          if (bins[b].length === 0) continue;
          box.min.set(c * CELL - 8, binLow[b] - 2, r * CELL - 8);
          box.max.set((c + 1) * CELL + 8, binTop[b] + 2, (r + 1) * CELL + 8);
          // The near band always draws (shadows come from behind the lens).
          const dx = Math.max(box.min.x - cx, 0, cx - box.max.x);
          const dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
          const d2 = dx * dx + dz * dz;
          if (d2 > far2) continue;
          const seen = frustum.intersectsBox(box);
          if (!seen && d2 > near2) continue;
          for (const i of bins[b]) {
            const t = trees[i];
            const e2 = (t.x - cx) ** 2 + (t.z - cz) ** 2;
            if (e2 < near2) place(atLens(t, Math.sqrt(e2), cy) ? ghost : near, i);
            else if (!seen) continue;
            else if (e2 < mid2) place(mid, i);
            else if (e2 < far2 && thin[i] < options.farShare) place(far, i);
          }
        }
      }
      for (const b of [near, mid, far, ghost]) {
        b.meshes.forEach((im, k) => {
          const n = b.fill[k];
          im.count = n;
          // Upload only what is used: a whole band's buffer is megabytes.
          im.instanceMatrix.clearUpdateRanges();
          im.instanceMatrix.addUpdateRange(0, Math.max(1, n) * 16);
          im.instanceMatrix.needsUpdate = true;
          im.instanceColor!.clearUpdateRanges();
          im.instanceColor!.addUpdateRange(0, Math.max(1, n) * 3);
          im.instanceColor!.needsUpdate = true;
        });
      }
    },
    invalidate() {
      lastAt.set(Infinity, 0, 0);
    },
    setOptions(next) {
      options = { ...next };
      lastAt.set(Infinity, 0, 0);
    },
    dispose() {
      for (const g of [...detailed, ...sketch]) g.dispose();
      material.dispose();
      ghostMaterial.dispose();
    },
  };
}
