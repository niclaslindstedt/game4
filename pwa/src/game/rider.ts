// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER — a sled racer in his kit, hung on the points `rider-pose.ts`
// works out. Drawn after photographs of sleds ridden from behind, which is
// where the chase camera sees him: a big helmet sat down on a tall jacket
// collar with no neck showing, the goggles' strap round its back and a
// stripe over its crown, the goggles framed in the eye port, a PEAK on the
// brow and a chunky chin bar (the face has its own lab sheet, `head`); a
// wind jacket that is one broad, boxy mass from the hem to the shoulders —
// no waist to speak of — gathered across the belly and hanging in folds
// down the back, the shoulders sloping into the collar under a contrasting
// YOKE; bulky sleeves creased at the elbow and bunched into gauntlet gloves
// with flared cuffs; insulated pants round a real seat (two lobes, not a
// can), creased at the hip and the knee and flared over big boots. Every
// part is cloth (`rider-cloth.ts`): shaped sections with their folds, so a
// limb tapers and creases and a torso has shoulders — a figure, not a stack
// of capsules. Every part is a fixed shape only ever turned and moved,
// never stretched, so the silhouette MOVES: up off the seat on the move,
// hung off the inside of a turn, stood tall in the air, folded on his knees
// by a landing.

import * as THREE from "three";

