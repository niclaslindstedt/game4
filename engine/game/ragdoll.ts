// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAGDOLL — the rider's body once he is off the sled (`crash.ts`).
//
// Thirteen POINTS — the two hips, the two shoulders, the head, the knees,
// the feet, the elbows, the hands — each with a mass and a radius
// (`TUNING.crash.body`), moved by Verlet (a point's velocity is where it is
// less where it was a step ago) under gravity, and held together by what a
// body is:
//   - the TORSO rigid — the hips, the shoulders and the head held at every
//     distance between them, so the trunk and the head move as one piece;
//   - the LIMBS two bones each at their own lengths, hung off the hips and
//     the shoulders, free to swing but not through what a joint allows: a
//     knee bends only forward, a thigh goes only so far back or up, a leg
//     only so far out or across, an arm never folds its hand into its
//     shoulder.
// A light point is moved more than a heavy one by a joint pulled long, so
// the trunk carries the limbs and not the other way round.
//
// THE SNOW meets every point on its own — the thing that makes a ragdoll
// lie down: a point below the surface (settled into powder by `sink` at the
// run's snow dial) is put back on it, its way into it gone; along it,
// Coulomb friction on the weight it bears and on the arrival, harder in
// powder; and the PLOUGH, the powder a buried point has to shove, taking a
// share of its way every second in proportion to how deep the snow is. A
// body going over and over drags its arms and legs through the snow on
// every turn and is stopped by it; in deep powder, at once. A TRUNK meets
// every point too, pushed out of it along the line of centres.
//
// None of it draws from the stream and none of it is random: the body is a
// pure function of the moment it left the sled, so a run replays crash for
// crash and a ghost falls where the rider did.

import { clamp, hypot, hypot3 } from "../lib/math.ts";
import { rotate, type Quat, type Vec3 } from "../lib/quat.ts";
import { TUNING } from "./defs/tuning.ts";
import { treesNear } from "./collision.ts";
import { depthUnder, packedUnder } from "./snow.ts";
import type { GameState, Thrown } from "./state.ts";

const K = TUNING.crash;
const B = K.body;
const dt = TUNING.dt;

/** The body's points, in the order `Thrown.points` keeps them (x y z each). */
export const RAGDOLL = {
  hipL: 0,
  hipR: 1,
  shoulderL: 2,
  shoulderR: 3,
  head: 4,
  kneeL: 5,
  kneeR: 6,
  footL: 7,
  footR: 8,
  elbowL: 9,
  elbowR: 10,
  handL: 11,
  handR: 12,
  count: 13,
} as const;

const N = RAGDOLL.count;
const M = B.mass;
const MASS: number[] = [
  M.hip,
  M.hip,
  M.shoulder,
  M.shoulder,
  M.head,
  M.knee,
  M.knee,
  M.foot,
  M.foot,
];
MASS.push(M.elbow, M.elbow, M.hand, M.hand);
const W = MASS.map((m) => 1 / m);
const TOTAL = MASS.reduce((a, m) => a + m, 0);
const RADIUS: number[] = [K.radius, K.radius, K.radius, K.radius, B.head];
for (let i = 5; i < N; i++) RADIUS.push(B.limb);

/** The torso and the head in the torso's own frame (x right, y up the
 * spine, z out of the chest; the origin between the hips). */
const TORSO: Vec3[] = [
  { x: -B.hip, y: 0, z: 0 },
  { x: B.hip, y: 0, z: 0 },
  { x: -B.shoulder, y: B.spine, z: 0 },
  { x: B.shoulder, y: B.spine, z: 0 },
  { x: 0, y: B.spine + B.neck, z: 0.02 },
];

