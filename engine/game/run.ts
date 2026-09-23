// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE RIDER'S STEP — the sled, the trees and the edge, the air record, the
// clock, the course and the automatic reset, in that order, for ONE run:
// the player's, or one of the rivals' (`rivals.ts`), which is a run of its
// own over the same map. The field is stepped by this same function — a
// rival that rode a different step would be a rival in a different game.
//
// The phase gates everything else: under the lights (`countdown`) the
// engine idles with the brake on and nothing is steered, and a finished run
// coasts with the controls let go.

import { TUNING } from "./defs/tuning.ts";
import { collideTrees, keepInBounds } from "./collision.ts";
import { resetSled, stepCourse } from "./course.ts";
import { stepSled } from "./sled.ts";
import { NEUTRAL_INPUT, type GameEvent, type GameState, type SledInput } from "./state.ts";

/** What the rider holds under the lights: the brake, and nothing else. */
const HOLD: SledInput = { ...NEUTRAL_INPUT, brake: 1 };

/** Advance one rider's run by the step the world has just taken. `events`
 * is the run's own list, already cleared for this step. */
export function stepRun(run: GameState, input: SledInput, events: GameEvent[]): void {
  const racing = run.phase === "racing";
  if (input.reset && racing) {
    resetSled(run, events, false);
    return;
  }
  const c = run.sled;
  const x0 = c.x;
  const z0 = c.z;
  const held = run.phase === "countdown" ? HOLD : racing ? input : NEUTRAL_INPUT;
  stepSled(run, held, events);
  collideTrees(run, events);
  keepInBounds(run);
  // THE RUN'S AIR RECORD, off the landing the sled has just reported.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "land" && e.airTime > run.progress.bestAir) run.progress.bestAir = e.airTime;
  }
  if (!racing) return;
  const p = run.progress;
  if (p.finished) return;
  p.time += TUNING.dt;
  stepCourse(run, x0, z0, events);
  if (p.finished) return;
  const R = TUNING.reset;
  if (c.overFor >= R.overFor || c.stuckFor >= R.stuckFor) resetSled(run, events, true);
}
