// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE AS MARKED — every checkpoint a pair of poles either side of the
// track, each carrying a flag, and the start/finish line an inflatable arch
// over the track with the line dyed checkered across the snow under it
// (`start-arch.ts` says where and how big, and why an arch).
//
// THE NEXT CHECKPOINT IS THE ONE THAT MATTERS, so it is the one that is
// loud: its flags are the brand red (`PALETTE.flag`) at full strength and
// breathe a little light, and a tall marker stands over each pole so it
// reads over a crest before the poles themselves do. Every other gate's
// flags are a muted red — present, countable, but not asking for the eye.
//
// A pole is a banded stake, the red-and-white a course crew plants, and
// the poles stand the track's own half-width plus a metre out from the
// centreline, so the gate a sled must pass through is exactly the one it
// sees.

import * as THREE from "three";
import type { Checkpoint, Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { ARCH, archPlan, type ArchPlan } from "./start-arch.ts";
import { STRINGS } from "./strings.ts";
import { LOOSE } from "./trail-stamp.ts";

const POLE = 3.2;

export type Gates = {
  group: THREE.Group;
  /** Highlight checkpoint `next`; `t` is seconds, for the breathing. */
  update(next: number, t: number): void;
  dispose(): void;
};

/** The banner printed across the span: the words on the arch's own red,
 * a checkered block at each end, a white rule top and bottom — and the
 * words SIZED TO THE PANEL, measured, never a guessed font over a guessed
 * box. `aspect` is the panel's width over its height. */
function bannerTexture(aspect: number): THREE.CanvasTexture {
  const h = 128;
  const w = Math.min(2048, Math.round(h * aspect));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = PALETTE.flag;
  g.fillRect(0, 0, w, h);
  const rule = 8;
  const sq = (h - rule * 2) / 3;
  const cols = 4;
  for (const x0 of [rule, w - rule - sq * cols]) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? "#15181c" : "#f6f8fa";
        g.fillRect(x0 + c * sq, rule + r * sq, sq, sq);
      }
    }
  }
  g.fillStyle = "#f6f8fa";
  g.fillRect(0, 0, w, rule * 0.6);
  g.fillRect(0, h - rule * 0.6, w, rule * 0.6);
  const room = w - 2 * (rule + sq * cols) - 2 * sq;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 84;
  g.font = `900 ${size}px sans-serif`;
  const wide = g.measureText(STRINGS.archLine).width;
  if (wide > room) {
    size = Math.floor((size * room) / wide);
    g.font = `900 ${size}px sans-serif`;
  }
  g.fillText(STRINGS.archLine, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The line dyed across the snow: two squares of the checker, repeated. */
function bandTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#1b1f25";
  g.fillRect(0, 0, 2, 2);
  g.fillStyle = "#f4f6f8";
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  return tex;
}

/** The arch's tube: up one leg, round the shoulder, across, round, down. */
function archPath(a: ArchPlan): THREE.CurvePath<THREE.Vector3> {
  const [l, r] = a.feet;
  const c = ARCH.corner;
  const across = (d: number, y: number) => new THREE.Vector3(a.x + a.rx * d, y, a.z + a.rz * d);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const p0 = new THREE.Vector3(l.x, l.y, l.z);
  const p1 = across(-a.reach, a.top - c);
  const p2 = across(-a.reach + c, a.top);
  const p3 = across(a.reach - c, a.top);
  const p4 = across(a.reach, a.top - c);
  const p5 = new THREE.Vector3(r.x, r.y, r.z);
  path.add(new THREE.LineCurve3(p0, p1));
  path.add(new THREE.QuadraticBezierCurve3(p1, across(-a.reach, a.top), p2));
  path.add(new THREE.LineCurve3(p2, p3));
  path.add(new THREE.QuadraticBezierCurve3(p3, across(a.reach, a.top), p4));
  path.add(new THREE.LineCurve3(p4, p5));
  return path;
}

