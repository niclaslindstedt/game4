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
// A BIRCH IN WINTER (the birch valley's, R21) is the opposite read: a pale
// trunk with dark bands on it and a bare crown of purple-brown twigs — no
// needles to hold the snow. It is built as fins of twigs sprayed up off the
// trunk, drawn from both faces, and it is a third shape only on a map that
// grows one. What colour the needles are and how much snow the boughs carry
// is the region's (`region-look.ts`); the boreal's row is the palette's.
//
// TENS OF THOUSANDS OF THEM, so they are instanced, and in two bands of
// distance: FULL (the whole tree) and FAR (a three-tier sketch of it at a
// quarter of the triangles). The trees are binned into 64 m cells once; when
// the lens moves, the cells in reach are tested against the view frustum
// and their trees are copied into the bands' instance buffers. Past the far
// band the terrain's own forest tint (`snow-glsl.ts`) carries the woods to
// the rim.
//
// THE SHADOWS ARE A THIRD SET, NOT A BAND. No band casts. Every tree whose
// shadow can land in the sun's circle (`shadow-box.ts`'s `castsInto`) is
// copied into a CASTER set drawn only into the shadow map — whatever band
// the picture draws it in, in front of the lens or behind it. So a wood's
// shadows are all there or fading out at the circle's rim together, and
// none of them is switched on by riding closer to its tree.

import * as THREE from "three";
import type { Level } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { ForestLook, TreeCasters } from "./settings-video.ts";
import { castsInto, shadowLength, type ShadowBox } from "./shadow-box.ts";
import { regionLookOf, type RegionLook } from "./region-look.ts";
import { regionOf } from "@engine";

/** Where the two bands end (the FOREST row's `full`, the DISTANCE row's
 * `far`, both m), the share of the far band's sketches that stand, and what
 * the trees cast (the FOREST row's shape, or none unless SHADOWS is ALL) — `settings-video.ts` says what each
 * stop buys. */
export type ForestOptions = Omit<ForestLook, "casters"> & {
  far: number;
  casters: TreeCasters | "none";
};

const CELL = 64;

const SNOW = new THREE.Color(0xeef4fb);
const SNOW_SHADE = new THREE.Color(0xc4d6ea);
const BARK = new THREE.Color(0x3a2c22);

/** What a region paints its trees with. */
type Paint = {
  needle: THREE.Color;
  needleDark: THREE.Color;
  bark: THREE.Color;
  twigs: THREE.Color;
};

