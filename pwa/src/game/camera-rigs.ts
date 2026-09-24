// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMERA LADDER, as data and as arithmetic. Where each lens stands
// against the sled, how heavy it is, and how it frames the snow ahead — one
// row per rung, because the difference between two cameras IS the row.
// `camera.ts` puts the answer on a three.js camera; this module is
// three-free so the suite reads it (`tests/world_render_test.ts`).
//
// Two kinds of rung. `hood` and `bars` are BOLTED ON: the lens is a point
// in the sled's own frame, and it pitches and rolls with the machine —
// which is the whole sensation of those views, a sled nodding over every
// mogul. The rest are BOOMS: a lens that stands behind the machine on a
// yaw that FOLLOWS the heading rather than copying it, and a height that is
// sprung rather than bolted, so a mogul under the sled is not a mogul under
// the lens. `orbit` is the menus' drone, flown slowly round the rider.
//
// THE SNOW IS THE DIFFERENCE FROM THE WATER GAME. A sled rides on ground
// that does not move, so the booms follow the TERRAIN'S height under the
// sled rather than a mean water line, and the chase row sits lower than a
// jet ski's: the three furrows it cuts are the thing a player looks back
// down, and a lens two metres up at five metres back is where they read.

import { rotate, type Quat } from "@engine";

export type Vec3 = { x: number; y: number; z: number };

/** What the rigs read of a rider — the interpolated pose. */
export type RigPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  airborne: boolean;
  /** Body → world (`lib/quat.ts`'s convention). */
  q: Quat;
};

/** What a rig asks of the lens this frame. `roll` is the horizon's tilt,
 * rad, right side down positive. */
export type LensPose = { eye: Vec3; target: Vec3; fov: number; roll: number };

export type BoltedRig = {
  kind: "bolted";
  /** The eye in the sled's body frame, m (x right, y up, z forward). */
  eye: Vec3;
  /** How far ahead along the body's forward axis it looks, m. */
  look: number;
  fov: number;
  fovPerSpeed: number;
  /** Share of the machine's roll the horizon keeps, 0..1. */
  rollShare: number;
};

export type BoomRig = {
  kind: "boom";
  /** Standoff behind the sled, m, and what each m/s of pace adds. */
  dist: number;
  distPerSpeed: number;
  /** Height over the sled, m. */
  height: number;
  /** Aim point ahead of the sled, m, and over it. */
  aimAhead: number;
  aimHeight: number;
  fov: number;
  fovPerSpeed: number;
  fovMax: number;
  /** How briskly the yaw follows the nose, 1/s. */
  followRate: number;
  /** Share of the travel direction (against the nose) the yaw takes. */
  slipWeight: number;
  /** How fast the lens height follows the sled's, 1/s, on the snow and in
   * the air. */
  heightFollow: number;
  heightFollowAir: number;
  /** The lens is never closer to the snow under it than this, m. */
  clearance: number;
};

export type OrbitRig = {
  kind: "orbit";
  radius: number;
  height: number;
  /** rad/s round the rider. */
  spin: number;
  fov: number;
};

export type Rig = BoltedRig | BoomRig | OrbitRig;

export type Rung = "hood" | "bars" | "chase" | "far" | "high" | "orbit";

