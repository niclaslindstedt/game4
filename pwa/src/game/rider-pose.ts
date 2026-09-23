// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S POSE, as arithmetic — where his hips, shoulders, hands and
// feet are in the sled's own frame (x right, y up, z forward, the origin at
// the centre of gravity) for what the engine says he is doing. `rider.ts`
// hangs the figure on these points; this module is three-free so the suite
// reads it (`tests/world_render_test.ts`).
//
// A SLED IS RIDDEN HALF STANDING. Seated, the only thing a rider can do is
// hold on; the way a snowmobile is actually ridden hard is up off the seat
// with the knees bent, the feet on the running boards and the weight moved
// about with the legs — hung off the uphill side on a sidehill, thrown
// forward up a climb, back for a landing. So the base pose is a crouch over
// the seat, and every input the engine reports moves it:
//
//   * `riderRight` / `riderAft` are where the engine has put his mass (m),
//     and the hips go there — the physics' own lag is the pose's lag;
//   * `lean` (+1 back) pitches the torso back and drops the hips toward the
//     seat, -1 throws it forward over the bars;
//   * the bars turn with `steer`, and the hands stay on the grips;
//   * in the air he stands taller, and a hard landing folds the knees;
//   * on a tricks run a POSE held in the air takes a foot off the boards
//     (`RiderInput.trick`).
//
// The limbs are two bones each, solved analytically (`solveLimb`) toward a
// pole — the knees go forward and out, the elbows out and down — so a hand
// that has to reach the far grip in a turn straightens the arm rather than
// stretching it.

import type { TrickPose } from "@engine";

export type V3 = { x: number; y: number; z: number };

/** Limb lengths and body proportions, m. */
export const BODY = {
  thigh: 0.44,
  shin: 0.46,
  upperArm: 0.3,
  forearm: 0.31,
  /** Hips to the base of the neck. */
  spine: 0.5,
  /** Half the shoulders' width, and of the hips'. */
  shoulder: 0.19,
  hip: 0.12,
  /** Base of the neck to the helmet's centre. */
  neck: 0.19,
};

/** Where the rider's hands and feet are fixed to the machine. */
export const MOUNTS = {
  /** The grips at straight bars: half the bar's width, height, and how far
   * forward. The bars turn about `pivot`. */
  grip: { x: 0.4, y: 0.47, z: 0.28 },
  pivot: { x: 0, y: 0.45, z: 0.32 },
  /** The feet on the running boards. */
  foot: { x: 0.28, y: -0.22, z: -0.2 },
  /** The hips at the base pose. */
  hips: { x: 0, y: 0.34, z: -0.42 },
};

export type RiderInput = {
  riderRight: number;
  riderAft: number;
  lean: number;
  steer: number;
  airborne: boolean;
  /** Seconds since the last landing — a fresh landing folds the knees. */
  landing: number;
  /** A TRICKS run's pose held in the air (`strokes.ts`), or none. */
  trick?: TrickPose | null;
};

export type RiderPose = {
  hips: V3;
  neck: V3;
  head: V3;
  /** Torso pitch forward, rad (positive leans toward the bars), and roll
   * toward the rider's right, rad. */
  pitch: number;
  roll: number;
  knees: [V3, V3];
  feet: [V3, V3];
  shoulders: [V3, V3];
  elbows: [V3, V3];
  hands: [V3, V3];
  /** The bars' turn, rad (positive clockwise from above). */
  bars: number;
};

function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function scale(a: V3, k: number): V3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}
function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function len(a: V3): number {
  return Math.sqrt(dot(a, a));
}
function norm(a: V3): V3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}

/**
 * TWO BONES FROM `root` TOWARD `target`: the joint between them, bent
 * toward `pole`. Lengths `a` and `b`. A target out of reach is reached for
 * along the same line, fully extended.
 */
export function solveLimb(root: V3, target: V3, a: number, b: number, pole: V3): V3 {
  const span = sub(target, root);
  const d0 = len(span);
  const dir = d0 > 1e-6 ? scale(span, 1 / d0) : { x: 0, y: -1, z: 0 };
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const along = (a * a - b * b + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, a * a - along * along));
  let p = sub(pole, scale(dir, dot(pole, dir)));
  if (len(p) < 1e-6) p = { x: 0, y: 1, z: 0 };
  p = norm(p);
  return add(add(root, scale(dir, along)), scale(p, up));
}

/** The grip on `side` (-1 left, +1 right) with the bars turned `bars` rad. */
export function gripAt(side: number, bars: number): V3 {
  const g = MOUNTS.grip;
  const pv = MOUNTS.pivot;
  // Turned about the vertical through the pivot; positive is clockwise
  // from above, which carries the right grip back.
  const x = side * g.x;
  const z = g.z - pv.z;
  const c = Math.cos(bars);
  const s = Math.sin(bars);
  return { x: pv.x + x * c + z * s, y: g.y, z: pv.z - x * s + z * c };
}

/**
 * THE RIDER THROWN — a sprawl, in the frame of his own body rather than the
 * sled's: the origin at his centre (`Thrown`'s point, `crash.ts`), y along
 * his spine from the hips to the head, z out of his chest. The renderer
 * turns this frame by the tumble and the bearing he was thrown along, so
 * what is decided here is only what his limbs are doing: flung wide and
 * windmilling while he is going over and over (`flail` 1), and settling
 * spread-eagle as he comes to rest (`flail` 0). `phase` is his own clock,
 * s, so the windmill is a pure function of how long he has been off.
 */