function paintOf(look: RegionLook): Paint {
  return {
    needle: new THREE.Color(look.needle),
    needleDark: new THREE.Color(look.needleDark),
    bark: new THREE.Color(look.bark),
    twigs: new THREE.Color(look.twigs),
  };
}

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
function conifer(
  tiers: Tier[],
  sides: number,
  trunk: boolean,
  seed: number,
  paint: Paint,
): THREE.BufferGeometry {
  const NEEDLE = paint.needle;
  const NEEDLE_DARK = paint.needleDark;
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

/** The two conifers, their snow scaled by the region's `load`. */
function coniferShapes(load: number): { tiers: Tier[]; sides: number }[] {
  return [
    // A narrow spruce: many tiers, a spire.
    { tiers: tiersOf(8, 0.1, 0.45 * load, 1.1), sides: 9 },
    // A fir carrying more snow: fewer, broader tiers.
    { tiers: tiersOf(6, 0.08, 0.7 * load, 0.95), sides: 8 },
  ];
}

/**
 * A BIRCH, unit height and unit crown radius: a pale trunk banded dark up
 * to the crown, and `fins` sprays of twigs rising off it — each a thin
 * tapering quad pushed with both windings, so it reads from either side —
 * with snow lying along the tops of the lower ones.
 */
function birch(fins: number, seed: number, paint: Paint): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const snow = SNOW.clone().lerp(paint.twigs, 0.35);
  const dark = paint.bark.clone().multiplyScalar(0.25);
  const push = (p: [number, number, number], colour: THREE.Color, n: [number, number, number]) => {
    pos.push(p[0], p[1], p[2]);
    col.push(colour.r, colour.g, colour.b);
    nrm.push(n[0], n[1], n[2]);
  };
  // The trunk: six sides, in bands — the bark's white broken by the dark
  // marks a birch is known by.
  const r = 0.045;
  const bands = 7;
  for (let b = 0; b < bands; b++) {
    const y0 = (b / bands) * 0.82;
    const y1 = ((b + 1) / bands) * 0.82;
    const rr0 = r * (1 - 0.5 * (b / bands));
    const rr1 = r * (1 - 0.5 * ((b + 1) / bands));
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2;
      const tone = jitter(seed * 13 + b * 7 + i) < 0.28 ? dark : paint.bark;
      const n0: [number, number, number] = [Math.cos(a0), 0.1, Math.sin(a0)];
      const n1: [number, number, number] = [Math.cos(a1), 0.1, Math.sin(a1)];
      const p0: [number, number, number] = [Math.cos(a0) * rr0, y0, Math.sin(a0) * rr0];
      const p1: [number, number, number] = [Math.cos(a1) * rr0, y0, Math.sin(a1) * rr0];
      const q0: [number, number, number] = [Math.cos(a0) * rr1, y1, Math.sin(a0) * rr1];
      const q1: [number, number, number] = [Math.cos(a1) * rr1, y1, Math.sin(a1) * rr1];
      push(p0, tone, n0);
      push(q1, tone, n1);
      push(p1, tone, n1);
      push(p0, tone, n0);
      push(q0, tone, n0);
      push(q1, tone, n1);
    }
  }
  // The crown: sprays of twigs, lower ones wider and flatter, the top ones
  // steep — the teardrop a birch's crown makes against the sky.
  for (let i = 0; i < fins; i++) {
    const u = (i + 0.5) / fins;
    const a = i * 2.39996 + seed;
    const base = 0.3 + 0.5 * u + (jitter(seed * 5 + i) - 0.5) * 0.06;
    const reach =
      (0.3 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * (0.75 + 0.5 * jitter(i + seed));
    const rise = 0.22 + 0.22 * u;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const w = 0.022 + 0.02 * (1 - u);
    const sx = -dz * w;
    const sz = dx * w;
    const root: [number, number, number] = [dx * 0.03, base, dz * 0.03];
    const tipL: [number, number, number] = [dx * reach + sx, base + rise, dz * reach + sz];
    const tipR: [number, number, number] = [dx * reach - sx, base + rise * 0.9, dz * reach - sz];
    const top = u < 0.6 && jitter(seed + i * 3) < 0.6 ? snow : paint.twigs;
    const nUp: [number, number, number] = [dx * 0.5, 0.85, dz * 0.5];
    const nDown: [number, number, number] = [dx * 0.5, -0.2, dz * 0.5];
    push(root, paint.twigs, nUp);
    push(tipL, top, nUp);
    push(tipR, paint.twigs, nUp);
    push(root, paint.twigs, nDown);
    push(tipR, paint.twigs, nDown);
    push(tipL, paint.twigs, nDown);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

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

/** A sketch caster stands this much inside the full tree's crown, so the
 * full tree drawn over it is not shaded blotchy by its own stand-in. */
const SKETCH_INSET = 0.85;

/** How far the lens has to stand from a tree before it cannot be inside
 * it, m — past this, `atLens` is not asked. */
const LENS_REACH = 24;

export type Forest = {
  group: THREE.Group;
  /** Refill the bands for `camera`, and the casters for `shadow` (null:
   * nothing casts). */
  update(camera: THREE.PerspectiveCamera, shadow: ShadowBox | null): void;
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
    shapeOf[i] = t.kind === "birch" ? 2 : h < 0.62 ? 0 : 1;
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
  const region = regionLookOf(regionOf(level).id);
  const paint = paintOf(region);
  const detailed = coniferShapes(region.load).map((sh, k) =>
    conifer(sh.tiers, sh.sides, true, k + 1, paint),
  );
  const sketch = [
    conifer(tiersOf(3, 0.1, 0.45 * region.load, 1.05), 5, false, 3, paint),
    conifer(tiersOf(3, 0.08, 0.7 * region.load, 0.95), 5, false, 4, paint),
  ];
  // The birch is a third shape only where one grows.
  if (trees.some((t) => t.kind === "birch")) {
    detailed.push(birch(56, 5, paint));
    sketch.push(birch(16, 6, paint));
  }
  const shapes = detailed.length;
  const zeros = (): number[] => new Array<number>(shapes).fill(0);

  // Two shapes × two bands, and the casters.
  type Band = { meshes: THREE.InstancedMesh[]; fill: number[] };
  const makeBand = (geos: THREE.BufferGeometry[]): Band => {
    const meshes = geos.map((g) => {
      const im = new THREE.InstancedMesh(g, material, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = false;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      group.add(im);
      return im;
    });
    return { meshes, fill: zeros() };
  };
  const full = makeBand(detailed);
  const far = makeBand(sketch);
  // THE CASTERS are drawn into the shadow map and nowhere else. Three picks
  // its shadow pass off the MAIN camera's layers, so a layer cannot keep
  // them out of the picture; instead their own material puts every vertex
  // outside the clip volume — the picture's pass culls them before a pixel
  // is shaded — while the shadow pass draws them with three's own depth
  // material, which never runs this one.
  const casterMaterial = new THREE.ShaderMaterial({
    vertexShader: "void main() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }",
    fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
    side: material.side,
  });
  const insetSketch = sketch.map((g) => g.clone().scale(SKETCH_INSET, 1, SKETCH_INSET));
  const makeCasters = (geos: THREE.BufferGeometry[]): THREE.InstancedMesh[] =>
    geos.map((g) => {
      const im = new THREE.InstancedMesh(g, casterMaterial, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.receiveShadow = false;
      im.frustumCulled = false;
      im.count = 0;
      group.add(im);
      return im;
    });
  const casterSets = { full: makeCasters(detailed), sketch: makeCasters(insetSketch) };
  /** The tallest tree, for how far up-sun a caster can stand. */
  let tallest = 0;
  for (const t of trees) tallest = Math.max(tallest, t.height);
  let widest = 0;
  for (const t of trees) widest = Math.max(widest, t.crown);

  const frustum = new THREE.Frustum();
  const box = new THREE.Box3();
  const pv = new THREE.Matrix4();
  const look = new THREE.Vector3();
  const lastAt = new THREE.Vector3(Infinity, 0, 0);
  const lastLook = new THREE.Vector3();
  let lastFov = 0;
  /** Where the casters were last filled for. */
  const lastShadow: ShadowBox = { x: Infinity, y: 0, z: 0, reach: 0, sx: 0, sy: 0, sz: 0 };
  let castersOn = false;

  function place(band: Band, i: number) {
    const sh = shapeOf[i];
    const im = band.meshes[sh];
    const k = band.fill[sh]++;
    (im.instanceMatrix.array as Float32Array).set(matrices.subarray(i * 16, i * 16 + 16), k * 16);
    (im.instanceColor!.array as Float32Array).set(colours.subarray(i * 3, i * 3 + 3), k * 3);
  }

  /** Refill the casters: every tree whose shadow can reach the circle. */
  function fillCasters(shadow: ShadowBox | null) {
    const sets = [casterSets.full, casterSets.sketch];
    let n = zeros();
    const into =
      !shadow || options.casters === "none"
        ? null
        : options.casters === "full"
          ? casterSets.full
          : casterSets.sketch;
    if (shadow && into) {
      // The cells the circle, and the shadows reaching into it, can touch.
      const plan = Math.hypot(shadow.sx, shadow.sz);
      const tail = plan > 1e-6 ? shadowLength(shadow, tallest) : 0;
      const ux = plan > 1e-6 ? shadow.sx / plan : 0;
      const uz = plan > 1e-6 ? shadow.sz / plan : 0;
      const r = shadow.reach + widest;
      const x0 = Math.min(shadow.x, shadow.x + ux * tail) - r;
      const x1 = Math.max(shadow.x, shadow.x + ux * tail) + r;
      const z0 = Math.min(shadow.z, shadow.z + uz * tail) - r;
      const z1 = Math.max(shadow.z, shadow.z + uz * tail) + r;
      const cMin = Math.max(0, Math.floor(x0 / CELL));
      const cMax = Math.min(cols - 1, Math.floor(x1 / CELL));
      const rMin = Math.max(0, Math.floor(z0 / CELL));
      const rMax = Math.min(cols - 1, Math.floor(z1 / CELL));
      n = zeros();
      for (let row = rMin; row <= rMax; row++) {
        for (let c = cMin; c <= cMax; c++) {
          for (const i of bins[row * cols + c]) {
            const t = trees[i];
            if (!castsInto(shadow, t.x, t.z, t.height, t.crown)) continue;
            const sh = shapeOf[i];
            const k = n[sh]++;
            (into[sh].instanceMatrix.array as Float32Array).set(
              matrices.subarray(i * 16, i * 16 + 16),
              k * 16,
            );
          }
        }
      }
    }
    for (const set of sets) {
      set.forEach((im, k) => {
        const used = set === into ? n[k] : 0;
        im.count = used;
        if (used === 0) return;
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, used * 16);
        im.instanceMatrix.needsUpdate = true;
      });
    }
  }

  return {
    group,
    update(camera, shadow) {
      // The casters, when the circle has moved, turned with the sun or
      // changed size — a metre, or a few hundredths of a degree.
      if (
        (shadow !== null) !== castersOn ||
        (shadow &&
          ((shadow.x - lastShadow.x) ** 2 + (shadow.z - lastShadow.z) ** 2 > 1 ||
            shadow.sx * lastShadow.sx + shadow.sy * lastShadow.sy + shadow.sz * lastShadow.sz <
              0.99999 ||
            shadow.reach !== lastShadow.reach))
      ) {
        castersOn = shadow !== null;
        if (shadow) Object.assign(lastShadow, shadow);
        fillCasters(shadow);
      }
      // The bands, only when the lens has moved or turned enough to change
      // the answer.
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
      for (const b of [full, far]) b.fill = zeros();
      const reach = Math.ceil(options.far / CELL) + 1;
      const c0 = Math.floor(cx / CELL);
      const r0 = Math.floor(cz / CELL);
      const lens2 = LENS_REACH * LENS_REACH;
      const full2 = options.full * options.full;
      const far2 = options.far * options.far;
      for (let r = Math.max(0, r0 - reach); r <= Math.min(cols - 1, r0 + reach); r++) {
        for (let c = Math.max(0, c0 - reach); c <= Math.min(cols - 1, c0 + reach); c++) {
          const b = r * cols + c;
          if (bins[b].length === 0) continue;
          box.min.set(c * CELL - 8, binLow[b] - 2, r * CELL - 8);
          box.max.set((c + 1) * CELL + 8, binTop[b] + 2, (r + 1) * CELL + 8);
          const dx = Math.max(box.min.x - cx, 0, cx - box.max.x);
          const dz = Math.max(box.min.z - cz, 0, cz - box.max.z);
          if (dx * dx + dz * dz > far2) continue;
          if (!frustum.intersectsBox(box)) continue;
          for (const i of bins[b]) {
            const t = trees[i];
            const e2 = (t.x - cx) ** 2 + (t.z - cz) ** 2;
            // THE TREES AT THE LENS: a crown a metre or two off the lens is
            // not a tree but a wall of green across a third of the frame, so
            // it is taken out of the picture. Its caster stays, so the snow
            // under it does not light up as the lens goes by.
            if (e2 < lens2 && atLens(t, Math.sqrt(e2), cy)) continue;
            if (e2 < full2) place(full, i);
            else if (e2 < far2 && thin[i] < options.farShare) place(far, i);
          }
        }
      }
      for (const b of [full, far]) {
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
      lastShadow.x = Infinity;
    },
    setOptions(next) {
      options = { ...next };
      lastAt.set(Infinity, 0, 0);
      lastShadow.x = Infinity;
    },
    dispose() {
      for (const g of [...detailed, ...sketch, ...insetSketch]) g.dispose();
      material.dispose();
      casterMaterial.dispose();
    },
  };
}
