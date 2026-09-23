// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RACE SAYS: the line in the news column an engine event earns. Pure
// — an event and the state it came off in, a line out — so the root suite
// reads every rung without a browser, and `App.tsx` only calls it. Every
// word is the strings table's (§39.1).
//
// NEWS IS WHAT CHANGED THE RACE: a checkpoint taken and its clock, a lap
// done, one missed, a tree met, a landing the suspension could not take, a
// reset, the flag. What the HUD already shows in its own corner every
// frame — the speed, the place — is not news, and neither is a landing the
// sled simply rode away from.

import type { GameEvent, GameState } from "@engine";

import { STRINGS } from "./strings.ts";

/** A line in the news column: what it says, its colour, and an id the list
 * is keyed on so a line leaving does not restart the animation of the one
 * under it. */
export type HudFlash = { id: number; text: string; tone: "good" | "bad" | "info" };

export type NewsLine = Omit<HudFlash, "id">;

/** The line `e` earns, or null for an event that is not news. */
export function newsFor(e: GameEvent, state: GameState): NewsLine | null {
  switch (e.kind) {
    case "checkpoint":
      // The line itself: the FIRST crossing opens the race and is worth a
      // word; every later one ends a lap and the `lap` event says that.
      if (e.index === 0) return e.lap === 0 ? { text: STRINGS.newsStart, tone: "info" } : null;
      return { text: STRINGS.newsCheckpoint(e.index, e.split), tone: "good" };
    case "lap": {
      if (e.lap >= state.rules.laps) return null;
      return e.lap === state.rules.laps - 1
        ? { text: `${STRINGS.newsLap(e.lap, e.time)} · ${STRINGS.newsLastLap}`, tone: "good" }
        : { text: STRINGS.newsLap(e.lap, e.time), tone: "good" };
    }
    case "missed":
      return { text: STRINGS.newsMissed(e.index), tone: "bad" };
    case "hit":
      return { text: STRINGS.newsTree, tone: "bad" };
    case "land":
      return e.harsh ? { text: STRINGS.newsHarsh, tone: "bad" } : null;
    case "reset":
      return { text: STRINGS.newsReset, tone: "info" };
    case "finish":
      return {
        text: STRINGS.newsFinish(e.place, state.rivals.length + 1, e.time),
        tone: "good",
      };
    default:
      return null;
  }
}
