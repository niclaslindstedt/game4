// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER — a figure in a winter suit and a helmet, hung on the points
// `rider-pose.ts` works out: capsules for the limbs (each its own fixed
// length, only ever turned, never stretched), a torso, a helmet with its
// visor. Low-poly on purpose; at chase range he is a silhouette, and what
// matters is that the silhouette MOVES — hangs off into a turn, stands for
// the air, folds on a landing.

import * as THREE from "three";

import { BODY, riderPose, type RiderInput, type V3 } from "./rider-pose.ts";

export type RiderStyle = { jacket: number; pants: number; helmet: number; visor: number };

export type RiderFigure = {
  group: THREE.Group;
  pose(input: RiderInput): void;
  dispose(): void;
};

const Y = new THREE.Vector3(0, 1, 0);

export function createRider(
  style: RiderStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): RiderFigure {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (colour: number, rough = 0.8, name = "rider") => {
    const m = wrap(new THREE.MeshStandardMaterial({ color: colour, roughness: rough }), name);
    mats.push(m);
    return m;
  };
  const jacket = mat(style.jacket, 0.7);
  const pants = mat(style.pants, 0.85);
  const glove = mat(0x1b1d22, 0.8);
  const helmet = mat(style.helmet, 0.35);
  const visor = mat(style.visor, 0.15);

  const limb = (length: number, radius: number, m: THREE.Material) => {
    const g = new THREE.CapsuleGeometry(radius, length, 3, 8);
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const thighs = [limb(BODY.thigh, 0.075, pants), limb(BODY.thigh, 0.075, pants)];
  const shins = [limb(BODY.shin, 0.062, pants), limb(BODY.shin, 0.062, pants)];
  const upper = [limb(BODY.upperArm, 0.06, jacket), limb(BODY.upperArm, 0.06, jacket)];
  const fore = [limb(BODY.forearm, 0.052, jacket), limb(BODY.forearm, 0.052, jacket)];
  const torso = limb(BODY.spine - 0.1, 0.16, jacket);
  torso.scale.set(1.05, 1, 0.78);
  const bootGeo = new THREE.BoxGeometry(0.12, 0.12, 0.3);
  geos.push(bootGeo);
  const boots = [0, 1].map(() => {
    const b = new THREE.Mesh(bootGeo, glove);
    b.castShadow = true;
    group.add(b);
    return b;
  });
  const handGeo = new THREE.SphereGeometry(0.055, 8, 6);
  geos.push(handGeo);
  const hands = [0, 1].map(() => {
    const h = new THREE.Mesh(handGeo, glove);
    group.add(h);
    return h;
  });
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const shell = new THREE.SphereGeometry(0.15, 14, 10);
  geos.push(shell);
  const helm = new THREE.Mesh(shell, helmet);
  helm.scale.set(0.95, 1, 1.08);
  helm.castShadow = true;
  headGroup.add(helm);
  const visorGeo = new THREE.SphereGeometry(
    0.152,
    12,
    6,
    Math.PI * 0.18,
    Math.PI * 0.64,
    Math.PI * 0.35,
    Math.PI * 0.25,
  );
  geos.push(visorGeo);
  const vis = new THREE.Mesh(visorGeo, visor);
  vis.scale.set(0.97, 1, 1.1);
  headGroup.add(vis);
  // The chin bar of a snocross helmet, jutting forward.
  const chinGeo = new THREE.BoxGeometry(0.16, 0.07, 0.12);
  geos.push(chinGeo);
  const chin = new THREE.Mesh(chinGeo, helmet);
  chin.position.set(0, -0.08, 0.12);
  chin.rotation.x = 0.3;
  headGroup.add(chin);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const place = (mesh: THREE.Object3D, from: V3, to: V3) => {
    a.set(from.x, from.y, from.z);
    b.set(to.x, to.y, to.z);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    dir.copy(b).sub(a).normalize();
    mesh.quaternion.setFromUnitVectors(Y, dir);
  };

  return {
    group,
    pose(input) {
      const p = riderPose(input);
      for (let i = 0; i < 2; i++) {
        const hip = {
          x: p.hips.x + (i === 0 ? -1 : 1) * BODY.hip * Math.cos(p.roll),
          y: p.hips.y - (i === 0 ? -1 : 1) * BODY.hip * Math.sin(p.roll),
          z: p.hips.z,
        };
        place(thighs[i], hip, p.knees[i]);
        place(shins[i], p.knees[i], p.feet[i]);
        place(upper[i], p.shoulders[i], p.elbows[i]);
        place(fore[i], p.elbows[i], p.hands[i]);
        boots[i].position.set(p.feet[i].x, p.feet[i].y - 0.02, p.feet[i].z + 0.06);
        hands[i].position.set(p.hands[i].x, p.hands[i].y, p.hands[i].z);
      }
      place(torso, p.hips, p.neck);
      headGroup.position.set(p.head.x, p.head.y, p.head.z);
      headGroup.rotation.set(-0.25 + p.pitch * 0.35, 0, -p.roll * 0.5);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