export function sprawlPose(phase: number, flail: number): RiderPose {
  const f = Math.max(0, Math.min(1, flail));
  const hips: V3 = { x: 0, y: -0.25, z: 0 };
  const neck = add(hips, { x: 0, y: BODY.spine, z: 0 });
  const head = add(neck, { x: 0, y: BODY.neck, z: 0.02 });
  const across: V3 = { x: 1, y: 0, z: 0 };
  const w = phase * 9;
  const shoulders = [-1, 1].map((side) => add(neck, scale(across, side * BODY.shoulder))) as [
    V3,
    V3,
  ];
  // The arms flung out past the shoulders and windmilling fore and aft, a
  // little short of straight so the elbow still has somewhere to bend.
  const reach = 0.9 * (BODY.upperArm + BODY.forearm);
  const hands = [-1, 1].map((side, i) => {
    const swing = f * Math.sin(w + i * 2.1);
    const out = norm({
      x: side * (0.42 + 0.1 * f),
      y: 0.18 + 0.25 * swing,
      z: 0.1 + 0.3 * f * Math.cos(w + i * 2.1),
    });
    return add(shoulders[i], scale(out, reach));
  }) as [V3, V3];
  const elbows = [-1, 1].map((side, i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, { x: side, y: -0.3, z: -0.4 }),
  ) as [V3, V3];
  // The legs apart, kicking against each other.
  const feet = [-1, 1].map((side, i) => ({
    x: side * (0.24 + 0.08 * f),
    y: hips.y - 0.82,
    z: 0.08 + 0.3 * f * Math.sin(w * 0.8 + i * Math.PI),
  })) as [V3, V3];
  const knees = [-1, 1].map((side, i) =>
    solveLimb(add(hips, scale(across, side * BODY.hip)), feet[i], BODY.thigh, BODY.shin, {
      x: side * 0.3,
      y: 0,
      z: 1,
    }),
  ) as [V3, V3];
  return { hips, neck, head, pitch: 0, roll: 0, knees, feet, shoulders, elbows, hands, bars: 0 };
}

/** THE WHOLE POSE for one frame. */
export function riderPose(input: RiderInput): RiderPose {
  const lean = Math.max(-1, Math.min(1, input.lean));
  const bars = input.steer * 0.42;
  // A fresh landing takes it in the knees, over a third of a second.
  const absorb = input.airborne ? 0 : Math.max(0, 1 - input.landing / 0.35) * 0.12;
  const stand = input.airborne ? 0.06 : 0;
  const hips: V3 = {
    x: MOUNTS.hips.x + input.riderRight * 0.9,
    y: MOUNTS.hips.y - 0.05 * Math.max(0, lean) + stand - absorb,
    z: MOUNTS.hips.z - input.riderAft * 0.8 - 0.06 * lean,
  };
  const pitch = 0.62 - 0.32 * lean + absorb * 1.2;
  // Hung off into a turn, the upper body leans further in than the hips.
  const roll = input.riderRight * 1.1;
  const spineDir: V3 = {
    x: Math.sin(roll) * Math.cos(pitch),
    y: Math.cos(roll) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  const neck = add(hips, scale(norm(spineDir), BODY.spine));
  const head = add(
    neck,
    scale(norm({ x: spineDir.x * 0.5, y: 1, z: spineDir.z * 0.4 }), BODY.neck),
  );
  // The right-hand direction of the torso, flattened.
  const across: V3 = norm({ x: Math.cos(roll), y: -Math.sin(roll), z: 0 });

  const feet: [V3, V3] = [-1, 1].map((side) => ({
    x: side * MOUNTS.foot.x,
    y: MOUNTS.foot.y,
    z: MOUNTS.foot.z,
  })) as [V3, V3];
  // THE POSES, the hands still on the grips: a foot off the right-hand
  // board and kicked out to the side; the right leg swung over the seat to
  // the left; or both knees drawn up to the bars.
  if (input.trick === "oneFoot") feet[1] = { x: 0.8, y: MOUNTS.foot.y + 0.3, z: -0.35 };
  else if (input.trick === "canCan") feet[1] = { x: -0.62, y: MOUNTS.foot.y + 0.42, z: 0.12 };
  else if (input.trick === "tuck") {
    for (let i = 0; i < 2; i++) feet[i] = { x: feet[i].x * 0.7, y: hips.y - 0.18, z: 0.22 };
  }
  const knees = [-1, 1].map((side, i) =>
    solveLimb(add(hips, scale(across, side * BODY.hip)), feet[i], BODY.thigh, BODY.shin, {
      x: side * 0.35,
      y: 0.2,
      z: 1,
    }),
  ) as [V3, V3];
  const shoulders = [-1, 1].map((side) => add(neck, scale(across, side * BODY.shoulder))) as [
    V3,
    V3,
  ];
  const hands = [-1, 1].map((side) => gripAt(side, bars)) as [V3, V3];
  const elbows = [-1, 1].map((side, i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, { x: side, y: -0.6, z: -0.2 }),
  ) as [V3, V3];
  return { hips, neck, head, pitch, roll, knees, feet, shoulders, elbows, hands, bars };
}
