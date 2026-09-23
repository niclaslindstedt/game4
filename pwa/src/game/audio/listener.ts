// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE EAR IS — what each rung of the camera ladder does to the mix.
//
// The picture moves from the hood to a crane shot and the sound has to move
// with it, or the high shot is a rider's seat with a long lens. Every number
// here is a multiplier on one part of the mix, read by the beds every frame
// and by the event router for the one-shots, and the whole table is the
// opinion about what a snowmobile sounds like from each seat:
//
//   * ON THE HOOD (`hood`) the engine is right under you and the snow is an
//     arm's length away: the skis hissing, the wind full in the face, and
//     the pipe BEHIND you, thinned by the seat and the rider in between.
//   * AT THE BARS (`bars`) you are the rider: the engine under your knees,
//     the wind in your helmet, the pipe coming round from behind.
//   * BEHIND AND ABOVE (`chase`, the seat the game is tuned at) it is all
//     there in proportion: the row of ones — and the pipe and the belt a
//     touch up, because that is the end of the machine the camera is at.
//   * STOOD BACK (`far`) and CRANED UP (`high`) the sled is a small thing on
//     a big hill: the engine thin and dull, the wind gone, the one-shots
//     softened by the air between.
//   * THE CARDS' SLOW TURN (`orbit`) is not a seat at all — it is a lens
//     over a race nobody is riding, so the machinery is a thread under a
//     card that is ducked anyway (`shell.ts`'s `soundsLive`).
//
// DOM-free, three-free, so the tests can read it and the audition page can
// switch seats without a renderer.

import type { CameraRung } from "../renderer-api.ts";

export type Listener = {
  /** The engine's own note: the block, the hum, the bass and the intake. */
  engine: number;
  /** The pipe's ring and the belt's whine — heard from BEHIND. */
  exhaust: number;
  /** How bright the engine is, 0..1: the hum's lowpass is scaled by it. */
  tone: number;
  /** The skis and the track on the snow. */
  snow: number;
  /** The rider's own wind. */
  wind: number;
  /** Every one-shot the race makes. */
  events: number;
  /** A pitch multiplier on those one-shots. Below 1 moves every filter down
   * with it: a landing heard from a crane is a duller landing. */
  muffle: number;
};

export const LISTENERS: Record<CameraRung, Listener> = {
  hood: {
    engine: 1.1,
    exhaust: 0.6,
    tone: 0.9,
    snow: 1.35,
    wind: 1.4,
    events: 1.1,
    muffle: 1,
  },
  bars: {
    engine: 1.05,
    exhaust: 0.8,
    tone: 0.95,
    snow: 1.15,
    wind: 1.25,
    events: 1,
    muffle: 1,
  },
  chase: {
    engine: 0.9,
    exhaust: 1.1,
    tone: 1,
    snow: 1,
    wind: 0.85,
    events: 1,
    muffle: 1,
  },
  far: {
    engine: 0.72,
    exhaust: 0.95,
    tone: 0.9,
    snow: 0.8,
    wind: 0.5,
    events: 0.9,
    muffle: 0.95,
  },
  high: {
    engine: 0.5,
    exhaust: 0.75,
    tone: 0.8,
    snow: 0.6,
    wind: 0.25,
    events: 0.8,
    muffle: 0.9,
  },
  orbit: {
    engine: 0.4,
    exhaust: 0.55,
    tone: 0.7,
    snow: 0.55,
    wind: 0.15,
    events: 0.6,
    muffle: 0.8,
  },
};

/** The mix for a camera, or the chase view's for anything off the ladder. */
export function listenerFor(view: string | null | undefined): Listener {
  return (view && (LISTENERS as Record<string, Listener>)[view]) || LISTENERS.chase;
}
