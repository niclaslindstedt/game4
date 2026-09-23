// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game orchestrator: `createGame` builds a run (a map, a sled on the
// grid, the field beside it), `step` advances it exactly one fixed timestep
// and leaves the events that step emitted on the state. The app's render
// loop and the headless simulator drive this same function — there is no
// other way to advance a run.
//
// THE STEP ORDER: the clock; the lights; the player's run (`run.ts`: the
// sled, the trees, the edge, the clock, the course, the reset); every
// rival's run by the same function; then every sled against every other.

import { createRng } from "../lib/prng.ts";
import { generateLevel } from "../mapgen/index.ts";
import type { Level } from "../mapgen/types.ts";
import { status } from "../output.ts";
import { freshProgress, standSled } from "./course.ts";
import {
  FULL_ASSIST,
  MODE_RULES,
  RACE,
  type Assist,
  type GameMode,
  type RunRules,
} from "./defs/modes.ts";
import { SLED, type SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { clipRiders, createRivals, gridSlot, stepRivals } from "./rivals.ts";
import { stepRun } from "./run.ts";
import { freshSled } from "./sled.ts";
import { NEUTRAL_INPUT, type GameState, type SledInput } from "./state.ts";

export type CreateGameOptions = {
  /** The map's seed; ignored for the map when `level` is given, but still
   * the run's own random stream. Defaults to the level's seed, or 1. */
  seed?: number;
  /** A map to ride instead of the one the seed generates (tests, labs). */
  level?: Level;
  /** The mode whose rules the run is dealt (`MODE_RULES`); a race when left
   * out. Each option below still overrides its own rule. */
  mode?: GameMode;
  /** How many rivals stand on the grid (`RACE.rivals` when left out; 0 is a
   * solo run — what the sim and the labs ride). */
  rivals?: number;
  /** Laps to the flag; the level's own when left out. */
  laps?: number;
  /** Seconds of lights before GO (`RACE.countdown`; 0 for none). */
  countdown?: number;
  /** Whether sleds lean on each other. */
  contact?: boolean;
  /** The machine; the one sled when left out. */
  spec?: SledSpec;
  /** The arcade's help for the player's own sled (`Assist`); every hand on
   * when left out. The field rides with every hand on whatever this says. */
  assist?: Assist;
  /** Build without announcing the map (the sim's sweeps). */
  quiet?: boolean;
};

/** The rules a run is dealt from what it asked for. */
export function rulesFor(options: CreateGameOptions, level: Level): RunRules {
  const base = MODE_RULES[options.mode ?? "race"](options.laps ?? level.laps);
  return {
    rivals: options.rivals ?? base.rivals,
    laps: base.laps,
    countdown: options.countdown ?? base.countdown,
    contact: options.contact ?? base.contact,
  };
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const level = options.level ?? generateLevel(options.seed ?? 1);
  const seed = options.seed ?? level.seed;
  const rules = rulesFor(options, level);
  const state: GameState = {
    seed,
    rng: createRng(seed),
    t: 0,
    tick: 0,
    level,
    sled: freshSled(options.spec ?? SLED),
    input: { ...NEUTRAL_INPUT },
    progress: freshProgress(level),
    rules,
    assist: { ...(options.assist ?? FULL_ASSIST) },
    rivals: [],
    countdown: rules.countdown,
    phase: rules.countdown > 0 ? "countdown" : "racing",
    events: [],
  };
  const at = gridSlot(state, 0);
  standSled(state, at.x, at.z, at.heading);
  if (rules.rivals > 0) createRivals(state, rules.rivals);
  if (!options.quiet) {
    status(
      `Map ${level.seed}: ${level.checkpoints.length} checkpoints over ${Math.round(
        level.track.length,
      )} m, ${rules.laps} laps, ${level.trees.length} trees, ${rules.rivals} rivals`,
    );
  }
  return state;
}

/** Advance the run by exactly one fixed step. */
export function step(state: GameState, input: SledInput): GameState {
  const events = state.events;
  events.length = 0;
  state.t += TUNING.dt;
  state.tick += 1;
  state.input.steer = input.steer;
  state.input.throttle = input.throttle;
  state.input.brake = input.brake;
  state.input.lean = input.lean;
  state.input.reset = input.reset;

  // THE LIGHTS: each one as it begins, then GO on the step the count runs
  // out — the first step the rider is given the throttle.
  if (state.phase === "countdown") {
    const was = state.countdown;
    state.countdown = Math.max(0, was - TUNING.dt);
    if (was === state.rules.countdown || Math.ceil(state.countdown) < Math.ceil(was)) {
      if (state.countdown > 0)
        events.push({ kind: "count", t: state.t, left: Math.ceil(state.countdown) });
    }
    if (state.countdown <= 0) {
      state.phase = "racing";
      events.push({ kind: "go", t: state.t });
    }
  }

  stepRun(state, input, events);
  stepRivals(state);
  if (state.rules.contact) clipRiders(state, events);
  return state;
}

/** The race's field size, for a caller that wants to say so. */
export const FIELD_SIZE = RACE.rivals + 1;
