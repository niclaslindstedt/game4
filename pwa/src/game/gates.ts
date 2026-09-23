// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE AS MARKED — every checkpoint a pair of poles either side of the
// track, each carrying a flag, and the start/finish line a banner on two
// taller posts across it.
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

const POLE = 3.2;
const BANNER_POLE = 5.6;

export type Gates = {
  group: THREE.Group;
  /** Highlight checkpoint `next`; `t` is seconds, for the breathing. */
  update(next: number, t: number): void;
  dispose(): void;
};

function bannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      g.fillStyle = ((x + y) / sq) % 2 === 0 ? "#111418" : "#f6f8fa";
      g.fillRect(x, y, sq, sq);
    }
  }
  g.fillStyle = PALETTE.flag;
  g.fillRect(150, 8, 212, 48);
  g.fillStyle = "#ffffff";
  g.font = "bold 34px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("START · FINISH", 256, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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
  const bannerTex = bannerTexture();
  // ONE-SIDED, and hung twice back to back: a plane drawn from behind reads
  // its lettering mirrored, so each face carries its own copy turned to
  // face its own side of the line.
  const banner = std({ map: bannerTex, roughness: 0.7 }, "gate-banner");
  const post = std({ color: 0x20252b, roughness: 0.6 }, "gate-post");
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
  const one = new THREE.Vector3(1, 1, 1);
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
      poles.setMatrixAt(i, m4.compose(at.set(x, y, z), q.identity(), one));
      // Streaming outward, away from the track; the start line has none.
      const angle = Math.atan2(-rz * side, rx * side);
      const s = index === 0 ? 0 : 1;
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
    if (index === 0) {
      // The banner across the line on two tall posts.
      const reach = half + 0.4;
      for (const side of [-1, 1]) {
        const x = cp.x + rx * reach * side;
        const z = cp.z + rz * reach * side;
        const y = level.groundAt(x, z) - 0.3;
        const g = new THREE.CylinderGeometry(0.1, 0.12, BANNER_POLE, 8);
        g.translate(0, BANNER_POLE / 2, 0);
        geos.push(g);
        const p = new THREE.Mesh(g, post);
        p.position.set(x, y, z);
        p.castShadow = true;
        group.add(p);
      }
      const span = reach * 2;
      const g = new THREE.PlaneGeometry(span, span / 8);
      geos.push(g);
      const y = Math.max(
        level.groundAt(cp.x + rx * reach, cp.z + rz * reach),
        level.groundAt(cp.x - rx * reach, cp.z - rz * reach),
      );
      // A plane faces +z; turned by the heading it faces DOWN the course, so
      // the face a rider riding up to the line reads is the one turned half
      // a turn further — and the other is for the lens looking back.
      for (const turn of [Math.PI, 0]) {
        const b = new THREE.Mesh(g, banner);
        b.position.set(cp.x, y + BANNER_POLE - span / 16 - 0.3, cp.z);
        b.rotation.y = cp.heading + turn;
        b.castShadow = true;
        group.add(b);
      }
    }
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
      stakeTex.dispose();
      bannerTex.dispose();
    },
  };
}
