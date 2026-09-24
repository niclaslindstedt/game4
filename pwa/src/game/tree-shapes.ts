// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, BUILT — one mesh a variant (`tree-variants.ts`), unit height
// (y 0..1) and unit crown radius, vertex-coloured, for `forest.ts` to
// instance and scale to each tree's own height and crown.
//
// A LOADED CONIFER is its banding: a stack of drooping skirts, each white on
// its upper face where the snow has settled and dark green under the lip
// where it has not — tier over tier, built into the vertex colours. The
// normals are a soft "volume" normal out of the crown and up, so foliage is
// lit as a mass rather than as a pile of plates. A PINE is the opposite
// read: a bare trunk (grey-brown low, orange where the bark thins up the
// stem) under separate flat pads of needles, each with its own cap of snow.
// A LARCH in winter and a BIRCH are bare: fins of twigs drawn from both
// faces, so they read from either side — a lattice the wood behind shows
// through. What colour the needles are and how much snow the boughs carry
// is the region's (`region-look.ts`); the kinds shade it their own way here.
//
// Each shape has a SKETCH beside it for the far band: the same tree at a
// fraction of the triangles.

import * as THREE from "three";

import type { TreeKind } from "@engine";

import type { RegionLook } from "./region-look.ts";
import type { BirchForm, ConiferForm, LarchForm, PineForm, TreeVariant } from "./tree-variants.ts";

const SNOW = new THREE.Color(0xeef4fb);
const SNOW_SHADE = new THREE.Color(0xc4d6ea);
const BARK = new THREE.Color(0x3a2c22);

/** What a region's trees are painted with, per kind. */
export type TreePaint = {
  readonly needle: THREE.Color;
  readonly needleDark: THREE.Color;
  /** A fir's needles: darker and bluer than a spruce's. */
  readonly firNeedle: THREE.Color;
  readonly firDark: THREE.Color;
  /** A pine's: lighter, greyer, a touch yellow. */
  readonly pineNeedle: THREE.Color;
  readonly pineDark: THREE.Color;
  /** A pine's bark low on the stem, and up where it thins to orange. */
  readonly pineBark: THREE.Color;
  readonly pineUpper: THREE.Color;
  /** A larch's bare twigs, and its bark. */
  readonly larch: THREE.Color;
  readonly larchBark: THREE.Color;
  /** A birch's bark and its bare crown. */
  readonly bark: THREE.Color;
  readonly twigs: THREE.Color;
  /** How much snow the boughs carry, 0..1 of a shape's own. */
  readonly load: number;
};

export function treePaint(look: RegionLook): TreePaint {
  const needle = new THREE.Color(look.needle);
  const needleDark = new THREE.Color(look.needleDark);
  return {
    needle,
    needleDark,
    firNeedle: needle.clone().lerp(new THREE.Color(0x173532), 0.4),
    firDark: needleDark.clone().lerp(new THREE.Color(0x0c1e1e), 0.4),
    pineNeedle: needle.clone().lerp(new THREE.Color(0x5b7246), 0.45),
    pineDark: needleDark.clone().lerp(new THREE.Color(0x2c3a22), 0.4),
    pineBark: new THREE.Color(0x5a4838),
    pineUpper: new THREE.Color(0x9a5a38),
    larch: new THREE.Color(0x857462),
    larchBark: new THREE.Color(0x5c4a3e),
    bark: new THREE.Color(look.bark),
    twigs: new THREE.Color(look.twigs),
    load: look.load,
  };
}

type V3 = [number, number, number];

/** A small deterministic hash for a shape's own irregularity. */
function jitter(i: number): number {
  const s = Math.sin(i * 91.345 + 17.13) * 43758.5453;
  return s - Math.floor(s);
}

/** A mesh under construction: positions, colours, normals, with the
 * variant's LEAN applied to every point (x pushed over by the height — a
 * unit of x is a crown radius and a unit of y a height, about four times
 * as long, hence the factor). */