/** Every distance the body holds: point, point, length. */
const LINKS: number[] = [];
for (let i = 0; i < TORSO.length; i++) {
  for (let j = i + 1; j < TORSO.length; j++) {
    const a = TORSO[i];
    const b = TORSO[j];
    LINKS.push(i, j, hypot3(a.x - b.x, a.y - b.y, a.z - b.z));
  }
}
const R = RAGDOLL;
LINKS.push(R.hipL, R.kneeL, B.thigh, R.hipR, R.kneeR, B.thigh);
LINKS.push(R.kneeL, R.footL, B.shin, R.kneeR, R.footR, B.shin);
LINKS.push(R.shoulderL, R.elbowL, B.upperArm, R.shoulderR, R.elbowR, B.upperArm);
LINKS.push(R.elbowL, R.handL, B.forearm, R.elbowR, R.handR, B.forearm);

/** The body as it sits the sled half standing, in the sled's frame (x
 * right, y up, z forward, the origin at the centre of gravity): the hips
 * over the seat, the trunk pitched over the bars, the hands on the grips
 * and the feet on the boards — where the figure is drawn at the moment of
 * the blow, near enough that the throw does not jump. */
const PITCH = 0.55;
const HIPS: Vec3 = { x: 0, y: 0.5, z: -0.33 };
const SEATED: Vec3[] = (() => {
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const out = TORSO.map((p) => ({
    x: HIPS.x + p.x,
    y: HIPS.y + p.y * c - p.z * s,
    z: HIPS.z + p.y * s + p.z * c,
  }));
  for (const side of [-1, 1]) out.push({ x: side * 0.25, y: 0.14, z: -0.02 });
  for (const side of [-1, 1]) out.push({ x: side * 0.28, y: -0.22, z: -0.2 });
  for (const side of [-1, 1]) out.push({ x: side * 0.4, y: 0.64, z: 0.05 });
  for (const side of [-1, 1]) out.push({ x: side * 0.4, y: 0.47, z: 0.28 });
  return out;
})();

/** Lay the body on the sled at `q`, (`x`, `y`, `z`), and send it off at
 * `v` m/s turning at `w` rad/s (world frame) about its centre of mass. */
export function throwBody(
  q: Quat,
  x: number,
  y: number,
  z: number,
  v: Vec3,
  w: Vec3,
): { points: number[]; last: number[] } {
  const points: number[] = [];
  for (const p of SEATED) {
    const r = rotate(q, p);
    points.push(x + r.x, y + r.y, z + r.z);
  }
  // Settle the joints to their lengths before anything moves.
  for (let k = 0; k < 16; k++) holdLinks(points);
  const com = centreOf(points);
  const last: number[] = [];
  for (let i = 0; i < N; i++) {
    const rx = points[3 * i] - com.x;
    const ry = points[3 * i + 1] - com.y;
    const rz = points[3 * i + 2] - com.z;
    last.push(
      points[3 * i] - (v.x + w.y * rz - w.z * ry) * dt,
      points[3 * i + 1] - (v.y + w.z * rx - w.x * rz) * dt,
      points[3 * i + 2] - (v.z + w.x * ry - w.y * rx) * dt,
    );
  }
  return { points, last };
}

/** The body's centre of mass. */
export function centreOf(p: readonly number[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < N; i++) {
    x += p[3 * i] * MASS[i];
    y += p[3 * i + 1] * MASS[i];
    z += p[3 * i + 2] * MASS[i];
  }
  return { x: x / TOTAL, y: y / TOTAL, z: z / TOTAL };
}

// Scratch, per point: the floor under it, its powder, the snow's normal,
// how far the snow has pushed it up this step and how fast it came in.
const floor = new Float64Array(N);
const soft = new Float64Array(N);
const packed = new Float64Array(N);
const pushed = new Float64Array(N);
const arrive = new Float64Array(N);
const nx = new Float64Array(N);
const ny = new Float64Array(N);
const nz = new Float64Array(N);
const n: Vec3 = { x: 0, y: 1, z: 0 };
const near: number[] = [];

