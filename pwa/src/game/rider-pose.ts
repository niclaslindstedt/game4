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
//   * `stand` is how far up off the seat he is: sat down at a crawl, half
//     standing on the move (the way the photographs of a sled ridden hard
//     show it: knees bent, torso over the bars, elbows up), fully up in the
//     air, where the legs are the suspension he lands on;
//   * `riderRight` / `riderAft` are where the engine has put his mass (m),
//     and the hips go there — the physics' own lag is the pose's lag. HUNG
//     OFF into a turn, the hips go past the seat's edge and the upper body
//     further still, the head held level: the inside knee folds, the outside
//     leg braces;
//   * `lean` (+1 back) pitches the torso back and drops the hips toward the
//     seat, -1 throws it forward over the bars;
//   * `bump` is his legs taking a hit — the body lagging the machine on the
//     knees (`riderSpring`): a landing folds him down and he comes back up;
//   * the bars turn with `steer`, and the hands stay on the grips;
//   * on a tricks run a POSE held in the air takes a foot off the boards
//     (`RiderInput.trick`).
//
// The limbs are two bones each, solved analytically (`solveLimb`) toward a
// pole — the knees go forward and out, the elbows out and down — so a hand
// that has to reach the far grip in a turn straightens the arm rather than
// stretching it.

import { RAGDOLL as R, type TrickPose } from "@engine";

export type V3 = { x: number; y: number; z: number };

/** Limb lengths and body proportions, m. */
export const BODY = {
  thigh: 0.44,
  shin: 0.46,
  upperArm: 0.31,
  /** The elbow to the middle of the fist round the grip — the forearm and
   * the hand as one bone, since the hand never leaves the grip. */
  forearm: 0.34,
  /** Hips to the base of the neck. */
  spine: 0.5,
  /** Half the shoulders' width, and of the hips'. */
  shoulder: 0.2,
  hip: 0.12,
  /** Base of the neck to the helmet's centre. */
  neck: 0.18,
  /** How far the shoulder joints sit below the base of the neck, and
   * forward of it — rounded toward the bars, the way a rider holds on. */
  shoulderDrop: 0.06,
  shoulderFore: 0.03,
};

/** Where the rider's hands and feet are fixed to the machine. */
export const MOUNTS = {
  /** The grips at straight bars: half the bar's width, height, and how far
   * forward. The bars turn about `pivot`. */
  grip: { x: 0.4, y: 0.47, z: 0.28 },
  pivot: { x: 0, y: 0.45, z: 0.32 },
  /** The feet on the running boards. */
  foot: { x: 0.28, y: -0.22, z: -0.2 },
  /** The hips sat on the seat — and stood up over the boards, legs a
   * little bent, which is where they go as `stand` comes up to 1. */
  hips: { x: 0, y: 0.34, z: -0.38 },
  standHips: { x: 0, y: 0.58, z: -0.3 },
};

/** How far the hips hang past the machine's centre for every metre the
 * engine has moved his mass — the body goes further than its centre of
 * mass does, because the legs stay on the machine. */
const HANG = 1.1;
/** The upper body's roll into a turn at the engine's full reach, rad. */
const HANG_ROLL = 0.42;
/** The torso's pitch over the bars sat down and stood up, rad. */
const PITCH_SAT = 0.3;
const PITCH_STOOD = 0.72;
/** How far the shoulders turn with the bars, as a share of their turn — the
 * arm pushing the outside grip brings its shoulder round. */
const TWIST = 0.35;