class Shape {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly nrm: number[] = [];
  constructor(private readonly lean: number) {}
  push(p: V3, c: THREE.Color, n: V3): void {
    this.pos.push(p[0] + p[1] * this.lean * 4, p[1], p[2]);
    this.col.push(c.r, c.g, c.b);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.nrm.push(n[0] / l, n[1] / l, n[2] / l);
  }
  /** A tapering tube of `sides` from `a` to `b`, radii `ra` and `rb`, its
   * colour `ca` at the foot going to `cb` at the head. */
  tube(a: V3, b: V3, ra: number, rb: number, sides: number, ca: THREE.Color, cb = ca): void {
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const w = [ax[0] / len, ax[1] / len, ax[2] / len];
    // Any vector across the axis, then the second by the cross product.
    const u0 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = [
      w[1] * u0[2] - w[2] * u0[1],
      w[2] * u0[0] - w[0] * u0[2],
      w[0] * u0[1] - w[1] * u0[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]);
    u[0] /= ul;
    u[1] /= ul;
    u[2] /= ul;
    const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const ring = (c: V3, r: number, k: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      const cs = Math.cos(t);
      const sn = Math.sin(t);
      return [
        c[0] + (u[0] * cs + v[0] * sn) * r,
        c[1] + (u[1] * cs + v[1] * sn) * r,
        c[2] + (u[2] * cs + v[2] * sn) * r,
      ];
    };
    const out = (k: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      return [
        u[0] * Math.cos(t) + v[0] * Math.sin(t),
        u[1] * Math.cos(t) + v[1] * Math.sin(t) + 0.1,
        u[2] * Math.cos(t) + v[2] * Math.sin(t),
      ];
    };
    for (let k = 0; k < sides; k++) {
      const p0 = ring(a, ra, k);
      const p1 = ring(a, ra, k + 1);
      const q0 = ring(b, rb, k);
      const q1 = ring(b, rb, k + 1);
      this.push(p0, ca, out(k));
      this.push(q1, cb, out(k + 1));
      this.push(p1, ca, out(k + 1));
      this.push(p0, ca, out(k));
      this.push(q0, cb, out(k));
      this.push(q1, cb, out(k + 1));
    }
  }
  /** A thin FIN from `root` to `tip`, `w` wide at the root and `fan` of
   * that at the tip (under one a blade, over one a spray of twigs fanning
   * out), pushed with both windings so it reads from either side; the tip
   * end takes `tipC`. */
  fin(
    root: V3,
    tip: V3,
    w: number,
    rootC: THREE.Color,
    tipC: THREE.Color,
    topC: THREE.Color,
    fan = 0.3,
  ): void {
    const dx = tip[0] - root[0];
    const dz = tip[2] - root[2];
    const l = Math.hypot(dx, dz) || 1;
    const sx = (-dz / l) * w;
    const sz = (dx / l) * w;
    const tipL: V3 = [tip[0] + sx * fan, tip[1], tip[2] + sz * fan];
    const tipR: V3 = [tip[0] - sx * fan, tip[1] - 0.004, tip[2] - sz * fan];
    const rootL: V3 = [root[0] + sx, root[1], root[2] + sz];
    const rootR: V3 = [root[0] - sx, root[1], root[2] - sz];
    const nUp: V3 = [(dx / l) * 0.5, 0.85, (dz / l) * 0.5];
    const nDown: V3 = [(dx / l) * 0.5, -0.2, (dz / l) * 0.5];
    this.push(rootL, rootC, nUp);
    this.push(tipL, topC, nUp);
    this.push(tipR, tipC, nUp);
    this.push(rootL, rootC, nUp);
    this.push(tipR, tipC, nUp);
    this.push(rootR, rootC, nUp);
    this.push(rootL, rootC, nDown);
    this.push(tipR, tipC, nDown);
    this.push(tipL, tipC, nDown);
    this.push(rootL, rootC, nDown);
    this.push(rootR, rootC, nDown);
    this.push(tipR, tipC, nDown);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.computeBoundingSphere();
    return g;
  }
}

type Tier = { bottom: number; top: number; radius: number };

/** The tiers from `base` to `top`, narrowing by `taper`. */
function tiersOf(count: number, base: number, top: number, taper: number): Tier[] {
  const out: Tier[] = [];
  const span = top - base;
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const bottom = base + span * u * 0.92;
    out.push({
      bottom,
      top: Math.min(top, bottom + span * (1.9 / count)),
      radius: Math.pow(1 - u * 0.95, taper) * (1 - 0.08 * u),
    });
  }
  return out;
}

