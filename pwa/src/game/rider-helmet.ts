// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S HEAD AND HIS HELMET — a model of its own, laid in the head's
// frame (z forward, y up, the origin at the middle of the head) and hung by
// `rider.ts` where the pose puts the head.
//
// A helmet is a HOLLOW thing worn over a head, and it reads as one only
// when it is built so: a SHELL with the eye port cut out of it — an outer
// skin, an inner liner seen through the port, and a rim joining them so the
// opening has a thickness — over a HEAD whose face shows in the port; the
// GOGGLES on that face, over his eyes, inside the hollow and behind the
// port's rim, their strap run round the OUTSIDE of the shell's back the way
// a racer wears it; the CHIN BAR the shell's own long jaw under the port,
// a vent in its front face; the PEAK riding the crown over the port.
// Worn, the whole helmet is tipped nose-down (`HELMET_TILT`) so the port
// looks level at the snow ahead.
//
// MEASURED, not guessed: every number below is read off a side photograph
// of a real motocross helmet, gridded and scaled so it is 35 cm from the
// back to the tip of the chin bar, the head's middle taken 12.5 cm behind
// the front of the goggles' lens. Its shape is what makes it read as a helmet and not a gas
// mask: the shell at the eyes is FLAT — the brow only 11.5 cm ahead of the
// head's middle, the goggles filling the port nearly flush — while the chin
// bar reaches 21 cm forward as a long jaw whose bottom runs on in one line
// with the rim, and the peak rides the crown level out to 18.5 cm. The
// shell is one surface whose reach from the head's middle is read off
// three measured profiles (ahead, behind, to the side), the port cut out of
// it. `make sled ARGS=--sheet=head` is the lab: every kit, every side, and
// a profile on a centimetre grid, centred on the head's middle, to lay
// against a photograph at the same scale (tipped as worn, so allow for
// `HELMET_TILT` against a helmet resting on its rim).

import * as THREE from "three";

import { shaped } from "./rider-cloth.ts";

/** How far the shell reaches from the head's middle, m, by elevation (deg,
 * −90 straight down … 90 the crown) — straight ahead, straight behind and
 * to the side. Read off the photograph; see the header. Straight ahead it
 * is the chin bar below the port (its flat underside, the tip at −23°, the
 * front face with the vent, the top corner at −7.5°) and the brow above. */
const AHEAD: [number, number][] = [
  [-90, 0.1325],
  [-67.5, 0.143],
  [-52, 0.169],
  [-40, 0.206],
  [-31, 0.239],
  [-23, 0.23],
  [-15, 0.19],
  [-7.5, 0.166],
  [0, 0.15],
  [30, 0.117],
  [45, 0.125],
  [60, 0.13],
  [75, 0.128],
  [90, 0.125],
];
const BEHIND: [number, number][] = [
  [-90, 0.1325],
  [-67.5, 0.14],
  [-45, 0.16],
  [-20, 0.148],
  [0, 0.139],
  [30, 0.145],
  [60, 0.138],
  [90, 0.125],
];
/** How far the helmet is tipped nose-down when WORN, rad, against the
 * photograph (a helmet resting on its rim, which leans its goggles back
 * about 10°): worn, the port looks level at the snow ahead. And how far
 * it sits up on the head, m. */
export const HELMET_TILT = 0.17;
const SIT = 0.012;
const SIDE: [number, number][] = [
  [-90, 0.1325],
  [-60, 0.135],
  [-30, 0.13],
  [0, 0.128],
  [30, 0.126],
  [60, 0.125],
  [90, 0.125],
];
/** The shell's thickness, m. */
const THICK = 0.014;
/** The grid the shell is laid on: around (from dead ahead, clockwise from
 * above) and up, 7.5° a row so the port's edges fall on grid lines. */
const AROUND = 24;
const UP = 24;
/** The eye port, deg: within `half` of dead ahead, between the chin bar's
 * top corner and the brow; and the neck, open below `neck`. */
const PORT = { half: 45, low: -7.5, high: 30 };
const NECK = -67.5;
/** How far round from dead ahead the liner is laid, rad. */
const LINER_REACH = 1.75;

export type HelmetMaterials = {
  shell: THREE.Material;
  liner: THREE.Material;
  trim: THREE.Material;
  lens: THREE.Material;
  strap: THREE.Material;
  skin: THREE.Material;
};

const DEG = Math.PI / 180;

function profile(table: [number, number][], e: number): number {
  const d = e / DEG;
  if (d <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [e1, r1] = table[i];
    if (d <= e1) {
      const [e0, r0] = table[i - 1];
      return r0 + ((r1 - r0) * (d - e0)) / (e1 - e0);
    }
  }
  return table[table.length - 1][1];
}

/** The shell's reach at `a` round (0 ahead) and `e` up, rad, `lift` m
 * proud of it (negative: inside it). */
