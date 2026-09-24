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
// a racer wears it; the CHIN BAR hung on the shell under the port, tipped
// down to a broad front with a vent in it; the PEAK on the brow over the
// port. After the helmets sleds are raced in (`make sled ARGS=--sheet=head`
// is the lab: every kit, every side).

import * as THREE from "three";

import { shaped } from "./rider-cloth.ts";

/** The shell's radius, m, and its stretch: a little narrow, a little tall,
 * long front to back. */
const R = 0.158;
const SHELL = { x: 0.96, y: 1.03, z: 1.12 };
/** The liner's share of the shell — the shell's thickness. */
const INNER = 0.88;
/** The grid the shell is laid on: around (from dead ahead, clockwise from
 * above) and up (from the lower edge to the crown), rad. */
const AROUND = 24;
const UP = 12;
const LOW = -1.0;
/** The eye port: every cell of the grid whose middle is within `half` of
 * dead ahead and between `low` and `high` up. */
const PORT = { half: 0.8, low: -0.36, high: 0.29 };

export type HelmetMaterials = {
  shell: THREE.Material;
  liner: THREE.Material;
  trim: THREE.Material;
  lens: THREE.Material;
  strap: THREE.Material;
  skin: THREE.Material;
};

/** A point on the shell at `a` round and `e` up, at `k` of its size. */
function onShell(a: number, e: number, k: number): [number, number, number] {
  const c = Math.cos(e);
  return [
    Math.sin(a) * c * R * SHELL.x * k,
    Math.sin(e) * R * SHELL.y * k,
    Math.cos(a) * c * R * SHELL.z * k,
  ];
}

/** THE SHELL: the outer skin and the rim round every opening (the port and
 * the neck), and the liner — two geometries, so each takes its colour. */
export function helmetShell(): { outer: THREE.BufferGeometry; liner: THREE.BufferGeometry } {
  const da = (Math.PI * 2) / AROUND;
  const de = (Math.PI / 2 - LOW) / UP;
  const ang = (i: number) => -Math.PI + i * da;
  const elev = (j: number) => LOW + j * de;
  const open = (i: number, j: number) => {
    if (j < 0 || j >= UP) return true;
    const a = ang(((i % AROUND) + AROUND) % AROUND) + da / 2;
    const e = elev(j) + de / 2;
    return Math.abs(a) < PORT.half && e > PORT.low && e < PORT.high;
  };
  const grid = (k: number) => {
    const pos: number[] = [];
    for (let j = 0; j <= UP; j++) {
      for (let i = 0; i <= AROUND; i++) pos.push(...onShell(ang(i), elev(j), k));
    }
    return pos;
  };
  const at = (i: number, j: number) => j * (AROUND + 1) + i;
  const skin = (k: number, inward: boolean) => {
    const idx: number[] = [];
    for (let j = 0; j < UP; j++) {
      for (let i = 0; i < AROUND; i++) {
        if (open(i, j)) continue;
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i, j + 1);
        const d = at(i + 1, j + 1);
        // Outward: counter-clockwise seen from outside.
        if (inward) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(grid(k), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // The rim: every edge between a closed cell and an open one, joined from
  // the outer skin to the liner, facing into the opening.
  const rim: number[] = [];
  const quad = (a0: number, e0: number, a1: number, e1: number, flip: boolean) => {
    const p0 = onShell(a0, e0, 1);
    const p1 = onShell(a1, e1, 1);
    const q0 = onShell(a0, e0, INNER);
    const q1 = onShell(a1, e1, INNER);
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
  const outer = skin(1, false);
  const edge = new THREE.BufferGeometry();
  edge.setAttribute("position", new THREE.Float32BufferAttribute(rim, 3));
  edge.computeVertexNormals();
  return { outer: mergeTwo(outer, edge), liner: skin(INNER, true) };
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
  const part = (g: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(keep(g), mat);
    mesh.castShadow = true;
    into.add(mesh);
    return mesh;
  };

  // THE HEAD: a skull a little long, the face forward in the hollow, a nose
  // under the goggles.
  const head = part(new THREE.SphereGeometry(0.1, 12, 10), m.skin);
  head.scale.set(0.82, 1.02, 1);
  head.position.set(0, -0.012, -0.006);
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
  );
  nose.position.set(0, -0.042, 0.074);
  nose.rotation.x = -0.35;

  // THE SHELL, hollow, its port open onto his face.
  const shell = helmetShell();
  part(shell.outer, m.shell);
  part(shell.liner, m.liner);

  // THE GOGGLES on his face, over his eyes, inside the port: the thick
  // frame wrapped round, the lens in it; the strap round the OUTSIDE of the
  // shell's back.
  const face = 0.104;
  const frame = part(
    new THREE.CylinderGeometry(face, face, 0.064, 12, 1, true, -1.05, 2.1),
    m.trim,
  );
  frame.scale.set(0.9, 1, 1);
  frame.position.set(0, 0.002, 0.004);
  const lens = part(
    new THREE.CylinderGeometry(face + 0.006, face + 0.006, 0.042, 12, 1, true, -0.8, 1.6),
    m.lens,
  );
  lens.scale.set(0.9, 1, 1);
  lens.position.set(0, 0.002, 0.004);
  const strap = part(
    new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.042, 18, 1, true, 0.85, Math.PI * 2 - 1.7),
    m.strap,
  );
  strap.scale.set(SHELL.x, 1, SHELL.z);
  strap.position.y = 0.004;

  // A stripe over the crown, from over the port to the strap.
  const stripe = part(
    new THREE.CylinderGeometry(R + 0.003, R + 0.003, 0.05, 16, 1, true, 0.62, Math.PI - 0.8),
    m.trim,
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.scale.set(1.01, SHELL.x, SHELL.z);

  // THE CHIN BAR, hung under the port and laid along +z from inside the
  // jaw: each ring narrower, shallower and lower than the last, tipped
  // down so its top runs from the port's sill to a broad front.
  const chin = part(
    shaped(
      [
        { y: 0, w: 0.112, d: 0.07 },
        { y: 0.07, w: 0.11, d: 0.068, z: 0.01 },
        { y: 0.12, w: 0.096, d: 0.06, z: 0.022 },
        { y: 0.15, w: 0.076, d: 0.05, z: 0.03 },
        { y: 0.162, w: 0.05, d: 0.038, z: 0.034 },
      ],
      { segments: 12, boxy: 3 },
    ).rotateX(Math.PI / 2),
    m.shell,
  );
  chin.position.set(0, -0.112, 0.04);
  chin.rotation.x = 0.3;
  const vent = part(new THREE.BoxGeometry(0.06, 0.028, 0.03), m.strap);
  vent.position.set(0, -0.14, 0.186);
  vent.rotation.x = 0.45;

  // THE PEAK, broad on the brow over the port, raked up a little — widest
  // at its lip.
  const peak = part(
    shaped(
      [
        { y: 0, w: 0.1, d: 0.01 },
        { y: 0.1, w: 0.118, d: 0.01 },
        { y: 0.16, w: 0.112, d: 0.008 },
      ],
      { segments: 8, boxy: 6 },
    ).rotateX(Math.PI / 2),
    m.trim,
  );
  peak.position.set(0, 0.092, 0.095);
  peak.rotation.x = -0.2;
}