/** A spruce or a fir: a stack of drooping skirts. */
function conifer(
  v: TreeVariant,
  form: ConiferForm,
  paint: TreePaint,
  sketch: boolean,
  seed: number,
) {
  const s = new Shape(v.lean);
  const fir = v.kind === "fir";
  const needle = fir ? paint.firNeedle : paint.needle;
  const dark = fir ? paint.firDark : paint.needleDark;
  const snow = form.snow * paint.load;
  const c = new THREE.Color();
  // The trunk, up into the lowest skirt — longer under a stand tree's
  // lifted crown, where it is the whole of what a rider sees.
  const trunkTop = Math.max(0.25, v.base + 0.15);
  s.tube([0, 0, 0], [0, trunkTop, 0], 0.035, 0.022, sketch ? 3 : 5, BARK);
  const count = sketch ? 3 : form.tiers;
  const tiers = tiersOf(count, v.base, v.top, sketch ? form.taper : v.taper).map((t, i) => {
    // The lowest skirt spread across the snow (a krummholz), and a flat top
    // (the old fir's stork's nest) — both off the shape's own numbers.
    const u = i / count;
    let radius = t.radius * v.width;
    if (i === 0) radius *= 1 + form.skirt;
    if (form.flat > 0 && u > 0.55) radius = Math.max(radius, form.flat * 0.55 * v.width);
    return { ...t, radius };
  });
  const sides = sketch ? 5 : form.sides;
  tiers.forEach((t, ti) => {
    if (!sketch && form.missing.includes(ti)) return;
    const twist = ti * 0.9 + seed;
    const rim: V3[] = [];
    const mid: V3[] = [];
    const snowy: boolean[] = [];
    for (let i = 0; i < sides; i++) {
      const k = seed * 31 + ti * 17 + i;
      const a = ((i + (jitter(k) - 0.5) * 0.5) / sides) * Math.PI * 2 + twist;
      const jag = i % 2 === 0 ? 1 : 0.7 + jitter(k + 3) * 0.12;
      // A flagged tree's boughs grow on its lee (+x) side.
      const lee = 1 + form.flag * Math.cos(a) * 0.9 - form.flag * 0.25;
      const r = t.radius * jag * (0.9 + jitter(k + 5) * 0.2) * Math.max(0.15, lee);
      const droop = (t.top - t.bottom) * (0.12 + 0.1 * jitter(k + 7)) * jag * form.droop;
      rim.push([Math.cos(a) * r, t.bottom - droop, Math.sin(a) * r]);
      const mr = r * 0.55;
      mid.push([Math.cos(a) * mr, t.bottom + (t.top - t.bottom) * 0.5, Math.sin(a) * mr]);
      snowy.push(jitter(k + 11) < snow);
    }
    const apex: V3 = [0, t.top, 0];
    const under: V3 = [0, t.bottom + (t.top - t.bottom) * 0.15, 0];
    const vol = (p: V3, up: number): V3 => {
      const r = Math.hypot(p[0], p[2]) || 1;
      return [(p[0] / r) * 0.65, up, (p[2] / r) * 0.65];
    };
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // The cap of settled snow.
      const capTone = c
        .copy(SNOW)
        .lerp(SNOW_SHADE, jitter(i + ti * 5) * 0.35)
        .clone();
      s.push(apex, SNOW, vol(apex, 1));
      s.push(mid[j], capTone, vol(mid[j], 0.9));
      s.push(mid[i], capTone, vol(mid[i], 0.9));
      // The boughs: green, with snow lying along the tops of some of them.
      const boughI = snowy[i] ? c.copy(SNOW).lerp(needle, 0.25).clone() : needle;
      const boughJ = snowy[j] ? c.copy(SNOW).lerp(needle, 0.25).clone() : needle;
      const tipI = i % 2 === 0 ? needle : dark;
      const tipJ = j % 2 === 0 ? needle : dark;
      s.push(mid[i], boughI, vol(mid[i], 0.6));
      s.push(mid[j], boughJ, vol(mid[j], 0.6));
      s.push(rim[j], tipJ, vol(rim[j], 0.25));
      s.push(mid[i], boughI, vol(mid[i], 0.6));
      s.push(rim[j], tipJ, vol(rim[j], 0.25));
      s.push(rim[i], tipI, vol(rim[i], 0.25));
      // The underside, in its own shade.
      s.push(under, dark, vol(under, -0.3));
      s.push(rim[i], dark, vol(rim[i], -0.1));
      s.push(rim[j], dark, vol(rim[j], -0.1));
    }
  });
  if (!sketch && form.twin) {
    // A second leader off the top whorl, a little lower and to one side.
    const from = v.base + (v.top - v.base) * 0.72;
    for (const t of tiersOf(3, from, v.top * 0.95, 1.2)) {
      const off = 0.2;
      const r = t.radius * 0.35 * v.width;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + seed;
        const b = ((i + 1) / 6) * Math.PI * 2 + seed;
        const p0: V3 = [off + Math.cos(a) * r, t.bottom, Math.sin(a) * r];
        const p1: V3 = [off + Math.cos(b) * r, t.bottom, Math.sin(b) * r];
        const apex: V3 = [off, t.top, 0];
        s.push(apex, SNOW, [0, 1, 0]);
        s.push(p1, needle, [Math.cos(b), 0.4, Math.sin(b)]);
        s.push(p0, i % 2 ? dark : needle, [Math.cos(a), 0.4, Math.sin(a)]);
      }
    }
  }
  if (!sketch && form.spire > 0) {
    // The dead spire a broken top leaves: bare wood over the last whorl.
    s.tube(
      [0, v.top - 0.04, 0],
      [0.01, v.top + form.spire, 0],
      0.018,
      0.004,
      4,
      BARK,
      paint.larchBark,
    );
  }
  return s.geometry();
}

