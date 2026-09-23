// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS DRAWN — built from a handful of extruded profiles and
// boxes in the engine's own body frame (x right, y up, z forward, the origin
// at the centre of gravity of machine and rider), so every number here reads
// against `defs/sled.ts`. EACH MACHINE IS DRAWN OFF ITS OWN SPEC:
//
//   * THE RUNNING GEAR — the skis, the spindles, the tread — stands on the
//     snow `spec.cogHeight` under the origin, the skis `skiStance` apart at
//     `skiForward`, the tread's run from `treadFront` to `treadRear`.
//   * THE CHASSIS — the cowl, the seat, the boards, the bars — stands where
//     the REFERENCE machine's does (`SLED.cogHeight` over the snow), because
//     that is where the rider's hands and feet are fixed (`MOUNTS` in
//     `rider-pose.ts`). A machine carried higher on its springs (the cross
//     sled's long travel) is drawn with its running gear further under it,
//     which is exactly what long travel looks like.
//   * THE TUNNEL runs back to the tread's end, so the mountain sled's long
//     belt is a long tail and the trail sled's short one a stubby one, and
//     the cowl is as wide as the machine's envelope (`width`).
//
// What each part is:
//
//   * TWO SKIS a stance apart at the ski contact, each on a SPINDLE under an
//     A-arm pair. They turn with the engine's `skiAngle` and ride up and
//     down with its per-ski compression, so the front end visibly works
//     over a mogul while the body floats.
//   * THE TREAD under a TUNNEL, its run on the snow from `treadFront` to
//     `treadRear` and climbing to the drive sprocket under the cowl, with a
//     SNOW FLAP hanging off the back — rising and falling with the rear
//     suspension's compression.
//   * The COWL (hood) with its headlight, the WINDSHIELD, the handlebars on
//     their riser, the SEAT on the tunnel, the running boards the rider's
//     feet stand on — and the rider himself (`rider.ts`).
//
// Four colour schemes (`SLED_STYLES`), one per grid slot, their body paint
// read off `sled-colours.ts` so the minimap's dot is the same colour.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLED, type SledSpec, type SledState } from "@engine";

import type { Pose } from "./interp.ts";
import { mergePosed } from "./posed-merge.ts";
import { createRider, type RiderFigure, type RiderStyle } from "./rider.ts";
import { SLED_BODY } from "./sled-colours.ts";

export type SledStyle = {
  body: number;
  accent: number;
  rider: RiderStyle;
};

export const SLED_STYLES: SledStyle[] = [
  {
    body: SLED_BODY[0],
    accent: 0xf4f4f4,
    rider: { jacket: 0x1f2a36, pants: 0x14181e, helmet: 0xe8412c, visor: 0x16222e },
  },
  {
    body: SLED_BODY[1],
    accent: 0xf2f5f8,
    rider: { jacket: 0x2a6fd6, pants: 0x1a1d24, helmet: 0xf2f2f2, visor: 0x18222c },
  },
  {
    body: SLED_BODY[2],
    accent: 0x151515,
    rider: { jacket: 0x252525, pants: 0x151515, helmet: 0xf2bf22, visor: 0x101418 },
  },
  {
    body: SLED_BODY[3],
    accent: 0x0e1a14,
    rider: { jacket: 0x0f6b48, pants: 0x1b1f1d, helmet: 0x0e1a14, visor: 0x2b5a6e },
  },
];

/** Rest compression of either end, m — the sag the drawn skis and tread sit
 * at when the engine reports it (the spec's "about 8 cm"). */
export const REST_SAG = 0.08;

export type SledModel = {
  root: THREE.Group;
  /** Pose from the engine's state, drawn at `at` (the interpolated place);
   * `sink` lowers the machine into the snow by the drawn furrow's extra
   * depth, m. */
  pose(sled: SledState, at: Pose, sink: number): void;
  setRiderVisible(visible: boolean): void;
  /** The lamps' glow, 0 (off) … 1 (full night) — `SkyLook.lamps` — seen
   * from `facing`: the cosine between the machine's nose and the way to
   * the lens (1 head-on, −1 from dead astern). A lamp is a lens that shines
   * one way: the headlamp glows at a lens in front, the taillight behind. */
  setLamps(level: number, facing: number): void;
  dispose(): void;
};