/** One step of the body: gravity, the joints, the snow, the trunks. Keeps
 * `b`'s centre, velocity, tumble, `touching` and `still` up to date. */
export function stepRagdoll(state: GameState, b: Thrown): void {
  const level = state.level;
  const P = b.points;
  const L = b.last;
  const spine0 = spineOf(P);
  const g = TUNING.g * dt * dt;
  for (let i = 0; i < 3 * N; i++) {
    const v = P[i] - L[i];
    L[i] = P[i];
    P[i] += v;
  }
  for (let i = 0; i < N; i++) P[3 * i + 1] -= g;
  // The snow under each point, read once a step: it moves a hand's width.
  const depth = depthUnder(state.snowDepth, state.fresh);
  for (let i = 0; i < N; i++) {
    const x = P[3 * i];
    const z = P[3 * i + 2];
    const p = packedUnder(level.packedAt(x, z), state.fresh);
    packed[i] = p;
    soft[i] = (1 - p) * depth;
    floor[i] = level.groundAt(x, z) - K.sink * soft[i] + RADIUS[i];
    level.normalAt(x, z, n);
    nx[i] = n.x;
    ny[i] = n.y;
    nz[i] = n.z;
    pushed[i] = 0;
    // The way into the snow it brings to this step, m/s — what the
    // arrival adds to the weight it bears.
    const j = 3 * i;
    arrive[i] = Math.max(
      0,
      -((P[j] - L[j]) * n.x + (P[j + 1] - L[j + 1]) * n.y + (P[j + 2] - L[j + 2]) * n.z) / dt,
    );
  }
  const com0 = centreOf(P);
  treesNear(level, com0.x, com0.z, 2, near);
  const lo = TUNING.bounds.margin;
  const hi = level.size - TUNING.bounds.margin;
  for (let k = 0; k < K.iterations; k++) {
    holdLinks(P);
    holdJoints(P);
    for (let i = 0; i < N; i++) {
      const j = 3 * i;
      P[j] = clamp(P[j], lo, hi);
      P[j + 2] = clamp(P[j + 2], lo, hi);
      for (const t of near) {
        const tree = level.trees[t];
        if (P[j + 1] > tree.y + tree.height) continue;
        const dx = P[j] - tree.x;
        const dz = P[j + 2] - tree.z;
        const d = hypot(dx, dz) || 1e-6;
        const reach = RADIUS[i] + tree.radius;
        if (d >= reach) continue;
        P[j] = tree.x + (dx / d) * reach;
        P[j + 2] = tree.z + (dz / d) * reach;
      }
      if (P[j + 1] < floor[i]) {
        pushed[i] += floor[i] - P[j + 1];
        P[j + 1] = floor[i];
      }
    }
  }
  // Along the snow: what every point on it loses of its way.
  let touching = false;
  let fastest = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    let vx = (P[j] - L[j]) / dt;
    let vy = (P[j + 1] - L[j + 1]) / dt;
    let vz = (P[j + 2] - L[j + 2]) / dt;
    if (pushed[i] > 0) {
      touching = true;
      const un = vx * nx[i] + vy * ny[i] + vz * nz[i];
      const into = Math.min(0, un);
      vx -= into * nx[i];
      vy -= into * ny[i];
      vz -= into * nz[i];
      const along = vx * nx[i] + vy * ny[i] + vz * nz[i];
      const tx = vx - along * nx[i];
      const ty = vy - along * ny[i];
      const tz = vz - along * nz[i];
      const slide = hypot3(tx, ty, tz);
      if (slide > 1e-9) {
        const mu = K.frictionPacked * packed[i] + K.frictionPowder * (1 - packed[i]);
        // Every point on the snow bears its own weight and its own arrival,
        // so a body sliding flat slows as one piece rather than being
        // twisted round by whichever point the joints happened to press.
        const coulomb = Math.min(slide, mu * Math.max(TUNING.g * ny[i] * dt, arrive[i]));
        const plough = (slide - coulomb) * Math.min(1, K.plough * soft[i] * dt);
        const s = (coulomb + plough) / slide;
        vx -= tx * s;
        vy -= ty * s;
        vz -= tz * s;
      }
      L[j] = P[j] - vx * dt;
      L[j + 1] = P[j + 1] - vy * dt;
      L[j + 2] = P[j + 2] - vz * dt;
    }
    fastest = Math.max(fastest, hypot3(vx, vy, vz));
  }
  const com = centreOf(P);
  const was = centreOf(L);
  b.x = com.x;
  b.y = com.y;
  b.z = com.z;
  b.vx = (com.x - was.x) / dt;
  b.vy = (com.y - was.y) / dt;
  b.vz = (com.z - was.z) / dt;
  const spine1 = spineOf(P);
  b.tumble += Math.acos(clamp(dot(spine0, spine1), -1, 1));
  b.touching = touching;
  b.still = touching && fastest < K.restSpeed ? b.still + dt : 0;
}

