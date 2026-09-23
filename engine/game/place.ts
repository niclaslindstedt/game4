// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACING A RUN AT A MOMENT instead of riding to it. A landing only exists
// once a kicker has been taken, and a screenshot or a test of one used to
// cost the whole ride. This stands the sled where the ride would have left
// it: at a plan point, on a heading, at a speed — on its suspension on the
// snow, or in the air at a height with an attitude and a climb — with the
// engine and the tread turning as though it had been pulling. The tests, the
// ride lab and the app's staged scenes all stage through it.
//
// THE MOMENT ITSELF IS STILL THE ENGINE'S TO EMIT: a placed flight lands on
// the next steps and fires `land` the way every landing fires. Nothing random
// is drawn, so a placed moment reproduces from its description exactly.

import { clamp } from "../lib/math.ts";
import { fromEuler } from "../lib/quat.ts";
import { standSled } from "./course.ts";
import { derive } from "./sled.ts";
import { sinkTarget } from "./snow.ts";
import { probesOf } from "./suspension.ts";
import type { GameState } from "./state.ts";

export type RunMoment = {
  x: number;
  z: number;
  /** Heading, rad (0 = +z, clockwise from above). */
  heading: number;
  /** Speed along the heading, m/s; at rest when left out. */
  speed?: number;
  /** Height of the CoG above the snow, m. Left out, the sled stands on its
   * suspension; given, it is in the air with `vy` m/s of climb. */
  height?: number;
  vy?: number;
  /** Attitude, rad: nose up positive, right side down positive. */
  pitch?: number;
  roll?: number;
  /** A pitch rate already under way, rad/s, nose up positive. */
  pitchRate?: number;
  /** The run clock, and the checkpoint owed — given, the start line counts
   * as already crossed, so owing 0 is owing the end of a lap. */
  time?: number;
  nextCheckpoint?: number;
};

/** Stand the run at a moment. A staged moment has no lights in front of
 * it: the run is racing from here. */
export function placeRun(state: GameState, moment: RunMoment): void {
  if (state.phase === "countdown") {
    state.phase = "racing";
    state.countdown = 0;
  }
  const c = state.sled;
  standSled(state, moment.x, moment.z, moment.heading);
  const speed = moment.speed ?? 0;
  const pitch = moment.pitch ?? c.pitch;
  const roll = moment.roll ?? c.roll;
  c.q = fromEuler(moment.heading, pitch, roll);
  c.vx = Math.sin(moment.heading) * speed;
  c.vz = Math.cos(moment.heading) * speed;
  c.vy = moment.vy ?? 0;
  c.wx = -(moment.pitchRate ?? 0);
  const level = state.level;
  const packed = level.packedAt(moment.x, moment.z);
  const probes = probesOf(c.spec);
  for (let i = 0; i < probes.length; i++)
    c.sinks[i] = sinkTarget(packed, speed, probes[i].sinkScale, probes[i].planeScale);
  if (moment.height !== undefined && moment.height > 0) {
    c.y = level.groundAt(moment.x, moment.z) + moment.height;
    c.airborne = true;
    c.airTime = 0.2;
    c.airReported = true;
    c.launchVy = c.vy;
  } else {
    c.y = level.groundAt(moment.x, moment.z) - c.sinks[probes.length - 1] + c.spec.cogHeight;
  }
  // An engine that has been pulling: the tread turning at the way and the
  // revs where the CVT would hold them, the throttle open.
  c.treadSpeed = speed;
  const share = clamp(speed / c.spec.gearTop, 0, 1);
  c.rpm = speed > 1 ? Math.max(c.spec.peakRpm, c.spec.maxRpm * share) : c.spec.idleRpm;
  c.throttle = speed > 1 ? 1 : 0;
  derive(c);
  if (moment.time !== undefined) state.progress.time = moment.time;
  if (moment.nextCheckpoint !== undefined) {
    state.progress.nextCheckpoint = moment.nextCheckpoint;
    state.progress.started = true;
  }
}