export type RiderInput = {
  riderRight: number;
  riderAft: number;
  lean: number;
  steer: number;
  airborne: boolean;
  /** Seconds since the last landing — a fresh landing folds the knees when
   * no `bump` is handed in. */
  landing: number;
  /** Up off the seat, 0 (sat) … 1 (stood tall); by default half standing on
   * the snow and fully up in the air (`riderSpring` eases it). */
  stand?: number;
  /** How far his legs are folded by a hit, m — positive is the body sunk
   * toward the machine (`riderSpring`). */
  bump?: number;
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

/** A body's own frame in the world: the origin between the hips, `x`
 * across to his right, `y` up the spine, `z` out of his chest. */
export type BodyFrame = { origin: V3; x: V3; y: V3; z: V3 };

/**
 * THE RIDER THROWN — the engine's RAGDOLL (`Thrown.points`, in `RAGDOLL`'s
 * order, world frame) read as a pose: the frame of his trunk found off the
 * hips and the shoulders into `frame`, and every joint put in it, so the
 * figure is turned by the frame and hung on the joints exactly as it is on
 * the sled. Nothing is decided here — where every limb is, is the
 * physics'; the lengths are the engine's, which are `BODY`'s.
 */
export function ragdollPose(points: readonly number[], frame: BodyFrame): RiderPose {
  const at = (i: number): V3 => ({ x: points[3 * i], y: points[3 * i + 1], z: points[3 * i + 2] });
  const hipL = at(R.hipL);
  const hipR = at(R.hipR);
  const shL = at(R.shoulderL);
  const shR = at(R.shoulderR);
  const origin = scale(add(hipL, hipR), 0.5);
  const neckW = scale(add(shL, shR), 0.5);
  const y = norm(sub(neckW, origin));
  const side = sub(shR, shL);
  const x = norm(sub(side, scale(y, dot(side, y))));
  const z = { x: x.y * y.z - x.z * y.y, y: x.z * y.x - x.x * y.z, z: x.x * y.y - x.y * y.x };
  frame.origin = origin;
  frame.x = x;
  frame.y = y;
  frame.z = z;
  const local = (p: V3): V3 => {
    const d = sub(p, origin);
    return { x: dot(d, x), y: dot(d, y), z: dot(d, z) };
  };
  return {
    hips: { x: 0, y: 0, z: 0 },
    neck: local(neckW),
    head: local(at(R.head)),
    pitch: 0,
    roll: 0,
    knees: [local(at(R.kneeL)), local(at(R.kneeR))],
    feet: [local(at(R.footL)), local(at(R.footR))],
    shoulders: [local(shL), local(shR)],
    elbows: [local(at(R.elbowL)), local(at(R.elbowR))],
    hands: [local(at(R.handL)), local(at(R.handR))],
    bars: 0,
  };
}

/** THE WHOLE POSE for one frame. */
export function riderPose(input: RiderInput): RiderPose {
  const lean = Math.max(-1, Math.min(1, input.lean));
  const bars = input.steer * 0.42;
  // A fresh landing takes it in the knees — the spring's, when there is
  // one, or else a fold over a third of a second.
  const bump = input.bump ?? (input.airborne ? 0 : Math.max(0, 1 - input.landing / 0.35) * 0.12);
  const fold = Math.max(0, bump);
  const stand = Math.max(0, Math.min(1, input.stand ?? (input.airborne ? 1 : 0.6)));
  // Hung off: how far, as a share of a full hang, signed to the side.
  const hang = Math.max(-1, Math.min(1, input.riderRight / 0.3));
  const sat = MOUNTS.hips;
  const up = MOUNTS.standHips;
  const hips: V3 = {
    x: sat.x + input.riderRight * HANG,
    y:
      sat.y +
      (up.y - sat.y) * stand -
      0.05 * Math.max(0, lean) -
      0.07 * Math.abs(hang) * stand -
      bump,
    z: sat.z + (up.z - sat.z) * stand - input.riderAft * 0.8 - 0.06 * lean,
  };
  const pitch = PITCH_SAT + (PITCH_STOOD - PITCH_SAT) * stand - 0.32 * lean + fold * 1.6;
  // Hung off into a turn, the upper body leans further in than the hips.
  const roll = hang * HANG_ROLL;
  const spineDir: V3 = {
    x: Math.sin(roll) * Math.cos(pitch),
    y: Math.cos(roll) * Math.cos(pitch),
    z: Math.sin(pitch),
  };
  const neck = add(hips, scale(norm(spineDir), BODY.spine));
  // The head is held LEVEL — a rider looks at the snow ahead, not at the
  // sky his shoulders are tipped toward.
  const head = add(
    neck,
    scale(norm({ x: spineDir.x * 0.35, y: 1, z: spineDir.z * 0.55 }), BODY.neck),
  );
  // The right-hand direction of the torso: rolled with the hang and turned
  // a little with the bars.
  const twist = bars * TWIST;
  const across: V3 = norm({
    x: Math.cos(roll) * Math.cos(twist),
    y: -Math.sin(roll),
    z: -Math.cos(roll) * Math.sin(twist),
  });
  // Out of his chest, square to the spine and the shoulders.
  const spineUp = norm(spineDir);
  const chest = norm({
    x: across.y * spineUp.z - across.z * spineUp.y,
    y: across.z * spineUp.x - across.x * spineUp.z,
    z: across.x * spineUp.y - across.y * spineUp.x,
  });

  // The boots on the boards — a little forward when he is up, over the
  // balls of his feet.
  const feet: [V3, V3] = [-1, 1].map((side) => ({
    x: side * MOUNTS.foot.x,
    y: MOUNTS.foot.y,
    z: MOUNTS.foot.z + 0.08 * stand,
  })) as [V3, V3];
  // THE POSES, the hands still on the grips: a foot off the right-hand
  // board and kicked out to the side; the right leg swung over the seat to
  // the left; or both knees drawn up to the bars.
  if (input.trick === "oneFoot") feet[1] = { x: 0.8, y: MOUNTS.foot.y + 0.3, z: -0.35 };
  else if (input.trick === "canCan") feet[1] = { x: -0.62, y: MOUNTS.foot.y + 0.42, z: 0.12 };
  else if (input.trick === "tuck") {
    for (let i = 0; i < 2; i++) feet[i] = { x: feet[i].x * 0.7, y: hips.y - 0.18, z: 0.22 };
  }
  // The knees go forward and out; the INSIDE knee of a hang is thrown out
  // over its board and the outside one tucked against the seat.
  const knees = [-1, 1].map((side, i) => {
    const inside = side * hang > 0 ? Math.abs(hang) : 0;
    return solveLimb(add(hips, scale(across, side * BODY.hip)), feet[i], BODY.thigh, BODY.shin, {
      x: side * (0.3 + 0.45 * inside) - 0.15 * hang,
      y: 0.2,
      z: 1,
    });
  }) as [V3, V3];
  // The shoulders a little below the base of the neck and rounded forward.
  const yoke = add(add(neck, scale(spineUp, -BODY.shoulderDrop)), scale(chest, BODY.shoulderFore));
  const shoulders = [-1, 1].map((side) => add(yoke, scale(across, side * BODY.shoulder))) as [
    V3,
    V3,
  ];
  const hands = [-1, 1].map((side) => gripAt(side, bars)) as [V3, V3];
  // Elbows OUT, a little down and back, lifting toward level as he stands
  // into the attack position — never winged up past the shoulders.
  const elbows = [-1, 1].map((side, i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, {
      x: side * 0.8,
      y: -0.7 + 0.35 * stand,
      z: -0.45,
    }),
  ) as [V3, V3];
  return { hips, neck, head, pitch, roll, knees, feet, shoulders, elbows, hands, bars };
}

/** THE BODY ON ITS LEGS — the secondary motion a rider's own mass has on
 * top of the machine, kept by the view (it is the picture's, not the
 * physics'): a spring-damper in the machine's vertical, kicked by every
 * change in the machine's own climb, so a landing that stops the sled dead
 * leaves the body still coming down — the knees fold and spring back — and
 * the chatter of a rough groomer is a jiggle; and the STAND, eased toward
 * the height the moment asks for. */
export type RiderSpring = {
  /** The fold, m (positive sunk), and its rate, m/s. */
  bump: number;
  rate: number;
  /** Up off the seat, 0..1. */
  stand: number;
  /** The machine's climb at the last frame, m/s, or NaN before the first. */
  lastVy: number;
};

/** The body's natural frequency on its legs, rad/s (about 2.3 Hz), its
 * damping ratio, the share of the machine's change of climb the body is
 * kicked by (the legs soak up the rest before the knees move), and the most
 * they fold or extend, m. */
const LEGS = { omega: 14.5, zeta: 0.42, kick: 0.45, fold: 0.24, extend: 0.06 };
/** How quickly he gets up or sits down, 1/s. */
const STAND_RATE = 5;

export function createRiderSpring(): RiderSpring {
  return { bump: 0, rate: 0, stand: 0.6, lastVy: Number.NaN };
}

/** Advance the body on its legs by `dt` s for a machine climbing at `vy`
 * m/s (the engine's own), going `speed` m/s, in the air or not. */
export function stepRiderSpring(
  s: RiderSpring,
  vy: number,
  speed: number,
  airborne: boolean,
  dt: number,
): void {
  if (!(dt > 0)) return;
  if (!Number.isNaN(s.lastVy)) {
    // The machine's change of climb since the last frame is a kick the body
    // does not share: it keeps going the way it was.
    s.rate += (vy - s.lastVy) * LEGS.kick * (airborne ? 0 : 1);
  }
  s.lastVy = vy;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const acc = -LEGS.omega * LEGS.omega * s.bump - 2 * LEGS.zeta * LEGS.omega * s.rate;
    s.rate += acc * h;
    s.bump += s.rate * h;
  }
  if (s.bump > LEGS.fold) {
    s.bump = LEGS.fold;
    s.rate = Math.min(0, s.rate);
  } else if (s.bump < -LEGS.extend) {
    s.bump = -LEGS.extend;
    s.rate = Math.max(0, s.rate);
  }
  // Sat at a crawl, half up on the move, stood tall in the air.
  const want = airborne ? 1 : Math.min(0.62, 0.62 * Math.max(0, (speed - 1.5) / 5));
  s.stand += (want - s.stand) * (1 - Math.exp(-STAND_RATE * dt));
}
