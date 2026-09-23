// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A BLOW COSTS THE MACHINERY — only on a run that asked for it
// (`GameState.damage`, the player's option; a rival never takes any).
//
// Three figures, each 0 sound … 1 wrecked (`SledDamage`): the two skis and
// the suspension. A trunk bends the ski on the side it was met on (both, a
// little each, met dead centre); a landing the suspension could not take
// hurts the suspension by how far past the machine's harsh speed it came
// in; a wipeout adds its own share to what its cause reaches. Nothing mends
// it but a new race — a reset stands a bent sled back on the track.
//
// WHAT IT DOES TO THE RIDE is read by `sled.ts` through the four shares
// below, and a sound machine reads exactly 0 and exactly 1 from them, so a
// run without damage is the same arithmetic to the last bit:
//   - a BENT SKI toes out of line and pulls the bars toward its own side
//     (`skiPull`), and bites less (`skiBite`);
//   - a HURT SUSPENSION is softer and less damped (`springShare`,
//     `dampShare`), so it sits lower and bottoms sooner — and bottoms at a
//     lower speed into the slope (`harshShare`).

import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";
import { harshSpeedOf } from "./limits.ts";
import type { DamagePart, GameEvent, GameState, SledState } from "./state.ts";

const D = TUNING.damage;

/** The pull a bent ski puts on the skis' line, rad, positive clockwise. */
export function skiPull(c: SledState): number {
  return D.skiToe * (c.damage.ski[1] - c.damage.ski[0]);
}

/** The share of its sideways bite the ski on `side` (-1 left, +1 right)
 * still has. */
export function skiBite(c: SledState, side: number): number {
  return 1 - D.skiGrip * c.damage.ski[side < 0 ? 0 : 1];
}

/** The shares of the springs' rate and damping the suspension still has. */
export function springShare(c: SledState): number {
  return 1 - D.springSoft * c.damage.suspension;
}
export function dampShare(c: SledState): number {
  return 1 - D.dampSoft * c.damage.suspension;
}

/** The share of the machine's harsh speed (`harshSpeedOf`) it still takes. */
export function harshShare(c: SledState): number {
  return 1 - D.harshSoft * c.damage.suspension;
}

function hurt(
  run: GameState,
  part: DamagePart,
  amount: number,
  out: GameEvent[],
  reported: Set<DamagePart>,
): void {
  if (amount <= 0) return;
  const d = run.sled.damage;
  const was = part === "suspension" ? d.suspension : d.ski[part === "skiLeft" ? 0 : 1];
  const now = clamp(was + amount, 0, 1);
  if (part === "suspension") d.suspension = now;
  else d.ski[part === "skiLeft" ? 0 : 1] = now;
  if (now - was >= D.report && !reported.has(part)) {
    reported.add(part);
    out.push({ kind: "damage", t: run.t, part, level: now });
  }
}

const reported = new Set<DamagePart>();

/** Charge the machine for this step's blows (`events`, the run's own). A
 * no-op on a run without damage. */
export function takeDamage(run: GameState, events: GameEvent[]): void {
  if (!run.damage) return;
  const c = run.sled;
  reported.clear();
  const n = events.length;
  for (let i = 0; i < n; i++) {
    const e = events[i];
    if (e.kind === "hit") {
      const over = (e.speed - D.treeFrom) * D.treeRate;
      if (over <= 0) continue;
      // Which side of the machine the trunk was on: the sled's right in
      // plan is (cos h, −sin h).
      const across = (e.x - c.x) * Math.cos(c.heading) - (e.z - c.z) * Math.sin(c.heading);
      if (Math.abs(across) < 0.3) {
        hurt(run, "skiLeft", over / 2, events, reported);
        hurt(run, "skiRight", over / 2, events, reported);
      } else hurt(run, across < 0 ? "skiLeft" : "skiRight", over, events, reported);
    } else if (e.kind === "land") {
      const harsh = harshSpeedOf(c.spec) * harshShare(c);
      hurt(run, "suspension", (e.impact - harsh) * D.landRate, events, reported);
    } else if (e.kind === "wipeout") {
      const w = D.wipeout;
      if (e.cause === "tree") hurt(run, "suspension", w / 2, events, reported);
      else if (e.cause === "nose") {
        hurt(run, "skiLeft", w, events, reported);
        hurt(run, "skiRight", w, events, reported);
      } else {
        hurt(run, "suspension", w, events, reported);
        hurt(run, c.roll > 0 ? "skiRight" : "skiLeft", w / 2, events, reported);
      }
    }
  }
}