/** A pine: a bare trunk under flat pads of needles. */
function pine(v: TreeVariant, form: PineForm, paint: TreePaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snow = form.snow * paint.load;
  const kinkX = (y: number): number =>
    form.kink > 0 && y > form.kink ? Math.min(1, (y - form.kink) / 0.12) * form.kinkBy : 0;
  // The stem: grey-brown low, orange up where the bark thins; bent at a
  // kink if it has one.
  const stops = sketch ? [0, 0.5, 0.95] : [0, 0.3, 0.55, form.kink || 0.75, 0.95];
  stops.sort((a, b) => a - b);
  for (let i = 0; i + 1 < stops.length; i++) {
    const y0 = stops[i];
    const y1 = stops[i + 1];
    const c0 = paint.pineBark
      .clone()
      .lerp(paint.pineUpper, Math.min(1, Math.max(0, (y0 - 0.35) / 0.3)));
    const c1 = paint.pineBark
      .clone()
      .lerp(paint.pineUpper, Math.min(1, Math.max(0, (y1 - 0.35) / 0.3)));
    s.tube(
      [kinkX(y0), y0, 0],
      [kinkX(y1), y1, 0],
      0.07 * (1 - y0 * 0.7),
      0.07 * (1 - y1 * 0.7),
      sketch ? 3 : 6,
      c0,
      c1,
    );
  }
  // The pads, from the crown's base to its top: spread out off the stem on
  // an old pine, a cone of whorls on a young one.
  const pads = sketch ? Math.min(3, form.pads) : form.pads;
  for (let i = 0; i < pads; i++) {
    const u = pads === 1 ? 0.5 : i / (pads - 1);
    const k = seed * 13 + i * 7;
    const y = v.base + (v.top - v.base - form.thick) * (0.08 + 0.92 * u);
    const a = i * 2.39996 + seed;
    const topPad = i === pads - 1;
    const reach = topPad
      ? 0.05
      : form.spread * v.width * (0.35 + 0.65 * jitter(k)) * (1 - form.young * u * 0.8);
    const cx = kinkX(y) + Math.cos(a) * reach;
    const cz = Math.sin(a) * reach;
    const pr = (0.4 + 0.22 * jitter(k + 1)) * v.width * (1 - form.young * (u * 0.7 - 0.25));
    // A branch from the stem to the pad.
    if (!topPad && !sketch) {
      s.tube(
        [kinkX(y), y - form.thick * 0.6, 0],
        [cx, y, cz],
        0.016,
        0.01,
        3,
        paint.pineBark,
        paint.pineUpper,
      );
    }
    const sides = sketch ? 5 : 8;
    const rim: V3[] = [];
    const inner: V3[] = [];
    for (let j = 0; j < sides; j++) {
      const t = (j / sides) * Math.PI * 2 + jitter(k + j) * 0.4;
      const r = pr * (0.75 + 0.35 * jitter(k + j + 3));
      rim.push([
        cx + Math.cos(t) * r,
        y + form.thick * 0.25 * jitter(k + j + 5),
        cz + Math.sin(t) * r,
      ]);
      inner.push([cx + Math.cos(t) * r * 0.45, y + form.thick * 0.9, cz + Math.sin(t) * r * 0.45]);
    }
    const crown: V3 = [cx, y + form.thick, cz];
    const belly: V3 = [cx, y - form.thick * 0.35, cz];
    const snowy = jitter(k + 9) < snow;
    for (let j = 0; j < sides; j++) {
      const q = (j + 1) % sides;
      const out = (p: V3, up: number): V3 => [p[0] - cx, up, p[2] - cz];
      // The cap of snow on top, the green showing round its edge.
      const cap = snowy
        ? SNOW.clone().lerp(paint.pineNeedle, 0.12)
        : SNOW.clone().lerp(paint.pineNeedle, 0.6);
      s.push(crown, cap, [0, 1, 0]);
      s.push(inner[q], cap, out(inner[q], 1.2));
      s.push(inner[j], cap, out(inner[j], 1.2));
      const edge = j % 2 ? paint.pineNeedle : paint.pineDark;
      s.push(inner[j], cap, out(inner[j], 0.8));
      s.push(inner[q], cap, out(inner[q], 0.8));
      s.push(rim[q], edge, out(rim[q], 0.2));
      s.push(inner[j], cap, out(inner[j], 0.8));
      s.push(rim[q], edge, out(rim[q], 0.2));
      s.push(rim[j], edge, out(rim[j], 0.2));
      // The dark underside.
      s.push(belly, paint.pineDark, [0, -1, 0]);
      s.push(rim[j], paint.pineDark, out(rim[j], -0.4));
      s.push(rim[q], paint.pineDark, out(rim[q], -0.4));
    }
  }
  return s.geometry();
}