/** Where a machine's lamps are in its body frame, m: the headlamp in the
 * cowl's nose and the taillight on the tunnel's end. The headlamp's beam
 * points along the body's forward axis, dipped by `HEADLAMP_DIP`. */
export function lampMounts(spec: SledSpec): {
  head: [number, number, number];
  tail: [number, number, number];
} {
  const snow = -SLED.cogHeight;
  const tail = spec.treadRear - SLED.treadRear;
  return { head: [0, snow + 0.58, 1.5], tail: [0, snow + 0.47, -1.6 + tail] };
}

/** How far below the body's forward axis the headlamp is aimed, rad. */
export const HEADLAMP_DIP = 0.1;

/** A soft round glow, white at the middle — every lamp's sprite. */
let glowTexture: THREE.DataTexture | null = null;
function glow(): THREE.DataTexture {
  if (glowTexture) return glowTexture;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const v = Math.max(0, 1 - r);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * v * v * v);
    }
  }
  glowTexture = new THREE.DataTexture(data, n, n);
  glowTexture.needsUpdate = true;
  return glowTexture;
}

/** A side profile in the body's (z, y) plane, extruded `width` across x and
 * centred on x = 0. */
function profile(points: [number, number][], width: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, width - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Shape x → body z, extrusion → body x.
  g.rotateY(-Math.PI / 2);
  g.translate((width - 2 * bevel) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function createSledModel(
  spec: SledSpec,
  style: SledStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SledModel {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (params: THREE.MeshStandardMaterialParameters, name = "sled") => {
    const m = wrap(new THREE.MeshStandardMaterial(params), name);
    mats.push(m);
    return m;
  };
  const paint = mat({ color: style.body, roughness: 0.32, metalness: 0.05 });
  const accent = mat({ color: style.accent, roughness: 0.4 });
  const black = mat({ color: 0x1c1f23, roughness: 0.75 });
  const seatMat = mat({ color: 0x2a2d33, roughness: 0.6 });
  const rubber = mat({ color: 0x0e0f11, roughness: 0.95 });
  const alloy = mat({ color: 0x8d949c, roughness: 0.35, metalness: 0.8 });
  const lamp = mat({ color: 0xfff6dc, emissive: 0xfff2cc, emissiveIntensity: 0.6, roughness: 0.2 });
  const glass = wrap(
    new THREE.MeshStandardMaterial({
      color: 0x2c3a48,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
    "sled-glass",
  );
  mats.push(glass);

  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // The chassis's snow line (the reference's, where the rider is mounted),
  // and the running gear's (this machine's own).
  const snow = -SLED.cogHeight;
  const ground = -spec.cogHeight;
  /** How much further back this machine's tread ends than the reference's,
   * m — the tunnel, the tail and the flap all move with it. */
  const tail = spec.treadRear - SLED.treadRear;
  /** The cowl's width against the reference's. */
  const wide = spec.width / SLED.width;
  // THE COWL.
  add(
    profile(
      [
        [1.72, snow + 0.3],
        [1.6, snow + 0.48],
        [1.2, snow + 0.66],
        [0.72, snow + 0.84],
        [0.5, snow + 0.88],
        [0.42, snow + 0.66],
        [0.3, snow + 0.42],
        [0.34, snow + 0.3],
        [1.3, snow + 0.24],
      ],
      0.86 * wide,
      0.07,
    ),
    paint,
  );
  // A contrasting stripe along the cowl's flank.
  add(
    profile(
      [
        [1.55, snow + 0.42],
        [1.0, snow + 0.56],
        [0.55, snow + 0.66],
        [0.55, snow + 0.6],
        [1.0, snow + 0.5],
        [1.55, snow + 0.37],
      ],
      0.9 * wide,
      0.0,
    ),
    accent,
  );
  // Belly pan under the cowl, and the bumper.
  add(
    profile(
      [
        [1.75, snow + 0.3],
        [1.3, snow + 0.18],
        [0.2, snow + 0.2],
        [0.2, snow + 0.32],
        [1.3, snow + 0.3],
      ],
      0.8 * wide,
      0.03,
    ),
    black,
  );
  const bumper = add(new THREE.TorusGeometry(0.28, 0.018, 5, 12, Math.PI), alloy);
  bumper.rotation.set(-Math.PI / 2, 0, 0);
  bumper.position.set(0, snow + 0.36, 1.7);
  bumper.scale.set(wide, 0.7, 1);
  // The headlight.
  const mounts = lampMounts(spec);
  const light = add(new THREE.BoxGeometry(0.26, 0.06, 0.04), lamp);
  light.position.set(mounts.head[0], mounts.head[1], mounts.head[2] - 0.02);
  light.rotation.x = -0.55;

  // THE WINDSHIELD, a curved sheet raked back.
  const shield = add(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12, 1, true, -0.62, 1.24), glass);
  shield.rotation.x = -0.5;
  shield.scale.set(1, 1, 0.45);
  shield.position.set(0, snow + 0.98, 0.42);

  // THE TUNNEL and the running boards; the tunnel's flanks carry the paint.
  // Both run back to the tread's end, and the flanks reach down over the
  // extra travel a taller machine carries its tread on.
  const drop = spec.cogHeight - SLED.cogHeight;
  add(new THREE.BoxGeometry(0.52, 0.14, 1.95 - tail), black).position.set(
    0,
    snow + 0.36,
    -0.62 + tail / 2,
  );
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.02, 0.2 + drop, 1.7 - tail), paint).position.set(
      side * 0.27,
      snow + 0.36 - drop / 2,
      -0.72 + tail / 2,
    );
    add(new THREE.BoxGeometry(0.2, 0.025, 1.2), alloy).position.set(
      side * 0.34,
      snow + 0.32,
      -0.35,
    );
    // Side panel between the cowl and the boards.
    add(new THREE.BoxGeometry(0.03, 0.24, 0.5), paint).position.set(
      side * 0.43 * wide,
      snow + 0.42,
      0.18,
    );
  }
  // THE SEAT.
  add(
    profile(
      [
        [0.18, snow + 0.72],
        [0.05, snow + 0.8],
        [-0.9, snow + 0.8],
        [-1.08, snow + 0.72],
        [-1.08, snow + 0.44],
        [0.18, snow + 0.44],
      ],
      0.44,
      0.05,
    ),
    seatMat,
  );
  // The tail cap behind the seat, in the paint, reaching back to the end of
  // this machine's tunnel.
  add(
    profile(
      [
        [-0.95, snow + 0.44],
        [-0.95, snow + 0.7],
        [-1.1, snow + 0.72],
        [Math.min(-1.2, -1.5 + tail), snow + 0.56],
        [Math.min(-1.25, -1.55 + tail), snow + 0.44],
      ],
      0.5,
      0.03,
    ),
    paint,
  );
  // Rear bumper, tail light, and the SNOW FLAP (on the rear suspension).
  const rear = new THREE.Group();
  rear.position.z = tail;
  root.add(rear);
  const grab = add(new THREE.TorusGeometry(0.24, 0.016, 5, 10, Math.PI), alloy, rear);
  grab.rotation.set(Math.PI / 2, 0, 0);
  grab.position.set(0, snow + 0.45, -1.6);
  add(
    new THREE.BoxGeometry(0.16, 0.04, 0.03),
    mat({ color: 0xc81818, emissive: 0x800000, roughness: 0.3 }),
    rear,
  ).position.set(0, snow + 0.47, -1.6);
  const flap = add(new THREE.BoxGeometry(0.5, 0.34, 0.012), rubber, rear);
  flap.position.set(0, snow + 0.2, -1.63);

  // THE HANDLEBARS on their riser, turning about the steering column.
  const bars = new THREE.Group();
  bars.position.set(0, snow + 1.0, 0.32);
  root.add(bars);
  add(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 6), alloy, bars).position.set(0, -0.12, 0);
  const bar = add(new THREE.CylinderGeometry(0.014, 0.014, 0.82, 6), alloy, bars);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.02, -0.04);
  for (const side of [-1, 1]) {
    const grip = add(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), black, bars);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(side * 0.38, 0.02, -0.04);
  }

  // THE TREAD, on the rear suspension.
  const tread = new THREE.Group();
  root.add(tread);
  const tf = spec.treadFront;
  const tr = spec.treadRear;
  const belt = new THREE.Shape();
  const r0 = 0.12;
  // The belt climbs from the front of its run to the drive sprocket under
  // the cowl, which is the chassis's and so stands on the chassis's line.
  const rise = snow - ground;
  belt.moveTo(tr, ground);
  belt.lineTo(tf, ground);
  belt.lineTo(0.5, ground + 0.2 + rise * 0.5);
  belt.absarc(0.44, ground + 0.3 + rise, r0, -0.4, Math.PI * 0.9, false);
  belt.lineTo(tr, ground + 0.26 + rise);
  belt.absarc(tr, ground + 0.13 + rise / 2, 0.13 + rise / 2, Math.PI / 2, Math.PI * 1.5, false);
  const beltGeo = new THREE.ExtrudeGeometry(belt, {
    depth: spec.treadWidth,
    bevelEnabled: false,
    curveSegments: 6,
  });
  beltGeo.rotateY(-Math.PI / 2);
  beltGeo.translate(spec.treadWidth / 2, 0, 0);
  add(beltGeo, rubber, tread);
  // The lugs, a row of paddles along the run at their own height, so the
  // belt reads as a track and the mountain sled's reads as a paddle wheel.
  const lugs: THREE.BufferGeometry[] = [];
  for (let z = tr; z <= tf; z += 0.1) {
    lugs.push(
      new THREE.BoxGeometry(spec.treadWidth * 0.96, spec.lugHeight, 0.035).translate(
        0,
        ground + 0.02 - spec.lugHeight / 2,
        z,
      ),
    );
  }
  add(mergeGeometries(lugs), rubber, tread);
  for (const g of lugs) g.dispose();

  // THE SKIS, each on its spindle.
  type Ski = { group: THREE.Group; spindle: THREE.Mesh; upper: THREE.Mesh; lower: THREE.Mesh };
  const skis: Ski[] = [];
  const skiGeo = profile(
    [
      [-0.55, 0],
      [0.42, 0],
      [0.6, 0.07],
      [0.72, 0.2],
      [0.68, 0.23],
      [0.55, 0.1],
      [0.4, 0.05],
      [-0.55, 0.05],
    ],
    spec.skiWidth,
    0.012,
  );
  geos.push(skiGeo);
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set((side * spec.skiStance) / 2, ground, spec.skiForward);
    root.add(group);
    const skiMesh = new THREE.Mesh(skiGeo, black);
    skiMesh.castShadow = true;
    group.add(skiMesh);
    const tip = add(new THREE.BoxGeometry(spec.skiWidth * 0.9, 0.02, 0.18), paint, group);
    tip.position.set(0, 0.055, 0.1);
    const spindle = add(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 6), alloy, group);
    spindle.position.set(0, 0.22, 0);
    // The A-arms, re-laid each frame between the chassis and the spindle.
    const upper = add(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), alloy);
    const lower = add(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), alloy);
    skis.push({ group, spindle, upper, lower });
  }

  const figure: RiderFigure = createRider(style.rider, wrap);
  root.add(figure.group);

  // THE WHOLE MACHINE AND ITS RIDER AS ONE DRAW (`posed-merge.ts`): every
  // opaque part keeps its place in the tree for the posing and is drawn
  // through one vertex-coloured mesh. The parts bolted straight to the
  // frame are laid once; the skis, the struts, the bars, the tread and the
  // rider are re-laid each frame. The windshield stays its own mesh — it is
  // the one transparent thing on the machine.
  const struts = new Set<THREE.Object3D>(skis.flatMap((k) => [k.upper, k.lower]));
  const parts: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== glass) parts.push(o);
  });
  const merged = mergePosed(
    root,
    parts,
    (mesh) => mesh.parent !== root || struts.has(mesh),
    mat({ vertexColors: true, roughness: 0.55, metalness: 0.05 }, "sled-merged"),
  );

  // THE LAMPS' GLOW, drawn over the merged machine: additive sprites that
  // come up as the light goes, so a rival reads as two lights in the dark.
  const glowOf = (colour: number, size: number, at: [number, number, number]) => {
    const m = new THREE.SpriteMaterial({
      map: glow(),
      color: colour,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    mats.push(m);
    const sprite = new THREE.Sprite(m);
    sprite.scale.set(size, size, size);
    sprite.position.set(...at);
    sprite.visible = false;
    sprite.renderOrder = 6;
    root.add(sprite);
    return sprite;
  };
  const headGlow = glowOf(0xfff0d0, 1.1, [mounts.head[0], mounts.head[1], mounts.head[2] + 0.05]);
  const tailGlow = glowOf(0xff2a1a, 0.5, mounts.tail);

  const Y = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const toRoot = new THREE.Quaternion();
  const thrown = new THREE.Quaternion();
  const tumble = new THREE.Quaternion();
  // The merged draw's bound: the machine's own, grown while the rider is
  // lying away from it.
  const bound = merged.mesh.geometry.boundingSphere!;
  const BOUND = bound.radius;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const strut = (mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    const d = b.copy(to).sub(from);
    const l = d.length();
    mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(l || 1));
    mesh.scale.set(1, l, 1);
  };

  return {
    root,
    pose(sled, at, sink) {
      root.position.set(at.x, at.y - sink, at.z);
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      for (let i = 0; i < 2; i++) {
        const s = skis[i];
        const lift = Math.max(-0.12, Math.min(0.2, sled.skiCompression[i] - REST_SAG));
        s.group.position.y = ground + lift + sink * 0.7;
        // Clockwise from above is a positive turn about +y in the engine's
        // frame, which is three's too (`lib/quat.ts`).
        s.group.rotation.y = sled.skiAngle;
        const side = i === 0 ? -1 : 1;
        const top = s.group.position.y + 0.36;
        const x = (side * spec.skiStance) / 2;
        const fwd = spec.skiForward;
        strut(s.upper, a.set(side * 0.2, snow + 0.46, fwd - 0.12), c.set(x, top, fwd));
        strut(s.lower, a.set(side * 0.2, snow + 0.3, fwd), c.set(x, top - 0.14, fwd));
      }
      const rearLift = Math.max(-0.12, Math.min(0.25, sled.treadCompression - REST_SAG));
      tread.position.y = rearLift + sink * 0.8;
      const off = sled.thrown;
      if (off) {
        // THE RIDER THROWN (`crash.ts`): off the machine on a body of his
        // own, tumbling head over heels along the way he was thrown — laid
        // in the root's frame, so the one merged draw still carries him,
        // and the draw's bound grown to reach him.
        toRoot.set(at.q.x, at.q.y, at.q.z, at.q.w).invert();
        figure.group.position
          .set(off.x - at.x, off.y - (at.y - sink), off.z - at.z)
          .applyQuaternion(toRoot);
        thrown.setFromAxisAngle(Y, off.heading).multiply(tumble.setFromAxisAngle(X, off.tumble));
        figure.group.quaternion.copy(toRoot).multiply(thrown);
        const flail = Math.min(1, Math.hypot(off.vx, off.vz) / 6 + (off.touching ? 0 : 0.5));
        figure.sprawl(off.t, flail);
        bound.radius = BOUND + figure.group.position.length();
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.set(0, 0, 0);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        figure.pose({
          riderRight: sled.riderRight,
          riderAft: sled.riderAft,
          lean: sled.lean,
          steer: sled.steer,
          airborne: sled.airborne,
          landing: sled.landing,
        });
      }
      bars.rotation.y = sled.steer * 0.42;
      merged.update();
    },
    setLamps(level, facing) {
      const ahead = THREE.MathUtils.smoothstep(facing, -0.2, 0.6);
      const behind = THREE.MathUtils.smoothstep(-facing, -0.1, 0.5);
      for (const [sprite, k] of [
        [headGlow, ahead],
        [tailGlow, 0.9 * behind],
      ] as const) {
        const o = Math.min(1, level) * k;
        sprite.visible = o > 0.02;
        (sprite.material as THREE.SpriteMaterial).opacity = o;
      }
    },
    setRiderVisible(v) {
      if (figure.group.visible === v) return;
      figure.group.visible = v;
      merged.update();
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      merged.dispose();
      figure.dispose();
    },
  };
}
