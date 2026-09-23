// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DRAWING BETWEEN TWO STEPS. The engine steps at 120 Hz and a display draws
// at whatever it draws at, so a frame usually falls part of the way through
// a step — the run loop hands that share over as `alpha`. The engine keeps
// no previous pose, so the renderer keeps its own: the pose it saw at the
// last frame and the step it was taken at. When the frame finds the state
// `k` steps further on, the step BEFORE the current one is estimated as a
// `1/k` share back along that line, and the frame is drawn `alpha` of the way
// from it to the current one — which is the textbook interpolation with the
// one missing sample reconstructed.
//
// Three-free, so the suite reads it (`tests/world_render_test.ts`).

import type { Quat, SledState } from "@engine";

export type Pose = {
  x: number;
  y: number;
  z: number;
  q: Quat;
};

export type PoseTrack = {
  /** The step the `curr` pose was read at; -1 before the first frame. */
  tick: number;
  curr: Pose;
  /** The estimated pose one step before `curr`. */
  prev: Pose;
};

function pose(): Pose {
  return { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
}

export function createTrack(): PoseTrack {
  return { tick: -1, curr: pose(), prev: pose() };
}

function copyPose(to: Pose, from: { x: number; y: number; z: number; q: Quat }): void {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.q.x = from.q.x;
  to.q.y = from.q.y;
  to.q.z = from.q.z;
  to.q.w = from.q.w;
}

/** Normalised linear blend of two quaternions along the short way. */
export function nlerp(a: Quat, b: Quat, t: number, out: Quat): Quat {
  const s = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  out.x = a.x + (b.x * s - a.x) * t;
  out.y = a.y + (b.y * s - a.y) * t;
  out.z = a.z + (b.z * s - a.z) * t;
  out.w = a.w + (b.w * s - a.w) * t;
  const n = Math.hypot(out.x, out.y, out.z, out.w) || 1;
  out.x /= n;
  out.y /= n;
  out.z /= n;
  out.w /= n;
  return out;
}

/** A jump further than this between two frames is a reset, m — drawn as a
 * cut, never swept across the map. */
const CUT = 8;

/** Take in the sled as the state has it at `tick`. */
export function observe(track: PoseTrack, sled: SledState, tick: number): void {
  if (tick === track.tick) return;
  const k = tick - track.tick;
  const jumped =
    track.tick < 0 ||
    k <= 0 ||
    Math.hypot(sled.x - track.curr.x, sled.y - track.curr.y, sled.z - track.curr.z) > CUT;
  if (jumped) {
    copyPose(track.prev, sled);
    copyPose(track.curr, sled);
  } else {
    // prev ← the pose one step before the new current, on the line from
    // the last one seen to it.
    const f = 1 - 1 / k;
    const c = track.curr;
    track.prev.x = c.x + (sled.x - c.x) * f;
    track.prev.y = c.y + (sled.y - c.y) * f;
    track.prev.z = c.z + (sled.z - c.z) * f;
    nlerp(c.q, sled.q, f, track.prev.q);
    copyPose(track.curr, sled);
  }
  track.tick = tick;
}

/** The pose to draw, `alpha` of a step on from `prev`. */
export function sample(track: PoseTrack, alpha: number, out: Pose): Pose {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const p = track.prev;
  const c = track.curr;
  out.x = p.x + (c.x - p.x) * a;
  out.y = p.y + (c.y - p.y) * a;
  out.z = p.z + (c.z - p.z) * a;
  nlerp(p.q, c.q, a, out.q);
  return out;
}
