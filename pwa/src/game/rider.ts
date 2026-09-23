// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER — a sled racer in his kit, hung on the points `rider-pose.ts`
// works out. Drawn after the way a sled is actually ridden and dressed: a
// motocross helmet with its PEAK over the goggles and a chin bar jutting to
// a point, the goggles' band and mirrored lens across the front; a padded
// winter jacket, broad at the chest and tapering to the waist, with a
// contrasting YOKE over the shoulders and cuffs at the wrists; bulky
// insulated pants; gauntlet gloves; tall boots. Low-poly on purpose — at
// chase range he is a silhouette — and every part is a fixed shape only
// ever turned and moved, never stretched, so the silhouette MOVES: up off
// the seat on the move, hung off the inside of a turn, stood tall in the
// air, folded on his knees by a landing.

import * as THREE from "three";

import {
  BODY,
  riderPose,
  sprawlPose,
  type RiderInput,
  type RiderPose,
  type V3,
} from "./rider-pose.ts";

export type RiderStyle = {
  jacket: number;
  pants: number;
  helmet: number;
  visor: number;
  /** The jacket's yoke and cuffs — the kit's second colour; the jacket's
   * own when left out. */
  accent?: number;
  /** The helmet's peak; the helmet's own when left out. */
  peak?: number;
};

