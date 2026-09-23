// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE RIDER'S STEP — the sled, the trees and the edge, the wipeout (or the
// rider's own tumble once he is off, `crash.ts`), the damage it cost
// (`damage.ts`), the air record, the clock, the course and the automatic
// reset, in that order, for ONE run:
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
import { crashOver, quietClocks, stepThrown, throwRider, wipeoutCause } from "./crash.ts";
import { takeDamage } from "./damage.ts";
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
  const v0 = { x: c.vx, y: c.vy, z: c.vz };
  const speed0 = c.speed;
  // THE WIPEOUT (`crash.ts`): with the rider off it, the sled goes on with
  // the controls let go, and he tumbles on his own.
  const off = c.thrown;
  const held = off || !racing ? (run.phase === "countdown" ? HOLD : NEUTRAL_INPUT) : input;
  stepSled(run, held, events);
  collideTrees(run, events);
  keepInBounds(run);
  if (off) {
    stepThrown(run, off);
    quietClocks(c);
  } else {
    const cause = wipeoutCause(run, events, speed0);
    if (cause) throwRider(run, cause, v0, events);
  }
  takeDamage(run, events);
  // THE RUN'S AIR RECORD, off the landing the sled has just reported.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "land" && e.airTime > run.progress.bestAir) run.progress.bestAir = e.airTime;
  }
  if (!racing) return;
  const p = run.progress;
  if (p.finished) return;
  p.time += TUNING.dt;
  if (off) {
    // A sled without its rider takes no checkpoint; he is stood back up
    // once he has lain long enough.
    if (crashOver(off)) resetSled(run, events, true);
    return;
  }
  stepCourse(run, x0, z0, events);
  if (p.finished) return;
  const R = TUNING.reset;
  // Trenched, the rider is given the time to rock it out (`trench.ts`).
  const stuck = c.trench > 0 ? c.trenchFor >= TUNING.trench.holdFor : c.stuckFor >= R.stuckFor;
  if (c.overFor >= R.overFor || stuck) resetSled(run, events, true);
}