export const RIGS: Record<Rung, Rig> = {
  // On the cowl, just behind the nose: the skis in the bottom corners and
  // the snow coming straight at the lens.
  hood: {
    kind: "bolted",
    eye: { x: 0, y: 0.48, z: 0.95 },
    look: 30,
    fov: 74,
    fovPerSpeed: 0.25,
    rollShare: 0.8,
  },
  // The rider's own eyes over the bars.
  bars: {
    kind: "bolted",
    eye: { x: 0, y: 1.02, z: -0.32 },
    look: 30,
    fov: 70,
    fovPerSpeed: 0.2,
    rollShare: 0.6,
  },
  chase: {
    kind: "boom",
    dist: 5.2,
    distPerSpeed: 0.04,
    height: 1.9,
    aimAhead: 7,
    aimHeight: 0.7,
    fov: 62,
    fovPerSpeed: 0.45,
    fovMax: 80,
    followRate: 4.2,
    slipWeight: 0.3,
    heightFollow: 6,
    heightFollowAir: 3.2,
    clearance: 0.9,
  },
  far: {
    kind: "boom",
    dist: 10,
    distPerSpeed: 0.06,
    height: 3.6,
    aimAhead: 10,
    aimHeight: 0.8,
    fov: 58,
    fovPerSpeed: 0.3,
    fovMax: 72,
    followRate: 2.6,
    slipWeight: 0.4,
    heightFollow: 3.5,
    heightFollowAir: 2.2,
    clearance: 1.4,
  },
  high: {
    kind: "boom",
    dist: 13,
    distPerSpeed: 0.05,
    height: 10,
    aimAhead: 8,
    aimHeight: 0,
    fov: 56,
    fovPerSpeed: 0.2,
    fovMax: 66,
    followRate: 2,
    slipWeight: 0.5,
    heightFollow: 2.5,
    heightFollowAir: 1.6,
    clearance: 3,
  },
  orbit: { kind: "orbit", radius: 16, height: 6, spin: 0.14, fov: 55 },
};