/** A larch in winter: a skeleton of drooping whorls. */
function larch(v: TreeVariant, form: LarchForm, paint: TreePaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snowTint = SNOW.clone().lerp(paint.larch, 0.3);
  s.tube([0, 0, 0], [0, v.top, 0], 0.04, 0.004, sketch ? 3 : 5, paint.larchBark, paint.larch);
  const whorls = sketch ? 4 : form.whorls;
  const arms = sketch ? 4 : form.arms;
  for (let w = 0; w < whorls; w++) {
    const u = (w + 0.5) / whorls;
    const y = v.base + (v.top - v.base) * u * 0.95;
    const r = v.width * Math.pow(Math.max(0.05, 1 - u * 0.95), v.taper);
    for (let a = 0; a < arms; a++) {
      const k = seed * 17 + w * 11 + a;
      const t = (a / arms) * Math.PI * 2 + w * 1.3 + jitter(k) * 0.5 + seed;
      const reach = r * (0.8 + 0.3 * jitter(k + 1));
      const tipY = y - form.droop * 0.06 - reach * 0.02 + (1 - form.droop) * 0.03;
      const root: V3 = [Math.cos(t) * 0.02, y, Math.sin(t) * 0.02];
      const tip: V3 = [Math.cos(t) * reach, tipY, Math.sin(t) * reach];
      const top = u < 0.7 && jitter(k + 3) < form.snow * paint.load ? snowTint : paint.larch;
      s.fin(root, tip, 0.07 + 0.06 * (1 - u), paint.larchBark, paint.larch, top);
      if (!sketch) {
        // Hanging sprays off the arm, the larch's weeping twigs — a haze
        // of them, which is what a larch in winter is from any distance.
        for (const at of [0.45, 0.8]) {
          const mid: V3 = [tip[0] * at, y + (tipY - y) * at, tip[2] * at];
          const side = jitter(k + at * 10) - 0.5;
          const hang: V3 = [
            mid[0] - mid[2] * side * 0.8,
            mid[1] - 0.03 - form.droop * 0.05,
            mid[2] + mid[0] * side * 0.8,
          ];
          s.fin(mid, hang, 0.02, paint.larch, paint.larch, top, 2.5);
        }
      }
    }
  }
  return s.geometry();
}