export type RiderFigure = {
  group: THREE.Group;
  pose(input: RiderInput): void;
  /** Pose him THROWN (`sprawlPose`): his own clock, s, and how hard he is
   * still flailing, 0..1. The caller places the group. */
  sprawl(phase: number, flail: number): void;
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
  const mat = (colour: number, rough = 0.8, metal = 0, name = "rider") => {
    const m = wrap(
      new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal }),
      name,
    );
    mats.push(m);
    return m;
  };
  const jacket = mat(style.jacket, 0.7);
  const accent = mat(style.accent ?? style.jacket, 0.6);
  const pants = mat(style.pants, 0.85);
  const glove = mat(0x17191d, 0.75);
  const helmet = mat(style.helmet, 0.3);
  const peakMat = mat(style.peak ?? style.helmet, 0.35);
  const lens = mat(style.visor, 0.12, 0.6);
  const strap = mat(0x101114, 0.6);

  const geo = <G extends THREE.BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };
  const part = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  /** A limb: a capsule laid along +y, hung between two points by `place`. */
  const limb = (length: number, radius: number, m: THREE.Material) =>
    part(geo(new THREE.CapsuleGeometry(radius, length, 3, 8)), m);

  // THE LEGS: bulky insulated pants, the thigh the thickest part of him.
  const thighs = [0, 1].map(() => limb(BODY.thigh, 0.085, pants));
  const shins = [0, 1].map(() => limb(BODY.shin, 0.068, pants));
  // Tall boots: a shaft up the lower shin and a foot on the board.
  const bootShaftGeo = geo(new THREE.CylinderGeometry(0.075, 0.08, 0.24, 8));
  const bootFootGeo = geo(new THREE.BoxGeometry(0.13, 0.1, 0.3));
  const boots = [0, 1].map(() => {
    const g = new THREE.Group();
    group.add(g);
    part(bootFootGeo, glove, g).position.set(0, 0.03, 0.05);
    return g;
  });
  const shafts = [0, 1].map(() => part(bootShaftGeo, glove));

  // THE ARMS: jacket sleeves, a contrasting cuff, and gauntlet gloves.
  const upper = [0, 1].map(() => limb(BODY.upperArm, 0.066, jacket));
  const fore = [0, 1].map(() => limb(BODY.forearm, 0.058, jacket));
  const cuffGeo = geo(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8));
  const cuffs = [0, 1].map(() => part(cuffGeo, accent));
  const handGeo = geo(new THREE.BoxGeometry(0.1, 0.09, 0.13));
  const hands = [0, 1].map(() => part(handGeo, glove));

  // THE TORSO, in its own frame: y up the spine from the hips, z out of
  // the chest. A padded jacket broad at the chest and narrowing to the
  // waist, the yoke over the shoulders, a collar, the pelvis under it.
  const torso = new THREE.Group();
  group.add(torso);
  const chest = part(
    geo(new THREE.CylinderGeometry(0.2, 0.15, BODY.spine - 0.06, 10)),
    jacket,
    torso,
  );
  chest.position.y = (BODY.spine - 0.06) / 2 + 0.02;
  chest.scale.set(1, 1, 0.72);
  const yoke = part(geo(new THREE.CylinderGeometry(0.215, 0.205, 0.14, 10)), accent, torso);
  yoke.position.y = BODY.spine - 0.1;
  yoke.scale.set(1, 1, 0.76);
  const shoulderGeo = geo(new THREE.SphereGeometry(0.085, 8, 6));
  for (const side of [-1, 1]) {
    part(shoulderGeo, accent, torso).position.set(side * BODY.shoulder, BODY.spine - 0.07, 0);
  }
  const collar = part(geo(new THREE.CylinderGeometry(0.075, 0.1, 0.07, 8)), accent, torso);
  collar.position.y = BODY.spine + 0.01;
  const pelvis = part(geo(new THREE.BoxGeometry(0.3, 0.16, 0.22)), pants, torso);
  pelvis.position.y = -0.02;

  // THE HELMET, in its own frame: z forward, y up.
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const shell = part(geo(new THREE.SphereGeometry(0.15, 14, 10)), helmet, headGroup);
  shell.scale.set(0.94, 1, 1.1);
  // The chin bar, jutting forward and down to a point.
  const chin = part(geo(new THREE.ConeGeometry(0.1, 0.17, 4)), helmet, headGroup);
  chin.rotation.set(Math.PI / 2 + 0.55, Math.PI / 4, 0);
  chin.position.set(0, -0.085, 0.15);
  chin.scale.set(1, 1, 0.6);
  // The goggles: a strap round the shell and the lens across the eye port.
  const band = part(
    geo(new THREE.CylinderGeometry(0.152, 0.152, 0.05, 14, 1, true)),
    strap,
    headGroup,
  );
  band.scale.set(0.95, 1, 1.1);
  band.position.y = 0.005;
  const goggle = part(geo(new THREE.BoxGeometry(0.19, 0.065, 0.05)), lens, headGroup);
  goggle.position.set(0, 0.005, 0.158);
  // The PEAK over the goggles, raked up and out past the brow.
  const peak = part(geo(new THREE.BoxGeometry(0.22, 0.014, 0.17)), peakMat, headGroup);
  peak.position.set(0, 0.09, 0.14);
  peak.rotation.x = -0.28;

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
  /** A short part set `at` a share of the way from one point to another,
   * turned along the line between them. */
  const along = (mesh: THREE.Object3D, from: V3, to: V3, at: number) => {
    place(mesh, from, to);
    a.set(from.x, from.y, from.z);
    b.set(to.x, to.y, to.z);
    mesh.position.copy(a).lerp(b, at);
  };
  const spineUp = new THREE.Vector3();
  const chestOut = new THREE.Vector3();
  const across = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  return {
    group,
    pose(input) {
      lay(riderPose(input));
    },
    sprawl(phase, flail) {
      lay(sprawlPose(phase, flail));
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };

  /** Hang the figure on a pose's points. */
  function lay(p: RiderPose): void {
    for (let i = 0; i < 2; i++) {
      const hip = {
        x: p.hips.x + (i === 0 ? -1 : 1) * BODY.hip * Math.cos(p.roll),
        y: p.hips.y - (i === 0 ? -1 : 1) * BODY.hip * Math.sin(p.roll),
        z: p.hips.z,
      };
      place(thighs[i], hip, p.knees[i]);
      place(shins[i], p.knees[i], p.feet[i]);
      along(shafts[i], p.knees[i], p.feet[i], 0.78);
      place(upper[i], p.shoulders[i], p.elbows[i]);
      place(fore[i], p.elbows[i], p.hands[i]);
      along(cuffs[i], p.elbows[i], p.hands[i], 0.86);
      boots[i].position.set(p.feet[i].x, p.feet[i].y - 0.04, p.feet[i].z);
      place(hands[i], p.elbows[i], p.hands[i]);
      hands[i].position.set(p.hands[i].x, p.hands[i].y, p.hands[i].z);
    }
    // The torso's frame: up the spine, across the shoulders, out of the
    // chest — so the jacket turns with the hang as well as the pitch.
    spineUp.set(p.neck.x - p.hips.x, p.neck.y - p.hips.y, p.neck.z - p.hips.z).normalize();
    across
      .set(
        p.shoulders[1].x - p.shoulders[0].x,
        p.shoulders[1].y - p.shoulders[0].y,
        p.shoulders[1].z - p.shoulders[0].z,
      )
      .normalize();
    chestOut.crossVectors(across, spineUp).normalize();
    across.crossVectors(spineUp, chestOut).normalize();
    basis.makeBasis(across, spineUp, chestOut);
    torso.quaternion.setFromRotationMatrix(basis);
    torso.position.set(p.hips.x, p.hips.y, p.hips.z);
    headGroup.position.set(p.head.x, p.head.y, p.head.z);
    headGroup.rotation.set(-0.2 + p.pitch * 0.3, 0, -p.roll * 0.35);
  }
}