/** Shortest signed turn from `a` to `b`, rad. */
export function turn(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** A boom's memory between frames: the yaw it has swung to, the height it
 * has sprung to, the orbit's angle, and how far out along its arm the lens
 * is let stand (`pull`, 1 the whole arm). `fresh` asks the next frame to
 * snap rather than ease (a new run, a reset). */
export type BoomState = { yaw: number; y: number; orbit: number; pull: number; fresh: boolean };

export function createBoomState(): BoomState {
  return { yaw: 0, y: 0, orbit: 0, pull: 1, fresh: true };
}

/** WHAT THE LENS MAY NOT STAND INSIDE: the share (0..1) of the line from
 * `from` to `to` that is clear before it first runs into something solid —
 * a trunk, a crown, the arch. `camera-clear.ts` answers it for a map. */
export type LineClear = (from: Vec3, to: Vec3) => number;

/** THE ARM PULLED IN. A boom stands its lens metres behind the rider, and
 * in a wood those metres are full of spruce; a lens inside a crown is a
 * screen of green. So the arm is shortened to the first thing between the
 * rider's head and the lens — at once, because a frame inside a tree is the
 * fault — and let back out slowly, so a trunk flicking past is a dip toward
 * the rider and not a pump in and out. Never closer than `PULL_MIN` m. */
export const PULL_MIN = 1.6;
/** How briskly the arm lets back out, 1/s. */
export const PULL_RELEASE = 1.8;
/** The pivot the arm is measured from: over the saddle, at the helmet. */
export const PULL_PIVOT = 1.3;

/** One frame of `rig` behind `pose`, `dt` s after the last. `groundAt` keeps
 * the lens out of the hill. */
export function frameRig(
  rig: Rig,
  pose: RigPose,
  st: BoomState,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose {
  if (rig.kind === "bolted") {
    const off = rotate(pose.q, rig.eye);
    const eye = { x: pose.x + off.x, y: pose.y + off.y, z: pose.z + off.z };
    const fwd = rotate(pose.q, { x: 0, y: 0, z: rig.look });
    const target = { x: eye.x + fwd.x, y: eye.y + fwd.y, z: eye.z + fwd.z };
    st.yaw = pose.heading;
    st.y = pose.y;
    st.fresh = false;
    return {
      eye,
      target,
      fov: rig.fov + rig.fovPerSpeed * pose.speed,
      roll: pose.roll * rig.rollShare,
    };
  }
  if (rig.kind === "orbit") {
    st.orbit += rig.spin * dt;
    const eye = {
      x: pose.x + Math.sin(st.orbit) * rig.radius,
      y: 0,
      z: pose.z + Math.cos(st.orbit) * rig.radius,
    };
    eye.y = Math.max(pose.y + rig.height, groundAt(eye.x, eye.z) + 2);
    st.fresh = false;
    return { eye, target: { x: pose.x, y: pose.y + 0.6, z: pose.z }, fov: rig.fov, roll: 0 };
  }
  // THE BOOM. Its yaw follows a blend of the nose and the travel.
  const plan = Math.hypot(pose.vx, pose.vz);
  const travel = plan > 2 ? Math.atan2(pose.vx, pose.vz) : pose.heading;
  const want = pose.heading + turn(pose.heading, travel) * rig.slipWeight;
  const k = st.fresh ? 1 : 1 - Math.exp(-rig.followRate * dt);
  st.yaw += turn(st.yaw, want) * k;
  const hk = st.fresh
    ? 1
    : 1 - Math.exp(-(pose.airborne ? rig.heightFollowAir : rig.heightFollow) * dt);
  st.y += (pose.y - st.y) * hk;
  const snap = st.fresh;
  st.fresh = false;
  const fx = Math.sin(st.yaw);
  const fz = Math.cos(st.yaw);
  const dist = rig.dist + rig.distPerSpeed * pose.speed;
  const eye = { x: pose.x - fx * dist, y: st.y + rig.height, z: pose.z - fz * dist };
  const floor = groundAt(eye.x, eye.z) + rig.clearance;
  if (eye.y < floor) eye.y = floor;
  if (clear) pullIn(eye, pose, st, snap, dt, clear, groundAt);
  const target = {
    x: pose.x + fx * rig.aimAhead,
    y: st.y + rig.aimHeight,
    z: pose.z + fz * rig.aimAhead,
  };
  const fov = Math.min(rig.fovMax, rig.fov + rig.fovPerSpeed * pose.speed);
  return { eye, target, fov, roll: 0 };
}

/** Shorten the arm from the rider's helmet to `eye` to what is clear. */
function pullIn(
  eye: Vec3,
  pose: RigPose,
  st: BoomState,
  snap: boolean,
  dt: number,
  clear: LineClear,
  groundAt: (x: number, z: number) => number,
): void {
  const pivot = { x: pose.x, y: pose.y + PULL_PIVOT, z: pose.z };
  const len = Math.hypot(eye.x - pivot.x, eye.y - pivot.y, eye.z - pivot.z);
  if (len <= PULL_MIN) {
    st.pull = 1;
    return;
  }
  const floor = PULL_MIN / len;
  const want = Math.max(floor, Math.min(1, clear(pivot, eye)));
  const was = st.pull;
  if (snap || want < was) st.pull = want;
  else st.pull = was + (want - was) * (1 - Math.exp(-PULL_RELEASE * dt));
  if (st.pull >= 0.999) return;
  eye.x = pivot.x + (eye.x - pivot.x) * st.pull;
  eye.y = pivot.y + (eye.y - pivot.y) * st.pull;
  eye.z = pivot.z + (eye.z - pivot.z) * st.pull;
  // Drawn in along a line that may dip, the lens still keeps off the snow.
  const ground = groundAt(eye.x, eye.z) + 0.5;
  if (eye.y < ground) eye.y = ground;
}

/** THE FLOWN HAND-OVER between two rungs: `t` 0..1 through it, eased. */
export function blendLens(a: LensPose, b: LensPose, t: number): LensPose {
  const s = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const l = (p: number, q: number): number => p + (q - p) * s;
  return {
    eye: { x: l(a.eye.x, b.eye.x), y: l(a.eye.y, b.eye.y), z: l(a.eye.z, b.eye.z) },
    target: {
      x: l(a.target.x, b.target.x),
      y: l(a.target.y, b.target.y),
      z: l(a.target.z, b.target.z),
    },
    fov: l(a.fov, b.fov),
    roll: l(a.roll, b.roll),
  };
}

/** How long the hand-over between two rungs takes, s. */
export const HANDOVER = 0.6;
