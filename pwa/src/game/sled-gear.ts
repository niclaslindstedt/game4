// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUNNING GEAR AS DRAWN — everything under a machine that moves with
// the snow: the skis on their spindles and the front suspension that
// carries them, and the belt on its rear suspension. Built in the body
// frame off the machine's own spec (where the physics' probes are) and its
// traced look (`sled-looks.ts`: where the idler, the drive and the upper run
// of the belt are), and posed each frame off the engine's own readings — each
// ski's compression and `skiAngle`, the rear's compression.
//
// It is DETAILED on purpose: the running gear is what a sled is recognised
// by from behind and from the side at chase range, and the reference
// photographs are all suspension. So at each ski an upper and a lower
// A-ARM, a COIL-OVER from the lower arm up to the chassis, a TIE ROD from
// the steering arm, the SPINDLE and the ski with its loop handle; and at the
// rear the BELT as a loop — along the snow, up round the drive, back along
// its upper run and round the rear IDLER — with its lugs standing all the
// way round (a mountain sled's paddles show behind the seat), the SKID RAILS
// inside it on their BOGIE WHEELS, the front and rear ARMS up to the tunnel
// and a CENTRE COIL-OVER. The arms and shocks are struts re-laid every
// frame between the chassis and the moving parts, so they visibly work.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SledSpec, SledState } from "@engine";

import { lookFrame, type SledLook } from "./sled-looks.ts";

/** Rest compression of either end, m — the sag the drawn skis and tread sit
 * at when the engine reports it (the spec's "about 8 cm"). */
export const REST_SAG = 0.08;

/** How far the drawn skis and the tread move off their rest, m: the droop
 * (negative) and the bump either end is drawn through, whatever the engine
 * reports. A modelled machine's clips run the same travel (`make blender`). */
export const TRAVEL = { ski: [-0.12, 0.2], tread: [-0.12, 0.25] } as const;

/** The bars' turn about the post at full steer, rad. */
export const BAR_TURN = 0.42;

const clamp = (v: number, [lo, hi]: readonly [number, number]): number =>
  Math.max(lo, Math.min(hi, v));

/** Each ski's and the tread's lift off the rest, m, as drawn: the engine's
 * compression less the rest sag, held to the drawn travel. */
export function gearLift(sled: SledState): { ski: [number, number]; tread: number } {
  return {
    ski: [
      clamp(sled.skiCompression[0] - REST_SAG, TRAVEL.ski),
      clamp(sled.skiCompression[1] - REST_SAG, TRAVEL.ski),
    ],
    tread: clamp(sled.treadCompression - REST_SAG, TRAVEL.tread),
  };
}

type P = [number, number];

/** A side profile in the body's (z, y) plane, extruded `width` across x and
 * centred on x = `at`. */