export function helmetReach(a: number, e: number, lift = 0): number {
  const c = Math.cos(a);
  const ahead = Math.max(0, c) ** 2;
  const behind = Math.max(0, -c) ** 2;
  const side = 1 - ahead - behind;
  return ahead * profile(AHEAD, e) + behind * profile(BEHIND, e) + side * profile(SIDE, e) + lift;
}

/** The point on the shell (or `lift` off it) at `a` round and `e` up. */
function at(a: number, e: number, lift = 0): [number, number, number] {
  const r = helmetReach(a, e, lift);
  const c = Math.cos(e);
  return [Math.sin(a) * c * r, Math.sin(e) * r, Math.cos(a) * c * r];
}

/** A patch of the surface `lift` proud of it, over `a0..a1` round and
 * `e0..e1` up, `na` × `ne` cells — the goggle strap round the back. */
function patch(
  a0: number,
  a1: number,
  e0: number,
  e1: number,
  na: number,
  ne: number,
  lift: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ne; j++) {
    for (let i = 0; i <= na; i++) {
      pos.push(...at(a0 + ((a1 - a0) * i) / na, e0 + ((e1 - e0) * j) / ne, lift));
    }
  }
  for (let j = 0; j < ne; j++) {
    for (let i = 0; i < na; i++) {
      const p = j * (na + 1) + i;
      idx.push(p, p + 1, p + na + 1, p + 1, p + na + 2, p + na + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A band over the crown, front to back, `half` rad either side of the
 * middle — laid along the arc in the plane of symmetry. */
function crownBand(from: number, to: number, half: number, lift: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 18;
  for (let k = 0; k <= n; k++) {
    // θ along the arc: 0 ahead level, π/2 the crown, π behind level.
    const t = from + ((to - from) * k) / n;
    for (const side of [-1, 1]) {
      const dir = new THREE.Vector3(side * Math.sin(half), Math.sin(t), Math.cos(t)).normalize();
      const e = Math.asin(dir.y);
      const a = Math.atan2(dir.x, dir.z);
      pos.push(...at(a, e, lift));
    }
  }
  for (let k = 0; k < n; k++) {
    const p = k * 2;
    idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** THE SHELL: the outer skin and the rim round every opening (the port and
 * the neck), and the liner — two geometries, so each takes its colour. */
export function helmetShell(): { outer: THREE.BufferGeometry; liner: THREE.BufferGeometry } {
  const da = (Math.PI * 2) / AROUND;
  const de = Math.PI / UP;
  const ang = (i: number) => -Math.PI + i * da;
  const elev = (j: number) => -Math.PI / 2 + j * de;
  const open = (i: number, j: number) => {
    if (j < 0 || j >= UP) return true;
    const a = (ang(((i % AROUND) + AROUND) % AROUND) + da / 2) / DEG;
    const e = (elev(j) + de / 2) / DEG;
    if (e < NECK) return true;
    return Math.abs(a) < PORT.half && e > PORT.low && e < PORT.high;
  };
  // Every row closed on itself (the seam behind shares its vertices), so
  // the normals are smooth all the way round.
  const grid = (lift: number) => {
    const pos: number[] = [];
    for (let j = 0; j <= UP; j++) {
      for (let i = 0; i < AROUND; i++) pos.push(...at(ang(i), elev(j), lift));
    }
    return pos;
  };
  const cell = (i: number, j: number) => j * AROUND + (i % AROUND);
  const skin = (lift: number, inward: boolean) => {
    const idx: number[] = [];
    for (let j = 0; j < UP; j++) {
      for (let i = 0; i < AROUND; i++) {
        if (open(i, j)) continue;
        // The liner is only ever seen through the port: none behind the ears.
        if (inward && Math.abs(ang(i) + da / 2) > LINER_REACH) continue;
        const a = cell(i, j);
        const b = cell(i + 1, j);
        const c = cell(i, j + 1);
        const d = cell(i + 1, j + 1);
        if (inward) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(grid(lift), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // The crown is one point met by a whole row of cells: its normal is up.
    const n = g.getAttribute("normal");
    for (let i = 0; i < AROUND; i++) n.setXYZ(UP * AROUND + i, 0, inward ? -1 : 1, 0);
    return g;
  };
  // The rim: every edge between a closed cell and an open one, joined from
  // the outer skin to the liner, facing into the opening.
  const rim: number[] = [];
  const quad = (a0: number, e0: number, a1: number, e1: number, flip: boolean) => {
    const p0 = at(a0, e0);
    const p1 = at(a1, e1);
    const q0 = at(a0, e0, -THICK);
    const q1 = at(a1, e1, -THICK);
    if (flip) rim.push(...p0, ...p1, ...q0, ...p1, ...q1, ...q0);
    else rim.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
  };
  for (let j = 0; j < UP; j++) {
    for (let i = 0; i < AROUND; i++) {
      if (open(i, j)) continue;
      const a0 = ang(i);
      const a1 = ang(i + 1);
      const e0 = elev(j);
      const e1 = elev(j + 1);
      if (open(i, j - 1)) quad(a0, e0, a1, e0, false);
      if (open(i, j + 1)) quad(a0, e1, a1, e1, true);
      if (open(i - 1, j)) quad(a0, e0, a0, e1, true);
      if (open(i + 1, j)) quad(a1, e0, a1, e1, false);
    }
  }
  const edge = new THREE.BufferGeometry();
  edge.setAttribute("position", new THREE.Float32BufferAttribute(rim, 3));
  edge.computeVertexNormals();
  return { outer: mergeTwo(skin(0, false), edge), liner: skin(-THICK, true) };
}

/** One geometry of two, both laid flat (no index), normals kept. */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = [a.index ? a.toNonIndexed() : a, b.index ? b.toNonIndexed() : b];
  const pos: number[] = [];
  const nrm: number[] = [];
  for (const g of flat) {
    pos.push(...(g.getAttribute("position").array as Float32Array));
    nrm.push(...(g.getAttribute("normal").array as Float32Array));
  }
  for (const g of [a, b, ...flat]) g.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/**
 * THE HEAD IN HIS HELMET, built into `into` (the head's frame). `keep`
 * takes every geometry made, for the caller to dispose.
 */
export function buildHelmet(
  into: THREE.Object3D,
  m: HelmetMaterials,
  keep: <G extends THREE.BufferGeometry>(g: G) => G,
): void {
  // The helmet's parts go on `worn`, tipped as it is worn; the head and
  // his nose stay in the head's own frame.
  const worn = new THREE.Group();
  worn.rotation.x = HELMET_TILT;
  worn.position.y = SIT;
  into.add(worn);
  const part = (g: THREE.BufferGeometry, mat: THREE.Material, on: THREE.Object3D = worn) => {
    const mesh = new THREE.Mesh(keep(g), mat);
    mesh.castShadow = true;
    on.add(mesh);
    return mesh;
  };

  // THE HEAD: a skull a little long, the face forward toward the port, a
  // nose under the goggles.
  const head = part(new THREE.SphereGeometry(0.1, 12, 10), m.skin, into);
  head.scale.set(0.82, 1.02, 1);
  head.position.set(0, -0.012, -0.004);
  const nose = part(
    shaped(
      [
        { y: 0, w: 0.016, d: 0.012 },
        { y: 0.03, w: 0.014, d: 0.01, z: 0.004 },
        { y: 0.042, w: 0.008, d: 0.006, z: 0.006 },
      ],
      { segments: 6, boxy: 2 },
    ).rotateX(Math.PI / 2),
    m.skin,
    into,
  );
  nose.position.set(0, -0.04, 0.078);
  nose.rotation.x = -0.35;

  // THE SHELL, hollow, its port open onto his face.
  const shell = helmetShell();
  part(shell.outer, m.shell);
  part(shell.liner, m.liner);

  // THE GOGGLES on his face, filling the port nearly flush — the lens's
  // front 12.5 cm ahead of the head's middle, as measured: the thick frame
  // wrapped round, the lens in it, both running on inside the shell's
  // cheeks. The strap round the OUTSIDE of the shell's back.
  const frame = part(
    new THREE.CylinderGeometry(0.113, 0.113, 0.086, 14, 1, true, -1.1, 2.2),
    m.trim,
  );
  frame.scale.set(0.95, 1, 1);
  frame.position.set(0, 0.012, 0.004);
  const lens = part(new THREE.CylinderGeometry(0.12, 0.12, 0.056, 14, 1, true, -0.85, 1.7), m.lens);
  lens.scale.set(0.95, 1, 1);
  lens.position.set(0, 0.012, 0.004);
  part(
    patch(PORT.half * DEG + 0.02, Math.PI * 2 - PORT.half * DEG - 0.02, -0.3, -0.05, 20, 2, 0.007),
    m.strap,
  );

  // A stripe over the crown, from over the brow to the back.
  part(crownBand(0.62, Math.PI + 0.3, 0.13, 0.003), m.trim);

  // THE VENT in the chin bar's front face, which looks forward and up.
  const vent = part(new THREE.BoxGeometry(0.05, 0.036, 0.02), m.strap);
  vent.position.set(0, -0.056, 0.184);
  vent.rotation.x = -0.61;

  // THE PEAK riding the crown level from over the middle of the head to
  // 18.5 cm ahead of it, thick where its underside curves down to the brow,
  // thin at its lip — laid along +z, each ring its width, its thickness and
  // how far its middle drops.
  const peak = part(
    shaped(
      [
        { y: 0, w: 0.085, d: 0.009 },
        { y: 0.08, w: 0.1, d: 0.016, z: 0.003 },
        { y: 0.14, w: 0.105, d: 0.0225, z: 0.0085 },
        { y: 0.19, w: 0.095, d: 0.0095, z: -0.0025 },
        { y: 0.22, w: 0.07, d: 0.0035, z: -0.0065 },
      ],
      { segments: 10, boxy: 4 },
    ).rotateX(Math.PI / 2),
    m.trim,
  );
  peak.position.set(0, 0.119, -0.03);
}
