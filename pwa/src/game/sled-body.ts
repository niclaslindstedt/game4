// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE AS DRAWN — built from a handful of extruded profiles and
// boxes in the engine's own body frame (x right, y up, z forward, the origin
// at the centre of gravity of machine and rider, the snow `SLED.cogHeight`
// under it), so every number here reads against `defs/sled.ts`:
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
import { SLED, type SledState } from "@engine";

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
const REST_SAG = 0.08;

export type SledModel = {
  root: THREE.Group;
  /** Pose from the engine's state, drawn at `at` (the interpolated place);
   * `sink` lowers the machine into the snow by the drawn furrow's extra
   * depth, m. */
  pose(sled: SledState, at: Pose, sink: number): void;
  setRiderVisible(visible: boolean): void;
  dispose(): void;
};

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

  const snow = -SLED.cogHeight;
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
      0.86,
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
      0.9,
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
      0.8,
      0.03,
    ),
    black,
  );
  const bumper = add(new THREE.TorusGeometry(0.28, 0.018, 5, 12, Math.PI), alloy);
  bumper.rotation.set(-Math.PI / 2, 0, 0);
  bumper.position.set(0, snow + 0.36, 1.7);
  bumper.scale.set(1, 0.7, 1);
  // The headlight.
  const light = add(new THREE.BoxGeometry(0.26, 0.06, 0.04), lamp);
  light.position.set(0, snow + 0.58, 1.48);
  light.rotation.x = -0.55;

  // THE WINDSHIELD, a curved sheet raked back.
  const shield = add(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12, 1, true, -0.62, 1.24), glass);
  shield.rotation.x = -0.5;
  shield.scale.set(1, 1, 0.45);
  shield.position.set(0, snow + 0.98, 0.42);

  // THE TUNNEL and the running boards; the tunnel's flanks carry the paint.
  add(new THREE.BoxGeometry(0.52, 0.14, 1.95), black).position.set(0, snow + 0.36, -0.62);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.02, 0.2, 1.7), paint).position.set(side * 0.27, snow + 0.36, -0.72);
    add(new THREE.BoxGeometry(0.2, 0.025, 1.2), alloy).position.set(
      side * 0.34,
      snow + 0.32,
      -0.35,
    );
    // Side panel between the cowl and the boards.
    add(new THREE.BoxGeometry(0.03, 0.24, 0.5), paint).position.set(side * 0.43, snow + 0.42, 0.18);
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
  // The tail cap behind the seat, in the paint.
  add(
    profile(
      [
        [-0.95, snow + 0.44],
        [-0.95, snow + 0.7],
        [-1.1, snow + 0.72],
        [-1.5, snow + 0.56],
        [-1.55, snow + 0.44],
      ],
      0.5,
      0.03,
    ),
    paint,
  );
  // Rear bumper, tail light, and the SNOW FLAP (on the rear suspension).
  const rear = new THREE.Group();
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
  const tf = SLED.treadFront;
  const tr = SLED.treadRear;
  const belt = new THREE.Shape();
  const r0 = 0.12;
  belt.moveTo(tr, snow);
  belt.lineTo(tf, snow);
  belt.lineTo(0.5, snow + 0.2);
  belt.absarc(0.44, snow + 0.3, r0, -0.4, Math.PI * 0.9, false);
  belt.lineTo(tr, snow + 0.26);
  belt.absarc(tr, snow + 0.13, 0.13, Math.PI / 2, Math.PI * 1.5, false);
  const beltGeo = new THREE.ExtrudeGeometry(belt, {
    depth: SLED.treadWidth,
    bevelEnabled: false,
    curveSegments: 6,
  });
  beltGeo.rotateY(-Math.PI / 2);
  beltGeo.translate(SLED.treadWidth / 2, 0, 0);
  add(beltGeo, rubber, tread);
  // The lugs, a row of paddles along the run, so the belt reads as a track.
  const lugs: THREE.BufferGeometry[] = [];
  for (let z = tr; z <= tf; z += 0.1) {
    lugs.push(
      new THREE.BoxGeometry(SLED.treadWidth * 0.96, 0.03, 0.035).translate(0, snow + 0.005, z),
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
    SLED.skiWidth,
    0.012,
  );
  geos.push(skiGeo);
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set((side * SLED.skiStance) / 2, snow, SLED.skiForward);
    root.add(group);
    const skiMesh = new THREE.Mesh(skiGeo, black);
    skiMesh.castShadow = true;
    group.add(skiMesh);
    const tip = add(new THREE.BoxGeometry(SLED.skiWidth * 0.9, 0.02, 0.18), paint, group);
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

  const Y = new THREE.Vector3(0, 1, 0);
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
        s.group.position.y = snow + lift + sink * 0.7;
        // Clockwise from above is a positive turn about +y in the engine's
        // frame, which is three's too (`lib/quat.ts`).
        s.group.rotation.y = sled.skiAngle;
        const side = i === 0 ? -1 : 1;
        const top = s.group.position.y + 0.36;
        const x = (side * SLED.skiStance) / 2;
        strut(
          s.upper,
          a.set(side * 0.2, snow + 0.46, SLED.skiForward - 0.12),
          c.set(x, top, SLED.skiForward),
        );
        strut(
          s.lower,
          a.set(side * 0.2, snow + 0.3, SLED.skiForward),
          c.set(x, top - 0.14, SLED.skiForward),
        );
      }
      const rearLift = Math.max(-0.12, Math.min(0.25, sled.treadCompression - REST_SAG));
      tread.position.y = rearLift + sink * 0.8;
      figure.pose({
        riderRight: sled.riderRight,
        riderAft: sled.riderAft,
        lean: sled.lean,
        steer: sled.steer,
        airborne: sled.airborne,
        landing: sled.landing,
      });
      bars.rotation.y = sled.steer * 0.42;
      merged.update();
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
