// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A POSED FIGURE AS ONE DRAW. A sled and its rider are built as a tree of
// small meshes — a capsule a limb, a box a boot, a group for the bars and
// one for each ski — because that is how a figure is POSED: every part hangs
// off its parent and the pose only turns joints. But a mesh is a draw call,
// and a draw call is paid again in the shadow pass, so four riders of forty
// parts each were most of a frame's draws.
//
// So the tree is kept for the posing and taken out of the picture: every
// part is switched off every layer (it still updates its matrices, it is
// just never drawn), and what IS drawn is one vertex-coloured mesh per
// machine whose vertices are the parts' own, re-laid each frame through the
// part's matrix relative to the root. The colour of each part is its old
// material's colour, carried as a vertex attribute, so one material draws
// them all. A part whose ancestors are hidden (the rider in the cockpit
// views) is written as a collapsed point, which draws nothing.
//
// Parts that never move against the root are written once (`fixed`); only
// the moving ones are re-laid per frame. A figure of a few thousand vertices
// is a few hundred microseconds of arithmetic — a fraction of what forty
// draws cost.

import * as THREE from "three";

type Part = {
  mesh: THREE.Mesh;
  pos: Float32Array;
  nrm: Float32Array;
  /** Where its vertices start in the merged buffers, in vertices. */
  at: number;
  count: number;
};

export type PosedMerge = {
  mesh: THREE.Mesh;
  /** Re-lay every moving part under `root` from its current matrices. */
  update(): void;
  dispose(): void;
};

function colourOf(mesh: THREE.Mesh): THREE.Color {
  const m = mesh.material as THREE.MeshStandardMaterial;
  const c = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
  // What glowed keeps a little of its glow: a lamp is still the brightest
  // thing on the machine without a material of its own.
  if (m.emissive && m.emissiveIntensity > 0) {
    c.r = Math.min(1, c.r + m.emissive.r * m.emissiveIntensity);
    c.g = Math.min(1, c.g + m.emissive.g * m.emissiveIntensity);
    c.b = Math.min(1, c.b + m.emissive.b * m.emissiveIntensity);
  }
  return c;
}

/** Merge `parts` (meshes somewhere under `root`) into one mesh drawn with
 * `material`, parented to `root`. `moving` says which parts must be re-laid
 * every frame; the rest are laid once, at the pose they stand in now. */
export function mergePosed(
  root: THREE.Object3D,
  parts: THREE.Mesh[],
  moving: (mesh: THREE.Mesh) => boolean,
  material: THREE.Material,
): PosedMerge {
  const list: Part[] = [];
  let total = 0;
  for (const mesh of parts) {
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    if (!src.getAttribute("normal")) src.computeVertexNormals();
    const p = src.getAttribute("position").array as Float32Array;
    const n = src.getAttribute("normal").array as Float32Array;
    const count = p.length / 3;
    list.push({ mesh, pos: new Float32Array(p), nrm: new Float32Array(n), at: total, count });
    if (src !== mesh.geometry) src.dispose();
    total += count;
    // Out of every pass, but still posed.
    mesh.layers.disableAll();
  }
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  for (const part of list) {
    const c = colourOf(part.mesh);
    for (let i = 0; i < part.count; i++) {
      const o = (part.at + i) * 3;
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const nrmAttr = new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("normal", nrmAttr);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // The machine and its rider stand inside a few metres of the root, at any
  // pose the rig can put them in; a fixed sphere spares a recompute a frame.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 3.2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  root.add(mesh);

  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  const nm = new THREE.Matrix3();

  /** Whether the part and every ancestor below the root is shown. */
  const shown = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) {
      if (!p.visible) return false;
    }
    return true;
  };

  const lay = (part: Part) => {
    const o0 = part.at * 3;
    const n = part.count * 3;
    if (!shown(part.mesh)) {
      pos.fill(0, o0, o0 + n);
      return;
    }
    rel.multiplyMatrices(inv, part.mesh.matrixWorld);
    nm.getNormalMatrix(rel);
    const e = rel.elements;
    const m = nm.elements;
    const sp = part.pos;
    const sn = part.nrm;
    for (let i = 0; i < n; i += 3) {
      const x = sp[i];
      const y = sp[i + 1];
      const z = sp[i + 2];
      pos[o0 + i] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pos[o0 + i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pos[o0 + i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const a = sn[i];
      const b = sn[i + 1];
      const c = sn[i + 2];
      const nx = m[0] * a + m[3] * b + m[6] * c;
      const ny = m[1] * a + m[4] * b + m[7] * c;
      const nz = m[2] * a + m[5] * b + m[8] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      nrm[o0 + i] = nx / l;
      nrm[o0 + i + 1] = ny / l;
      nrm[o0 + i + 2] = nz / l;
    }
  };

  const fixed = list.filter((p) => !moving(p.mesh));
  const live = list.filter((p) => moving(p.mesh));
  const refresh = (which: Part[]) => {
    root.updateMatrixWorld(true);
    inv.copy(root.matrixWorld).invert();
    for (const p of which) lay(p);
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
  };
  refresh(list);

  let wasShown = new Map(fixed.map((p) => [p, shown(p.mesh)]));
  return {
    mesh,
    update() {
      // A fixed part is re-laid only when it is shown or hidden.
      const again = fixed.filter((p) => shown(p.mesh) !== wasShown.get(p));
      if (again.length > 0) wasShown = new Map(fixed.map((p) => [p, shown(p.mesh)]));
      refresh(again.length > 0 ? [...again, ...live] : live);
    },
    dispose() {
      geo.dispose();
    },
  };
}