/** Every distance the body holds, each pulled back to its length — the
 * lighter end moved the more. */
function holdLinks(P: number[]): void {
  for (let k = 0; k < LINKS.length; k += 3) {
    const i = 3 * LINKS[k];
    const j = 3 * LINKS[k + 1];
    const dx = P[j] - P[i];
    const dy = P[j + 1] - P[i + 1];
    const dz = P[j + 2] - P[i + 2];
    const d = hypot3(dx, dy, dz) || 1e-9;
    const wi = W[LINKS[k]];
    const wj = W[LINKS[k + 1]];
    const s = (d - LINKS[k + 2]) / d / (wi + wj);
    P[i] += dx * s * wi;
    P[i + 1] += dy * s * wi;
    P[i + 2] += dz * s * wi;
    P[j] -= dx * s * wj;
    P[j + 1] -= dy * s * wj;
    P[j + 2] -= dz * s * wj;
  }
}

const across: Vec3 = { x: 1, y: 0, z: 0 };
const up: Vec3 = { x: 0, y: 1, z: 0 };
const chest: Vec3 = { x: 0, y: 0, z: 1 };
const bend: Vec3 = { x: 0, y: 0, z: 1 };
const fold: Vec3 = { x: 0, y: 0, z: 1 };

/** What the joints will not do: a knee bent backwards is folded forwards,
 * a thigh past its reach brought back inside it, a hand folded into its
 * shoulder pushed out. */
function holdJoints(P: number[]): void {
  frameOf(P);
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    const hip = 3 * (R.hipL + s);
    const knee = 3 * (R.kneeL + s);
    const foot = 3 * (R.footL + s);
    // The knee bends forward only: one bent the other way, off the line
    // from the hip to the foot, is brought back onto it — measured against
    // the chest square to that line, so a leg raised along the chest is
    // never turned inside out.
    const lx = P[foot] - P[hip];
    const ly = P[foot + 1] - P[hip + 1];
    const lz = P[foot + 2] - P[hip + 2];
    const ll = lx * lx + ly * ly + lz * lz || 1e-9;
    const cl = (chest.x * lx + chest.y * ly + chest.z * lz) / ll;
    unit(bend, chest.x - cl * lx, chest.y - cl * ly, chest.z - cl * lz);
    const back =
      (P[knee] - (P[hip] + P[foot]) / 2) * bend.x +
      (P[knee + 1] - (P[hip + 1] + P[foot + 1]) / 2) * bend.y +
      (P[knee + 2] - (P[hip + 2] + P[foot + 2]) / 2) * bend.z;
    if (back < 0) shift(P, R.kneeL + s, R.hipL + s, R.footL + s, bend, -back);
    // The thigh: not far behind the hip, not far above it, not splayed out
    // past the splits nor crossed far over the other leg.
    const tx = P[knee] - P[hip];
    const ty = P[knee + 1] - P[hip + 1];
    const tz = P[knee + 2] - P[hip + 2];
    const fore = tx * chest.x + ty * chest.y + tz * chest.z;
    if (fore < -K.hipBack * B.thigh)
      shift(P, knee / 3, hip / 3, -1, chest, -K.hipBack * B.thigh - fore);
    const rise = tx * up.x + ty * up.y + tz * up.z;
    if (rise > K.hipUp * B.thigh) shift(P, knee / 3, hip / 3, -1, up, K.hipUp * B.thigh - rise);
    const out = side * (tx * across.x + ty * across.y + tz * across.z);
    if (out > 0.75 * B.thigh)
      shift(P, knee / 3, hip / 3, -1, across, side * (0.75 * B.thigh - out));
    if (out < -0.25 * B.thigh)
      shift(P, knee / 3, hip / 3, -1, across, side * (-0.25 * B.thigh - out));
    // The hand never folded into its shoulder.
    const shoulder = 3 * (R.shoulderL + s);
    const hand = 3 * (R.handL + s);
    const hx = P[hand] - P[shoulder];
    const hy = P[hand + 1] - P[shoulder + 1];
    const hz = P[hand + 2] - P[shoulder + 2];
    const reach = hypot3(hx, hy, hz) || 1e-9;
    if (reach < K.foldArm) {
      unit(fold, hx, hy, hz);
      shift(P, R.handL + s, R.shoulderL + s, -1, fold, K.foldArm - reach);
    }
  }
}

