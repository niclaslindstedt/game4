// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SOUND AN EVENT MAKES, and how big it is.
//
// Split out from the front door so it can be reasoned about — and tested —
// as what it is: a pure function from a `GameEvent` to a bank id and a
// scale. Nothing here touches the synth, so the whole opinion about what a
// race sounds like is one table a reader can check against the bank.
//
// WHAT AN EVENT DECIDES, AND WHAT IT ONLY SCALES. Some events pick a
// different SOUND — a landing the suspension took and one it could not are
// two different things happening to a sled. Most only scale the one they
// have (`PlayShape`: louder, lower, longer).

import type { GameEvent } from "@engine";

import type { PlayShape } from "./types.ts";

/** The speed INTO the slope at which a landing is as big as it gets, m/s,
 * and the share of that the gentlest touchdown is still worth — a small
 * hop still has to sound like a quarter of a tonne of machine arriving. */
const LAND_FULL = 12;
const LAND_FLOOR = 0.3;

/** A flight shorter than this, s, is a sled skipping over a bump rather
 * than a landing: the suspension bed has it, and a thump on every mogul
 * would bury the engine. */
const LAND_HEARD = 0.25;

/** Closing speeds that separate a brush with a trunk from a wreck, m/s. */
const HIT_FULL = 20;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** What one event sounds like. Null means the event is silent. */
export function soundForEvent(event: GameEvent): { id: string; shape?: PlayShape } | null {
  switch (event.kind) {
    case "land": {
      if (!event.harsh && event.airTime < LAND_HEARD) return null;
      const big = LAND_FLOOR + (1 - LAND_FLOOR) * ramp(event.impact, 0, LAND_FULL);
      return {
        id: event.harsh ? "land_hard" : "land_soft",
        shape: { gain: 0.55 + 0.75 * big, pitch: 1.12 - 0.28 * big, stretch: 0.85 + 0.5 * big },
      };
    }

    case "hit": {
      const hard = ramp(event.speed, 2, HIT_FULL);
      return {
        id: "hit_tree",
        shape: { gain: 0.6 + 0.7 * hard, pitch: 1.1 - 0.3 * hard, stretch: 0.9 + 0.5 * hard },
      };
    }

    // THE WIPEOUT: a man and a machine arriving in the snow separately —
    // the hard landing's thud, at its biggest and lowest. What bent (the
    // `damage` event) and a trench dug (`stuck`) are the blow's and the
    // engine's own sounds already, and say nothing of their own.
    case "wipeout": {
      const hard = ramp(event.speed, 6, HIT_FULL);
      return {
        id: "land_hard",
        shape: { gain: 1.1 + 0.4 * hard, pitch: 0.8 - 0.15 * hard, stretch: 1.3 + 0.4 * hard },
      };
    }

    case "bump": {
      const hard = ramp(event.speed, 1, HIT_FULL);
      return {
        id: "bump",
        shape: { gain: 0.55 + 0.7 * hard, pitch: 1.1 - 0.25 * hard, stretch: 0.9 + 0.4 * hard },
      };
    }

    // The start line opening a lap is the LAP's sound (below); the line's
    // very first crossing, which opens the race, is a checkpoint like any.
    case "checkpoint":
      return event.index === 0 && event.lap > 0 ? null : { id: "checkpoint" };

    case "lap":
      return { id: "lap" };

    case "missed":
      return { id: "missed" };

    case "reset":
      return { id: "reset" };

    case "finish":
      return { id: "finish" };

    // THE LIGHTS: one beep a light, and the last of them — GO — an octave
    // up and held, so the ear knows which one it was without counting.
    case "count":
      return { id: "count" };
    case "go":
      return { id: "go" };

    // THE SCORE (`tricks.ts`): an element won is the checkpoint's bell,
    // pitched up a step for every step of multiplier the combo now stands
    // at, so a combo climbing is heard climbing; the air's own rung is the
    // element beside it and says nothing of its own. A combo banked is the
    // lap's phrase — a sketchy one, banked at its base, gets none — and a
    // combo lost is the missed checkpoint's fall.
    case "trick":
      if (event.trick === "air") return null;
      return { id: "checkpoint", shape: { pitch: 1 + 0.06 * Math.min(event.mult - 1, 10) } };
    case "combo":
      return event.sketchy ? null : { id: "lap" };
    case "bail":
      return { id: "missed" };

    default:
      return null;
  }
}

/** The sounds a step's events make, in order, deduplicated: everything in a
 * step is simultaneous, so two events that make the same sound in one step
 * would be one sound at twice the level. And the flag outranks the lap it
 * closes — the last lap's chime under the finish phrase is the same news
 * said twice. */
export function soundsForStep(list: readonly GameEvent[]): { id: string; shape?: PlayShape }[] {
  const finishing = list.some((e) => e.kind === "finish");
  const played = new Set<string>();
  const out: { id: string; shape?: PlayShape }[] = [];
  for (const event of list) {
    if (finishing && event.kind === "lap") continue;
    const hit = soundForEvent(event);
    if (!hit || played.has(hit.id)) continue;
    played.add(hit.id);
    out.push(hit);
  }
  return out;
}

/** A play, as heard from a seat: the listener's gain on every one-shot and
 * its muffle on the pitch, which moves every filter with it. */
export function heardFrom(
  shape: PlayShape | undefined,
  ear: { events: number; muffle: number },
): PlayShape {
  return {
    ...shape,
    gain: (shape?.gain ?? 1) * ear.events,
    pitch: (shape?.pitch ?? 1) * ear.muffle,
  };
}