/** A thin cylinder from `a` to `b` — a guy line. */
function strand(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

function stakeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 32;
  const g = canvas.getContext("2d")!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? PALETTE.flag : "#f4f6f8";
    g.fillRect(0, i * 4, 4, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function createGates(level: Level, haze: HazeUniforms): Gates {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  const stakeTex = stakeTexture();
  const stake = std({ map: stakeTex, roughness: 0.6 }, "gate-stake");
  const texs: THREE.Texture[] = [stakeTex];
  const flag = std({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }, "gate-flag");
  const marker = std(
    { color: PALETTE.flag, emissive: PALETTE.flag, emissiveIntensity: 0.5, roughness: 0.6 },
    "gate-marker",
  );
  const hot = new THREE.Color(PALETTE.flag);
  const idle = new THREE.Color(PALETTE.flag).lerp(new THREE.Color(0x9aa4ad), 0.45);

  const poleGeo = new THREE.CylinderGeometry(0.045, 0.055, POLE, 6);
  poleGeo.translate(0, POLE / 2, 0);
  // A flag: a pennant a metre long, hung off the pole's top.
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.6, 0, 0.95, -0.3, 0], 3),
  );
  flagGeo.computeVertexNormals();
  const markerGeo = new THREE.ConeGeometry(0.3, 0.7, 4);
  markerGeo.rotateX(Math.PI);
  geos.push(poleGeo, flagGeo, markerGeo);

  // Every pole and every flag is one instance of one of two meshes: a
  // course is dozens of them, and one draw each would be most of a frame's
  // draw calls.
  const n = level.checkpoints.length * 2;
  const poles = new THREE.InstancedMesh(poleGeo, stake, n);
  const flags = new THREE.InstancedMesh(flagGeo, flag, n);
  poles.castShadow = true;
  flags.castShadow = true;
  group.add(poles, flags);
  const markers = [0, 1].map(() => {
    const m = new THREE.Mesh(markerGeo, marker);
    m.visible = false;
    group.add(m);
    return m;
  });
  /** Where each gate's two pole tops are, for the markers. */
  const tops: THREE.Vector3[][] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();

  const place = (cp: Checkpoint, index: number) => {
    const fx = Math.sin(cp.heading);
    const fz = Math.cos(cp.heading);
    // The rider's right: forward turned clockwise a quarter.
    const rx = fz;
    const rz = -fx;
    const half = cp.width / 2 + 1;
    const own: THREE.Vector3[] = [];
    [-1, 1].forEach((side, k) => {
      const x = cp.x + rx * half * side;
      const z = cp.z + rz * half * side;
      const y = level.groundAt(x, z) - 0.2;
      const i = index * 2 + k;
      // The start line has neither stakes nor flags: the arch is its mark.
      const s = index === 0 ? 0 : 1;
      poles.setMatrixAt(i, m4.compose(at.set(x, y, z), q.identity(), new THREE.Vector3(s, s, s)));
      // Streaming outward, away from the track.
      const angle = Math.atan2(-rz * side, rx * side);
      flags.setMatrixAt(
        i,
        m4.compose(
          at.set(x, y + POLE - 0.05, z),
          q.setFromAxisAngle(up, angle),
          new THREE.Vector3(s, s, s),
        ),
      );
      flags.setColorAt(i, idle);
      own.push(new THREE.Vector3(x, y + POLE + 1.3, z));
    });
    tops.push(own);
    if (index === 0) arch(cp);
  };

  const arch = (cp: Checkpoint) => {
    const a = archPlan(level, cp);
    const fx = Math.sin(cp.heading);
    const fz = Math.cos(cp.heading);
    // The fabric: the organiser's red, a nylon's soft sheen.
    const fabric = std({ color: PALETTE.flag, roughness: 0.45 }, "arch-fabric");
    const tube = new THREE.TubeGeometry(archPath(a), 140, ARCH.tube, 16, false);
    geos.push(tube);
    const body = new THREE.Mesh(tube, fabric);
    body.castShadow = true;
    group.add(body);

    // The banner across the span's face, sized to the straight run between
    // the shoulders. ONE-SIDED, and hung twice back to back: a plane drawn
    // from behind reads its lettering mirrored, so each face carries its
    // own copy turned to face its own side of the line.
    const width = 2 * (a.reach - ARCH.corner * 0.6);
    const tex = bannerTexture(width / ARCH.panel);
    texs.push(tex);
    const print = std({ map: tex, roughness: 0.6 }, "arch-banner");
    const plane = new THREE.PlaneGeometry(width, ARCH.panel);
    geos.push(plane);
    // A plane faces +z; turned by the heading it faces DOWN the course, so
    // the face a rider riding up to the line reads is the one turned half
    // a turn further — and the other is for the lens looking back.
    for (const turn of [Math.PI, 0]) {
      const out = (turn === 0 ? 1 : -1) * (ARCH.tube + 0.03);
      const b = new THREE.Mesh(plane, print);
      b.position.set(a.x + fx * out, a.top, a.z + fz * out);
      b.rotation.y = cp.heading + turn;
      group.add(b);
    }

    // At each foot the skirt it is weighted down with and the blower that
    // keeps it up; from each shoulder a guy line fore and aft to a stake.
    const dark = std({ color: 0x23282e, roughness: 0.8 }, "arch-foot");
    const rope = std({ color: 0xe8ecef, roughness: 0.9 }, "arch-rope");
    const skirt = new THREE.CylinderGeometry(ARCH.tube * 1.25, ARCH.tube * 1.35, 0.8, 16);
    skirt.translate(0, 0.4, 0);
    const blower = new THREE.BoxGeometry(0.45, 0.4, 0.55);
    blower.translate(0, 0.2, 0);
    geos.push(skirt, blower);
    a.feet.forEach((f, k) => {
      const side = k === 0 ? -1 : 1;
      const s = new THREE.Mesh(skirt, dark);
      s.position.set(f.x, f.y + ARCH.sink - 0.2, f.z);
      s.castShadow = true;
      const bx = f.x + a.rx * side * 1.3;
      const bz = f.z + a.rz * side * 1.3;
      const box = new THREE.Mesh(blower, dark);
      box.position.set(bx, level.groundAt(bx, bz) - 0.05, bz);
      box.rotation.y = cp.heading;
      box.castShadow = true;
      group.add(s, box);
      const shoulder = new THREE.Vector3(f.x, a.top - ARCH.corner * 0.3, f.z);
      for (const along of [-1, 1]) {
        const gx = f.x + a.rx * side * 1.5 + fx * along * 4.2;
        const gz = f.z + a.rz * side * 1.5 + fz * along * 4.2;
        const line = strand(shoulder, new THREE.Vector3(gx, level.groundAt(gx, gz), gz), 0.012);
        geos.push(line);
        group.add(new THREE.Mesh(line, rope));
      }
    });

    // THE LINE ON THE SNOW: a checkered band dyed across the track, from
    // stake to stake, laid on the snow as it lies — a grid sampled off the
    // heightfield and the loose cover over it (`snow-glsl.ts`), lifted a hair and drawn a step nearer so it never
    // flickers in and out of the snow.
    const bandTex = bandTexture();
    texs.push(bandTex);
    const dye = std(
      {
        map: bandTex,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      },
      "arch-band",
    );
    const half = cp.width / 2 + 1;
    const nx = Math.ceil((2 * half) / 0.5);
    const nz = 4;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const sq = ARCH.band / 3;
    for (let j = 0; j <= nz; j++) {
      const along = (j / nz - 0.5) * ARCH.band;
      for (let i = 0; i <= nx; i++) {
        const across = (i / nx - 0.5) * 2 * half;
        const x = a.x + a.rx * across + fx * along;
        const z = a.z + a.rz * across + fz * along;
        pos.push(x, level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)) + 0.04, z);
        uv.push(across / sq, along / sq + 1);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const p = j * (nx + 1) + i;
        const q2 = p + nx + 1;
        idx.push(p, q2, p + 1, p + 1, q2, q2 + 1);
      }
    }
    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bandGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    bandGeo.setIndex(idx);
    bandGeo.computeVertexNormals();
    geos.push(bandGeo);
    const band = new THREE.Mesh(bandGeo, dye);
    band.receiveShadow = true;
    group.add(band);

    // The line has no stakes of its own: the finish's markers ride over
    // the arch's legs instead.
    tops[0] = a.feet.map((f) => new THREE.Vector3(f.x, a.top + ARCH.tube + 1.1, f.z));
  };
  level.checkpoints.forEach(place);
  poles.instanceMatrix.needsUpdate = true;
  flags.instanceMatrix.needsUpdate = true;
  const breathing = new THREE.Color();

  let lit = -1;
  return {
    group,
    update(next, t) {
      if (next !== lit) {
        if (lit >= 0 && tops[lit]) {
          flags.setColorAt(lit * 2, idle);
          flags.setColorAt(lit * 2 + 1, idle);
        }
        lit = next;
        markers.forEach((m, k) => {
          const top = tops[lit]?.[k];
          m.visible = top !== undefined;
          if (top) m.position.copy(top);
        });
      }
      if (tops[lit]) {
        breathing.copy(hot).multiplyScalar(1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4)));
        flags.setColorAt(lit * 2, breathing);
        flags.setColorAt(lit * 2 + 1, breathing);
        for (const m of markers) m.rotation.y = t * 1.5;
      }
      if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      poles.dispose();
      flags.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
