// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// STUCK IN DEEP POWDER. A sled that has stopped in fresh snow with the
// throttle held does not sit there spinning its belt politely: the lugs
// throw the snow under the tread out behind it, and the tread digs itself
// down — until the belly is on the snow, the tread hangs in its own hole
// with nothing to push on, and the machine is TRENCHED.
//
// The model is one number, `SledState.trench`, m: how far the hole under
// the tread is dug past the sink the snow's own model allows. `sled.ts`
// adds it to the tread's support (so the belly's chassis points, which read
// the powder's floor, take the load the tread loses — high-centred, which
// is what trenched IS) and takes a share of the tread's drive away with it.
// Here it is dug and filled:
//
//   - it DIGS only once the sled has been stuck (`SledState.stuckFor`, the
//     automatic reset's own clock) for `trench.after` s, at a rate that goes
//     with the powder, the throttle and how hard the belt is slipping — so a
//     launch out of a powder grid never gets near it;
//   - ROCKING packs it back: every metre the rider's weight moves fore and
//     aft or side to side (`riderAft`, `riderRight` — the lean and the bars
//     thrown about) fills `trench.rock` of it. A rider who rocks with the
//     throttle pinned is digging as fast as he packs; ease it and rock;
//   - DRIVING OUT clears it, by the metre of way made good.
//
// Past `trench.stuckAt` the sled is trenched: `stuck` fires once, and the
// automatic reset waits `trench.holdFor` s rather than `reset.stuckFor`, so
// the rider has the time to rock it out before the engine does it for him.
// Nothing here draws from the stream.

import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState } from "./state.ts";

const T = TUNING.trench;
const dt = TUNING.dt;

/** Whether the sled is trenched. */
export function trenched(depth: number): boolean {
  return depth > T.stuckAt;
}

/** The share of the tread's drive a trench `depth` m deep leaves it. */
export function trenchGrip(depth: number): number {
  return 1 - T.grip * clamp(depth / T.max, 0, 1);
}

/** Dig or fill the trench by one step. `moved` is how far the rider's
 * weight moved this step, m. Called by `stepSled` once the clocks are
 * read. */
export function stepTrench(state: GameState, moved: number, events: GameEvent[]): void {
  const c = state.sled;
  const was = c.trench;
  // BOGGED: on the gas in powder, the belt spinning and the sled going
  // nowhere — at a crawl, whichever way it is crawling.
  const bogged = c.throttle > 0.5 && c.speed < T.creep && c.slip > T.slipRef / 2 && c.packed < 0.5;
  c.boggedFor = bogged ? c.boggedFor + dt : 0;
  if (was > 0 || c.boggedFor >= T.after) {
    let d = was;
    if (c.boggedFor >= T.after) {
      const slip = Math.tanh(Math.max(0, c.slip) / T.slipRef);
      d += T.dig * (1 - c.packed) * c.throttle * slip * dt;
    }
    d -= T.rock * moved;
    // Creeping about in the hole is not driving out of it.
    d -= T.clear * Math.max(0, Math.abs(c.way) - T.creep) * dt;
    c.trench = clamp(d, 0, T.max);
  }
  if (trenched(c.trench) && !trenched(was)) events.push({ kind: "stuck", t: state.t });
  c.trenchFor = c.trench > 0 ? c.trenchFor + dt : 0;
}
