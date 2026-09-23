// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BED'S SCHEDULER — the half that reads the live `GameState` once a frame
// and steers every continuous voice the race has. What a voice IS lives in
// `engine-voice.ts` (the machinery) and `snow-voice.ts` (the snow and the
// wind); this is the one place that turns a state into their targets.
//
// NOTHING HERE IS BOOKED AHEAD. The layers run on the audio thread and
// every frame merely tells them where to go next, over a glide; a frame
// that arrives late — a garbage-collection pause, a phone throttling itself,
// a stall while a map is built — leaves every layer holding its last value.
// A bed that had to be fed on a cadence breathed with the frame rate and
// stuttered when it was starved, and a stutter is what a player reports as
// crackle.

import { maxRpm, topSpeedOf, type GameState } from "@engine";

import type { Synth } from "../../lib/voice.ts";

import {
  ENGINE_GLIDE,
  ENGINE_LAYERS,
  engineTargets,
  revOf,
  type EngineLayer,
} from "./engine-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { createRack, type Rack } from "./rack.ts";
import { SNOW_GLIDE, SNOW_LAYERS, snowTargets, type SnowLayer } from "./snow-voice.ts";

/** How quickly the wind follows the speed, s — a time constant rather than a
 * per-frame fraction, because a fraction is only true at the frame rate it
 * was tuned at. */
const WIND_TAU = 0.25;

/** One step of a one-pole filter on a time constant. */
function follow(previous: number, target: number, dt: number, tau: number): number {
  return previous + (target - previous) * (1 - Math.exp(-dt / tau));
}

/** The ride bed, for the whole life of one app. */
export type RideBed = {
  /** Steer every layer. Call once per rendered frame with the live state and
   * the frame's own elapsed time; cheap when nothing changed and silent when
   * the context is locked. `duck` scales the whole bed, 0..1: 1 with the
   * player's hands on the bars, less under a card. */
  update: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the race is being watched from — the mix follows it. */
  setView: (view: string) => void;
  /**
   * THE RACE IS STILL THERE BUT NOBODY IS HEARING IT — the pause card, a
   * hidden tab. Tear the layers down; the next `update` builds them again.
   * Silencing has to be SAID: a bed that is merely not fed holds its last
   * note, which is an engine carrying on behind a card that froze the race.
   */
  silence: () => void;
  /** The race is over or the player left it. */
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createRideBed(synth: Synth): RideBed {
  let wind = 0;
  let listener: Listener = listenerFor("chase");
  const engine: Rack<EngineLayer> = createRack(synth, ENGINE_LAYERS, ENGINE_GLIDE);
  const snow: Rack<SnowLayer> = createRack(synth, SNOW_LAYERS, SNOW_GLIDE);

  const hush = (): void => {
    engine.stop();
    snow.stop();
  };

  return {
    update(state, dt, duck = 1) {
      if (synth.now() === null) {
        // Locked, suspended or muted to nothing. Nudge the context; the
        // racks rebuild whatever they need the moment it is back.
        synth.resume();
        return;
      }
      const c = state.sled;
      const spec = c.spec;
      const frame = Math.max(1 / 240, Math.min(0.1, dt));
      let touching = 0;
      for (const p of c.contacts) if (p.touching) touching += 1;
      const grounded = c.contacts.length > 0 ? touching / c.contacts.length : 0;

      // ── The engine ───────────────────────────────────────────────────
      // The revs exactly as the dial reads them, so the needle and the note
      // can never disagree. The LOAD is the throttle with snow under the
      // track: in the air the crank runs free and the engine hears it.
      engine.apply(
        engineTargets(
          {
            rpm: c.rpm,
            rev: revOf(c.rpm, spec.idleRpm, maxRpm(spec)),
            throttle: c.throttle,
            load: c.airborne ? 0 : c.throttle * Math.min(1, grounded * 2),
            treadSpeed: c.treadSpeed,
            slip: c.slip,
          },
          {
            engine: listener.engine * duck,
            exhaust: listener.exhaust * duck,
            tone: listener.tone,
          },
        ),
      );

      // ── The snow and the wind ────────────────────────────────────────
      wind = follow(wind, c.speed, frame, WIND_TAU);
      snow.apply(
        snowTargets(
          {
            speed: c.speed,
            pace: c.speed / topSpeedOf(spec),
            packed: c.packed,
            grounded,
            steer: c.steer,
            treadSpeed: c.treadSpeed,
            wind,
            airborne: c.airborne,
          },
          { snow: listener.snow * duck, wind: listener.wind * duck },
        ),
      );
    },

    setView(view) {
      listener = listenerFor(view);
    },

    silence: hush,

    reset() {
      hush();
      wind = 0;
    },

    live: () => engine.live() + snow.live(),
  };
}