/** Move point `i` by `by` m along `d` against point `j` (and `k`, unless
 * -1) — the push shared by mass, so a joint's limit turns the body without
 * shoving it anywhere. */
function shift(P: number[], i: number, j: number, k: number, d: Vec3, by: number): void {
  const wi = W[i];
  const wj = k < 0 ? W[j] : 1 / (MASS[j] + MASS[k]);
  const a = (by * wi) / (wi + wj);
  const b = by - a;
  for (const [p, m] of [
    [i, a],
    [j, -b],
    [k, -b],
  ]) {
    if (p < 0) continue;
    P[3 * p] += d.x * m;
    P[3 * p + 1] += d.y * m;
    P[3 * p + 2] += d.z * m;
  }
}

/** The pelvis's frame into `across`, `up` and `chest` (x × y = z). */
function frameOf(P: number[]): void {
  const hl = 3 * R.hipL;
  const hr = 3 * R.hipR;
  const sl = 3 * R.shoulderL;
  const sr = 3 * R.shoulderR;
  unit(across, P[hr] - P[hl], P[hr + 1] - P[hl + 1], P[hr + 2] - P[hl + 2]);
  unit(
    up,
    (P[sl] + P[sr] - P[hl] - P[hr]) / 2,
    (P[sl + 1] + P[sr + 1] - P[hl + 1] - P[hr + 1]) / 2,
    (P[sl + 2] + P[sr + 2] - P[hl + 2] - P[hr + 2]) / 2,
  );
  unit(
    chest,
    across.y * up.z - across.z * up.y,
    across.z * up.x - across.x * up.z,
    across.x * up.y - across.y * up.x,
  );
}

function unit(out: Vec3, x: number, y: number, z: number): void {
  const l = hypot3(x, y, z) || 1;
  out.x = x / l;
  out.y = y / l;
  out.z = z / l;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** The direction up his spine, from between the hips to between the
 * shoulders. */
function spineOf(P: readonly number[]): Vec3 {
  const hl = 3 * R.hipL;
  const sl = 3 * R.shoulderL;
  const out = { x: 0, y: 0, z: 0 };
  unit(
    out,
    P[sl] + P[sl + 3] - P[hl] - P[hl + 3],
    P[sl + 1] + P[sl + 4] - P[hl + 1] - P[hl + 4],
    P[sl + 2] + P[sl + 5] - P[hl + 2] - P[hl + 5],
  );
  return out;
}