import { cloth, limbRings, shaped, torsoFold } from "./rider-cloth.ts";
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
  const boot = mat(0x121316, 0.7);
  const sole = mat(0x2a2c30, 0.9);
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

  // THE LEGS: insulated pants, baggy at the thigh, creased where the leg
  // comes out of the seat and behind the knee, and flared at the foot of
  // the shin over the top of the boot — the gaiter a sled's pants have.
  const { thigh: TH, shin: SH } = BODY;
  // Each limb is turned so its +z is where the joint's bend points: the top
  // of the thigh and the front of the shin, toward the knee.
  const thighGeo = geo(
    shaped(
      limbRings(TH, [0.108, 0.11, 0.104, 0.096, 0.088], 0.92),
      cloth(
        8,
        [
          { at: 0.03, reach: 0.1, pitch: 0.08, amp: 0.08, side: 1 },
          { at: TH, reach: 0.15, pitch: 0.08, amp: 0.14, side: -1 },
        ],
        [
          { at: TH - 0.01, reach: 0.09, amp: 0.12, side: 1 },
          { at: 0.12, reach: 0.12, amp: 0.07, side: -1 },
        ],
      ),
    ),
  );
  const shinGeo = geo(
    shaped(
      [
        { y: -0.06, w: 0.045, d: 0.045 },
        { y: -0.035, w: 0.075, d: 0.075 },
        { y: 0, w: 0.088, d: 0.086 },
        { y: 0.1, w: 0.084, d: 0.082 },
        { y: SH - 0.25, w: 0.082, d: 0.082 },
        { y: SH - 0.18, w: 0.098, d: 0.1 },
        { y: SH - 0.14, w: 0.104, d: 0.106 },
        { y: SH - 0.13, w: 0.1, d: 0.102 },
      ],
      cloth(
        8,
        [
          { at: 0, reach: 0.12, pitch: 0.08, amp: 0.12, side: -1 },
          { at: SH - 0.22, reach: 0.07, pitch: 0.06, amp: 0.05 },
        ],
        [{ at: 0, reach: 0.08, amp: 0.12, side: 1 }],
      ),
    ),
  );
  const thighs = [0, 1].map(() => part(thighGeo, pants));
  const shins = [0, 1].map(() => part(shinGeo, pants));
  // The boot: a padded shaft up the shin into the pants' gaiter, and a
  // long foot with a rounded toe and a sole — laid along +z, the ankle at
  // the origin.
  const shaftGeo = geo(
    shaped(
      [
        { y: 0, w: 0.074, d: 0.08 },
        { y: 0.14, w: 0.08, d: 0.085 },
        { y: 0.18, w: 0.078, d: 0.082 },
        { y: 0.2, w: 0.066, d: 0.07 },
      ],
      { segments: 8, boxy: 2.4 },
    ),
  );
  const footGeo = geo(
    shaped(
      [
        { y: -0.1, w: 0.05, d: 0.045 },
        { y: -0.085, w: 0.068, d: 0.07 },
        { y: 0.04, w: 0.07, d: 0.066 },
        { y: 0.16, w: 0.064, d: 0.048 },
        { y: 0.2, w: 0.045, d: 0.034 },
      ],
      { segments: 8, boxy: 2.8 },
    ).rotateX(Math.PI / 2),
  );
  const soleGeo = geo(new THREE.BoxGeometry(0.13, 0.03, 0.31));
  const boots = [0, 1].map(() => {
    const g = new THREE.Group();
    group.add(g);
    part(footGeo, boot, g).position.set(0, 0.07, 0);
    part(soleGeo, sole, g).position.set(0, 0.015, 0.045);
    return g;
  });
  const shafts = [0, 1].map(() => part(shaftGeo, boot));

  // THE ARMS: jacket sleeves, bulky at the shoulder and tapering to the
  // wrist, gathered in creases on both sides of the elbow and bunched where
  // the sleeve goes into the gauntlet, whose cuff flares over its end.
  // +z is the point of the elbow; the crook, where they crease, is −z.
  const UA = BODY.upperArm;
  const upperGeo = geo(
    shaped(
      limbRings(UA, [0.088, 0.09, 0.086, 0.08, 0.074]),
      cloth(
        8,
        [
          { at: 0.04, reach: 0.08, pitch: 0.07, amp: 0.06, side: -1 },
          { at: UA, reach: 0.12, pitch: 0.075, amp: 0.14, side: -1 },
        ],
        [{ at: UA - 0.03, reach: 0.1, amp: 0.1, side: 1 }],
      ),
    ),
  );
  const foreGeo = geo(
    shaped(
      [
        { y: -0.05, w: 0.04, d: 0.04 },
        { y: -0.025, w: 0.066, d: 0.066 },
        { y: 0, w: 0.076, d: 0.076 },
        { y: 0.08, w: 0.07, d: 0.068 },
        { y: 0.15, w: 0.07, d: 0.068 },
        { y: 0.2, w: 0.076, d: 0.074 },
        { y: 0.215, w: 0.06, d: 0.058 },
      ],
      cloth(
        8,
        [
          { at: 0, reach: 0.11, pitch: 0.07, amp: 0.14, side: -1 },
          { at: 0.16, reach: 0.06, pitch: 0.05, amp: 0.06 },
        ],
        [{ at: 0.02, reach: 0.08, amp: 0.08, side: 1 }],
      ),
    ),
  );
  const upper = [0, 1].map(() => part(upperGeo, jacket));
  const fore = [0, 1].map(() => part(foreGeo, jacket));
  // The gauntlet: the flared cuff, then the fist closed round the grip —
  // along the forearm, the grip's middle at the forearm's end.
  const cuffGeo = geo(
    shaped(
      [
        { y: -0.15, w: 0.086, d: 0.086 },
        { y: -0.13, w: 0.09, d: 0.09 },
        { y: -0.07, w: 0.056, d: 0.052 },
        { y: -0.04, w: 0.048, d: 0.052 },
        { y: 0.0, w: 0.052, d: 0.06 },
        { y: 0.04, w: 0.05, d: 0.058 },
        { y: 0.06, w: 0.036, d: 0.04 },
      ],
      { segments: 8, boxy: 2.4 },
    ),
  );
  const hands = [0, 1].map(() => part(cuffGeo, glove));

  // THE TORSO, in its own frame: y up the spine from the hips, z out of
  // the chest. A wind jacket, one boxy mass from the hem to the shoulders,
  // sloping into a tall collar, with its folds (`torsoFold`); the yoke over
  // the shoulders and the hem band carry the same folds, sat just proud.
  const sp = BODY.spine;
  const top = sp - BODY.shoulderDrop;
  // Rings every 1.8 cm where the jacket gathers and folds, 4 cm above.
  const jacketCloth = {
    segments: 16,
    fold: torsoFold(top),
    step: (y: number) => (y < 0.3 ? 0.018 : 0.04),
  };
  const torso = new THREE.Group();
  group.add(torso);
  part(
    geo(
      shaped(
        [
          { y: -0.07, w: 0.19, d: 0.138, z: -0.01 },
          { y: 0.0, w: 0.194, d: 0.144, z: -0.005 },
          { y: 0.12, w: 0.19, d: 0.14 },
          { y: 0.24, w: 0.206, d: 0.146, z: 0.005 },
          { y: top - 0.06, w: 0.238, d: 0.15, z: 0.01 },
          { y: top, w: 0.244, d: 0.142, z: 0.02 },
          { y: top + 0.04, w: 0.21, d: 0.12, z: 0.015 },
          { y: sp - 0.005, w: 0.13, d: 0.1, z: 0.005 },
          { y: sp + 0.01, w: 0.09, d: 0.088 },
        ],
        jacketCloth,
      ),
    ),
    jacket,
    torso,
  );
  part(
    geo(
      shaped(
        [
          { y: top - 0.1, w: 0.234, d: 0.151, z: 0.01 },
          { y: top - 0.06, w: 0.243, d: 0.155, z: 0.01 },
          { y: top, w: 0.249, d: 0.147, z: 0.02 },
          { y: top + 0.04, w: 0.215, d: 0.125, z: 0.015 },
          { y: sp - 0.005, w: 0.135, d: 0.105, z: 0.005 },
          { y: sp + 0.012, w: 0.095, d: 0.092 },
        ],
        jacketCloth,
      ),
    ),
    accent,
    torso,
  );
  part(
    geo(
      shaped(
        [
          { y: -0.075, w: 0.195, d: 0.143, z: -0.01 },
          { y: -0.045, w: 0.198, d: 0.147, z: -0.008 },
          { y: -0.02, w: 0.199, d: 0.149, z: -0.006 },
        ],
        jacketCloth,
      ),
    ),
    accent,
    torso,
  );
  // The collar, standing up round the back of the neck — set back, since
  // the torso leans forward and a collar square to it juts under the chin.
  part(
    geo(
      shaped(
        [
          { y: sp - 0.02, w: 0.095, d: 0.09, z: -0.01 },
          { y: sp + 0.05, w: 0.085, d: 0.075, z: -0.03 },
          { y: sp + 0.065, w: 0.07, d: 0.06, z: -0.035 },
        ],
        { segments: 10, boxy: 2.1 },
      ),
    ),
    accent,
    torso,
  );
  // THE SEAT OF THE PANTS: the hips, narrowing to the crotch under them,
  // and the two lobes of his backside behind, a cleft between them — what
  // a rider stood up off the seat shows the camera behind him.
  part(
    geo(
      shaped(
        [
          { y: -0.16, w: 0.07, d: 0.07, z: 0.01 },
          { y: -0.13, w: 0.14, d: 0.11, z: 0.0 },
          { y: -0.06, w: 0.178, d: 0.122, z: 0.005 },
          { y: 0.0, w: 0.184, d: 0.126, z: 0.005 },
          { y: 0.05, w: 0.178, d: 0.124, z: 0.005 },
        ],
        { segments: 12, step: 0.035 },
      ),
    ),
    pants,
    torso,
  );
  const lobeGeo = geo(
    shaped(
      [
        { y: -0.1, w: 0.03, d: 0.03 },
        { y: -0.085, w: 0.07, d: 0.06 },
        { y: -0.04, w: 0.094, d: 0.082 },
        { y: 0.02, w: 0.096, d: 0.084 },
        { y: 0.07, w: 0.082, d: 0.07 },
        { y: 0.1, w: 0.04, d: 0.035 },
      ],
      { segments: 10, boxy: 2.1, step: 0.03 },
    ),
  );
  for (const side of [-1, 1]) {
    const lobe = part(lobeGeo, pants, torso);
    lobe.position.set(side * 0.074, -0.07, -0.052);
    // Tipped back at the foot and splayed out a little, so they round
    // under into the seat and part at the cleft.
    lobe.rotation.set(0.35, 0, side * 0.12);
  }

  // THE HELMET, in its own frame: z forward, y up. After the helmets
  // sleds are raced in: a big shell a little long, its back cut down low
  // to the collar; the EYE PORT filled by the goggles, their thick frame
  // wrapped round the face and the lens inside it; the CHIN BAR a long,
  // angular beak jutting forward and down to a point, a vent in its
  // front; the PEAK flat on the brow, wide, reaching out over the goggles.
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const R = 0.158;
  const SHELL = new THREE.Vector3(0.96, 1.03, 1.12);
  const shell = part(geo(new THREE.SphereGeometry(R, 14, 10)), helmet, headGroup);
  shell.scale.copy(SHELL);
  // The chin bar, laid along +z from inside the jaw: each ring narrower,
  // shallower and lower than the last, to the point.
  const chin = part(
    geo(
      shaped(
        [
          { y: 0, w: 0.132, d: 0.088 },
          { y: 0.07, w: 0.126, d: 0.082, z: 0.01 },
          { y: 0.12, w: 0.106, d: 0.072, z: 0.022 },
          { y: 0.15, w: 0.082, d: 0.06, z: 0.03 },
          { y: 0.163, w: 0.052, d: 0.042, z: 0.034 },
        ],
        { segments: 12, boxy: 3 },
      ).rotateX(Math.PI / 2),
    ),
    helmet,
    headGroup,
  );
  // Tipped down, so its top runs from under the goggles down to the point.
  chin.position.set(0, -0.065, 0.035);
  chin.rotation.x = 0.3;
  // The vent in the face of the beak.
  const vent = part(geo(new THREE.BoxGeometry(0.06, 0.03, 0.03)), strap, headGroup);
  vent.position.set(0, -0.098, 0.182);
  vent.rotation.x = 0.45;
  // A stripe over the crown, front to back, in the peak's colour — from
  // under the peak to the strap, never down over the goggles.
  const stripe = part(
    geo(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.05, 16, 1, true, 0.5, Math.PI - 0.7)),
    peakMat,
    headGroup,
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.scale.set(1.01, SHELL.x, SHELL.z);
  stripe.position.y = 0.012;
  // The goggles: the strap round the back of the shell, the thick frame
  // wrapped round the eye port, and the lens set in it.
  const band = part(
    geo(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.045, 16, 1, true)),
    strap,
    headGroup,
  );
  band.scale.set(SHELL.x, 1, SHELL.z);
  band.position.y = 0.015;
  const frame = part(
    geo(new THREE.CylinderGeometry(R * 1.07, R * 1.07, 0.084, 14, 1, true, -0.98, 1.96)),
    peakMat,
    headGroup,
  );
  frame.scale.set(SHELL.x, 1, SHELL.z);
  frame.position.y = 0.015;
  const goggle = part(
    geo(new THREE.CylinderGeometry(R * 1.09, R * 1.09, 0.052, 14, 1, true, -0.78, 1.56)),
    lens,
    headGroup,
  );
  goggle.scale.set(SHELL.x, 1, SHELL.z);
  goggle.position.y = 0.015;
  // The PEAK, broad on the brow over the goggles, raked up and out past
  // them — widest at its lip.
  const peak = part(
    geo(
      shaped(
        [
          { y: 0, w: 0.1, d: 0.01 },
          { y: 0.1, w: 0.118, d: 0.01 },
          { y: 0.16, w: 0.112, d: 0.008 },
        ],
        { segments: 8, boxy: 6 },
      ).rotateX(Math.PI / 2),
    ),
    peakMat,
    headGroup,
  );
  peak.position.set(0, 0.092, 0.095);
  peak.rotation.x = -0.2;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const out = new THREE.Vector3();
  const side = new THREE.Vector3();
  const limb = new THREE.Matrix4();
  /** Hang a part whose origin is a joint and whose +y runs to the next,
   * turned about its length so its +z faces `face` — where the joint's
   * bend points, so the cloth's knee pad sits on the knee. */
  const hang = (mesh: THREE.Object3D, from: V3, to: V3, face: THREE.Vector3) => {
    a.set(from.x, from.y, from.z);
    b.set(to.x, to.y, to.z);
    mesh.position.copy(a);
    dir.copy(b).sub(a).normalize();
    out.copy(face).addScaledVector(dir, -face.dot(dir));
    if (out.lengthSq() < 1e-8) {
      mesh.quaternion.setFromUnitVectors(Y, dir);
      return;
    }
    out.normalize();
    side.crossVectors(dir, out);
    limb.makeBasis(side, dir, out);
    mesh.quaternion.setFromRotationMatrix(limb);
  };
  const knee = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  /** Where a bend points: the middle joint off the line between the ends,
   * or `lean` (small) when the limb is straight. */
  const bendOf = (into: THREE.Vector3, root: V3, mid: V3, tip: V3, lean: V3) =>
    into.set(
      mid.x - (root.x + tip.x) / 2 + lean.x,
      mid.y - (root.y + tip.y) / 2 + lean.y,
      mid.z - (root.z + tip.z) / 2 + lean.z,
    );
  const spineUp = new THREE.Vector3();
  const chestOut = new THREE.Vector3();
  const across = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const flat = new THREE.Vector3();

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
      const sd = i === 0 ? -1 : 1;
      bendOf(knee, hip, p.knees[i], p.feet[i], { x: 0, y: 0, z: 0.01 });
      bendOf(elbow, p.shoulders[i], p.elbows[i], p.hands[i], { x: sd * 0.01, y: -0.005, z: 0 });
      hang(thighs[i], hip, p.knees[i], knee);
      hang(shins[i], p.knees[i], p.feet[i], knee);
      // The shaft stands on the boot, up the shin toward the knee.
      hang(shafts[i], p.feet[i], p.knees[i], knee);
      hang(upper[i], p.shoulders[i], p.elbows[i], elbow);
      hang(fore[i], p.elbows[i], p.hands[i], elbow);
      // The glove turned along the forearm, set on the grip.
      hang(hands[i], p.elbows[i], p.hands[i], elbow);
      hands[i].position.set(p.hands[i].x, p.hands[i].y, p.hands[i].z);
      // The boot flat on its board, pointed where the knee is.
      flat.set(p.knees[i].x - p.feet[i].x, 0, p.knees[i].z - p.feet[i].z);
      boots[i].position.set(p.feet[i].x, p.feet[i].y - 0.06, p.feet[i].z - 0.02);
      boots[i].rotation.set(0, flat.lengthSq() > 1e-6 ? Math.atan2(flat.x, flat.z) * 0.4 : 0, 0);
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
    // The head held nearer level than the shoulders, and turned a little
    // to look into the turn.
    headGroup.rotation.set(-0.2 + p.pitch * 0.3, p.bars * 0.5, -p.roll * 0.35, "YXZ");
  }
}