export function profile(points: P[], width: number, bevel: number, at = 0): THREE.ExtrudeGeometry {
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
  g.translate((width - 2 * bevel) / 2 + at, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** A polyline thickened into a closed strip `t` m thick, below it. */
export function strip(points: P[], t: number): P[] {
  return [...points, ...[...points].reverse().map(([z, y]): P => [z, y - t])];
}

export type GearParts = {
  add: (g: THREE.BufferGeometry, m: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh;
  keep: (g: THREE.BufferGeometry) => void;
  paint: THREE.Material;
  black: THREE.Material;
  rubber: THREE.Material;
  alloy: THREE.Material;
  spring: THREE.Material;
};

export type Gear = {
  pose(sled: SledState, sink: number): void;
};

const Y = new THREE.Vector3(0, 1, 0);

/** Lay a unit-length cylinder (along +y) between two points. */
function lay(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, d: THREE.Vector3) {
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  d.copy(to).sub(from);
  const l = d.length();
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(l || 1));
  mesh.scale.set(1, l, 1);
}

export function buildGear(
  spec: SledSpec,
  look: SledLook,
  root: THREE.Group,
  parts: GearParts,
): Gear {
  const { add, keep, black, rubber, alloy, spring } = parts;
  const F = lookFrame(spec, look);
  const ground = -spec.cogHeight;
  const rod = (r: number, m: THREE.Material) => add(new THREE.CylinderGeometry(r, r, 1, 6), m);
  /** A coil-over: the damper body and the spring round its upper half. */
  const coilOver = (r: number) => ({ body: rod(r, alloy), coil: rod(r * 2, spring) });

  // ── THE SKIS ───────────────────────────────────────────────────────────
  // The traced ski, stood on its own centre (the spindle's foot) and on
  // the snow: its bottom line and the tip's rise, thickened upward.
  const skiAt = look.spindle[0][0];
  const skiLine = look.ski.map(([z, y]): P => [z - skiAt, Math.max(0, y)]);
  const skiGeo = profile(
    [...skiLine, ...[...skiLine].reverse().map(([z, y]): P => [z, y + 0.045])],
    spec.skiWidth,
    0.01,
  );
  keep(skiGeo);
  const tipZ = skiLine[skiLine.length - 2][0];
  const spindleTop = look.spindle[1][1];
  type Ski = {
    group: THREE.Group;
    upper: THREE.Mesh;
    lower: THREE.Mesh;
    tie: THREE.Mesh;
    shock: { body: THREE.Mesh; coil: THREE.Mesh };
  };
  const skis: Ski[] = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set((side * spec.skiStance) / 2, ground, spec.skiForward);
    root.add(group);
    const ski = new THREE.Mesh(skiGeo, black);
    ski.castShadow = true;
    group.add(ski);
    // The loop handle over the tip, the reference skis' tell.
    const loop = add(new THREE.TorusGeometry(0.1, 0.013, 5, 10, Math.PI), black, group);
    loop.rotation.set(0, Math.PI / 2, 0);
    loop.position.set(0, 0.05, tipZ - 0.02);
    loop.scale.set(1, 1.2, 1);
    // The spindle, up from the ski to the top of the knuckle.
    const spindle = add(new THREE.CylinderGeometry(0.028, 0.034, spindleTop, 6), alloy, group);
    spindle.position.set(0, spindleTop / 2 + 0.03, 0.02);
    // The steering arm off the knuckle, toward the machine's middle.
    const arm = add(new THREE.BoxGeometry(0.1, 0.02, 0.03), alloy, group);
    arm.position.set(-side * 0.05, spindleTop * 0.55, -0.07);
    skis.push({
      group,
      upper: rod(0.015, alloy),
      lower: rod(0.017, alloy),
      tie: rod(0.01, alloy),
      shock: coilOver(0.02),
    });
  }

  // ── THE BELT, THE RAILS AND THE WHEELS (on the rear suspension) ────────
  const tread = new THREE.Group();
  root.add(tread);
  const tf = spec.treadFront;
  const idler = F.point(look.idler.at);
  const ir = look.idler.radius;
  const drive = F.point(look.sprocket.at);
  const dr = look.sprocket.radius;
  const up = look.trackUp.map((p) => F.point(p));
  // THE LOOP, as a path along the belt's inner face: along the snow from
  // the rear idler to the front of the run, up to the drive, round it, back
  // along the upper run (the traced line), and round the idler. The belt
  // is laid as a ribbon of short slabs along it, and a lug stands off it
  // every pitch — so the loop is a loop, open inside, with the rails and
  // wheels showing through it.
  const path: THREE.Vector2[] = [];
  const arc = (cz: number, cy: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      path.push(new THREE.Vector2(cz + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  const base = ground + 0.012;
  path.push(new THREE.Vector2(idler[0], base));
  path.push(new THREE.Vector2(tf, base));
  // Up the front of the run to the underside of the drive.
  path.push(new THREE.Vector2((tf + drive[0]) / 2 + 0.05, (base + drive[1] - dr) / 2));
  arc(drive[0], drive[1], dr, -Math.PI / 2, Math.PI * 0.75, 5);
  for (const p of [...up].reverse()) {
    if (p[0] > idler[0] && p[0] < drive[0]) path.push(new THREE.Vector2(p[0], p[1]));
  }
  arc(idler[0], idler[1], ir, Math.PI / 2, Math.PI * 1.5, 6);
  const slabs: THREE.BufferGeometry[] = [];
  const lugs: THREE.BufferGeometry[] = [];
  const w = spec.treadWidth;
  const pitch = 0.1;
  let carry = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const dz = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dz, dy);
    if (l < 1e-4) continue;
    const ang = Math.atan2(dy, dz);
    // Outward is to the right of the travel round the loop, which runs
    // clockwise seen from the machine's right.
    const oz = dy / l;
    const oy = -dz / l;
    const slab = new THREE.BoxGeometry(w, 0.022, l + 0.004);
    slab.rotateX(-ang);
    slab.translate(0, (a.y + b.y) / 2, (a.x + b.x) / 2);
    slabs.push(slab);
    for (let s = carry; s < l; s += pitch) {
      const lug = new THREE.BoxGeometry(w * 0.94, spec.lugHeight, 0.03);
      lug.translate(0, spec.lugHeight / 2 + 0.011, 0);
      lug.rotateX(-ang + Math.PI);
      const z = a.x + (dz * s) / l + oz * 0.005;
      const y = a.y + (dy * s) / l + oy * 0.005;
      lug.translate(0, y, z);
      lugs.push(lug);
    }
    carry = (((carry - l) % pitch) + pitch) % pitch;
  }
  add(mergeGeometries(slabs), rubber, tread);
  add(mergeGeometries(lugs), rubber, tread);
  for (const g of [...slabs, ...lugs]) g.dispose();

  // The skid rails, inside the belt either side, and the wheels they carry:
  // the rear idlers at the traced size, bogie wheels along the rails, a small
  // idler at the front of the run. Tyres black, hubs bright.
  const railY = base + 0.07;
  const railX = w * 0.32;
  const railLen = tf - idler[0];
  for (const side of [-1, 1]) {
    const rail = add(new THREE.BoxGeometry(0.018, 0.05, railLen), alloy, tread);
    rail.position.set(side * railX, railY, (tf + idler[0]) / 2);
  }
  const wheel = (z: number, y: number, r: number) => {
    for (const side of [-1, 1]) {
      const tyre = add(new THREE.CylinderGeometry(r, r, 0.05, 12), black, tread);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(side * (railX + 0.035), y, z);
      const hub = add(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.056, 8), alloy, tread);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(tyre.position);
    }
  };
  wheel(idler[0], idler[1], ir);
  const bogies = Math.max(2, Math.round(railLen / 0.42));
  for (let i = 1; i <= bogies; i++) {
    const z = idler[0] + (railLen * i) / (bogies + 1);
    wheel(z, base + 0.07, 0.065);
  }
  wheel(tf - 0.05, base + 0.09, 0.055);
  wheel(drive[0], drive[1], dr * 0.8);

  // The arms and the centre coil-over, from the rails up to the tunnel.
  const frontArm = [rod(0.018, alloy), rod(0.018, alloy)];
  const rearArm = [rod(0.018, alloy), rod(0.018, alloy)];
  const centre = coilOver(0.024);
  const rearShock = coilOver(0.02);
  const tunnelUnder = (z: number): number => {
    const pts = look.tunnelBottom.map((p) => F.point(p));
    if (z <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (z <= pts[i][0]) {
        const t = (z - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  };
  const frontTop = tf - 0.12;
  const rearTop = idler[0] + railLen * 0.52;
  const centreTop = tf - 0.28;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  const shock = (
    s: { body: THREE.Mesh; coil: THREE.Mesh },
    from: THREE.Vector3,
    to: THREE.Vector3,
  ) => {
    lay(s.body, from, to, d);
    c.copy(from).lerp(to, 0.35);
    lay(s.coil, c, to, d);
    s.coil.scale.y *= 0.9;
  };
  return {
    pose(sled, sink) {
      const lifts = gearLift(sled);
      for (let i = 0; i < 2; i++) {
        const s = skis[i];
        const lift = lifts.ski[i];
        s.group.position.y = ground + lift + sink * 0.7;
        // Clockwise from above is a positive turn about +y in the engine's
        // frame, which is three's too (`lib/quat.ts`).
        s.group.rotation.y = sled.skiAngle;
        const side = i === 0 ? -1 : 1;
        const x = (side * spec.skiStance) / 2;
        const top = s.group.position.y + spindleTop;
        const z = spec.skiForward;
        const inner = side * 0.16;
        lay(s.upper, a.set(inner, top + 0.05, z - 0.14), b.set(x, top, z), d);
        lay(s.lower, a.set(inner, top - 0.12, z + 0.02), b.set(x, top - 0.17, z), d);
        // The coil-over: from the lower arm near the knuckle, up and in to
        // the chassis over the upper arm's pivot.
        shock(
          s.shock,
          a.set(x - side * 0.1, top - 0.14, z + 0.01),
          b.set(side * 0.2, top + 0.2, z - 0.05),
        );
        // The tie rod: from the steering arm, which turns with the ski,
        // to the steering column's drop arm in the middle.
        const k = Math.cos(sled.skiAngle);
        const n = Math.sin(sled.skiAngle);
        const ax = -side * 0.1;
        const az = -0.07;
        lay(
          s.tie,
          a.set(x + ax * k + az * n, top - 0.06, z - ax * n + az * k),
          b.set(side * 0.06, top - 0.04, z - 0.1),
          d,
        );
      }
      const rearLift = lifts.tread;
      tread.position.y = rearLift + sink * 0.8;
      const ty = tread.position.y;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const x = side * (railX - 0.03);
        lay(
          frontArm[i],
          a.set(x, railY + ty, tf - 0.32),
          b.set(x, tunnelUnder(frontTop), frontTop),
          d,
        );
        lay(
          rearArm[i],
          a.set(x, railY + ty, idler[0] + 0.12),
          b.set(x, tunnelUnder(rearTop), rearTop),
          d,
        );
      }
      shock(
        centre,
        a.set(0, railY + ty + 0.02, idler[0] + railLen * 0.45),
        b.set(0, tunnelUnder(centreTop) - 0.02, centreTop),
      );
      shock(
        rearShock,
        a.set(0, railY + ty + 0.02, idler[0] + 0.1),
        b.set(0, tunnelUnder(rearTop) - 0.02, rearTop + 0.08),
      );
    },
  };
}