/** A birch in winter: pale banded stems under a bare crown of twigs. */
function birch(v: TreeVariant, form: BirchForm, paint: TreePaint, sketch: boolean, seed: number) {
  const s = new Shape(v.lean);
  const snow = SNOW.clone().lerp(paint.twigs, 0.35);
  const dark = paint.bark.clone().multiplyScalar(0.25);
  const stems = sketch ? Math.min(2, form.stems) : form.stems;
  const fins = sketch ? 16 : form.fins;
  for (let st = 0; st < stems; st++) {
    // Each stem splays off the root; the first stands straightest.
    const sa = st * 2.4 + seed;
    const tilt = stems === 1 ? 0 : form.splay * (st === 0 ? 0.4 : 1);
    const dx = Math.sin(tilt) * Math.cos(sa) * 4;
    const dz = Math.sin(tilt) * Math.sin(sa) * 4;
    const along = (y: number): V3 => [dx * y * 0.25, y, dz * y * 0.25];
    const height = st === 0 ? 1 : 0.8 + 0.15 * jitter(seed + st);
    // The trunk, in bands — the bark's white broken by the dark marks a
    // birch is known by.
    const bands = sketch ? 2 : 7;
    const r = 0.045 * (st === 0 ? 1 : 0.8);
    for (let b = 0; b < bands; b++) {
      const y0 = (b / bands) * 0.82 * height;
      const y1 = ((b + 1) / bands) * 0.82 * height;
      const tone = jitter(seed * 13 + b * 7 + st) < 0.28 ? dark : paint.bark;
      s.tube(
        along(y0),
        along(y1),
        r * (1 - 0.5 * (b / bands)),
        r * (1 - 0.5 * ((b + 1) / bands)),
        sketch ? 3 : 6,
        tone,
      );
    }
    // The crown: sprays of twigs, lower ones wider and flatter, the top
    // ones steep — the teardrop a birch's crown makes against the sky, or
    // hanging, on a weeping one.
    const own = Math.round(fins / stems);
    for (let i = 0; i < own; i++) {
      const u = (i + 0.5) / own;
      const a = i * 2.39996 + seed + st;
      const base = (v.base + (0.8 - v.base) * u + (jitter(seed * 5 + i) - 0.5) * 0.06) * height;
      const reach =
        (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1))) *
        (0.75 + 0.5 * jitter(i + seed + st * 3)) *
        v.width *
        (stems > 1 ? 0.75 : 1);
      // A unit of height is some four crown radii, so a spray reaching out
      // a crown radius and up a tenth of the height climbs at about 45°.
      const rise = (0.05 + 0.09 * u) * (1 - form.weep) - form.weep * 0.06 * (1 - u);
      const root = along(base);
      root[0] += Math.cos(a) * 0.03;
      root[2] += Math.sin(a) * 0.03;
      const tip: V3 = [root[0] + Math.cos(a) * reach, base + rise, root[2] + Math.sin(a) * reach];
      const top =
        u < 0.6 && jitter(seed + i * 3 + st) < form.snow * paint.load ? snow : paint.twigs;
      s.fin(root, tip, 0.018 + 0.012 * (1 - u), paint.twigs, paint.twigs, top, 3.5);
    }
  }
  return s.geometry();
}

/** One variant's mesh — its sketch for the far band when `sketch`. */
export function buildTree(v: TreeVariant, paint: TreePaint, sketch = false): THREE.BufferGeometry {
  const seed = v.index * 3 + 1;
  switch (v.shape.form) {
    case "conifer":
      return conifer(v, v.shape, paint, sketch, seed);
    case "pine":
      return pine(v, v.shape, paint, sketch, seed);
    case "larch":
      return larch(v, v.shape, paint, sketch, seed);
    case "birch":
      return birch(v, v.shape, paint, sketch, seed);
  }
}

/** Which of a kind's two far-band SKETCHES a variant is drawn as: the
 * low-crowned one or the high-crowned one, whichever its own crown's base
 * is nearer. */
export const SKETCHES: Readonly<Record<TreeKind, readonly [number, number]>> = {
  spruce: [0, 3],
  fir: [0, 3],
  pine: [3, 0],
  larch: [0, 3],
  birch: [0, 3],
};
