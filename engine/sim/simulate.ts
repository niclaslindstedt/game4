// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The headless simulation harness: run the REAL engine — createGame, step,
// the bot rider — with no renderer attached, and report what happened.
// This is how handling and generator changes are measured (scripts/
// simulate-run.mjs renders the tables) and how the sim tests assert that
// the bot finishes what the generator builds. Runs are deterministic: the
// same seed and level always produce the same digest.

import { TUNING } from "../game/defs/tuning.ts";
import { createGame, step } from "../game/step.ts";
import type { GameEvent } from "../game/state.ts";
import type { Level } from "../mapgen/types.ts";
import { botInput, RIDER_BOT, type BotProfile } from "./bot.ts";

export type SimOptions = {
  /** A map to ride instead of the seed's own. */
  level?: Level;
  /** Laps (the level's own when left out). */
  laps?: number;
  /** Rivals on the grid beside the bot (0 when left out: a solo run is the
   * measurement; a field is the race). */
  rivals?: number;
  profile?: BotProfile;
  /** Give up after this much simulated time, s. */
  maxSeconds?: number;
  /** Keep every event in the report. */
  keepEvents?: boolean;
};

export type RunReport = {
  seed: number;
  finished: boolean;
  /** Race clock at the flag (or the timeout), s. */
  time: number;
  laps: number;
  lapTimes: number[];
  /** Checkpoints credited, of the race's total crossings. */
  checkpoints: number;
  crossings: number;
  trackLength: number;
  /** m/s. */
  topSpeed: number;
  /** Mean speed over the race clock, m/s. */
  meanSpeed: number;
  /** Seconds of air — the flights that counted, summed — the longest one,
   * and how many there were. */
  airTime: number;
  bestAir: number;
  jumps: number;
  harshLandings: number;
  treeHits: number;
  bumps: number;
  resets: number;
  autoResets: number;
  missed: number;
  /** Where the bot finished against the field (1 on a solo run). */
  place: number;
  events: GameEvent[];
  /** FNV-1a over sampled positions and speeds — the determinism fingerprint. */
  digest: string;
};

/** How long a run is given before the harness gives up, s: three laps of
 * a four-kilometre loop at a crawl. It catches a rider who has STOPPED. */
export const SIM_SECONDS = 900;

/** Ride one map headlessly with the bot. */
export function simulateRun(seed: number, options: SimOptions = {}): RunReport {
  const profile = options.profile ?? RIDER_BOT;
  const maxSeconds = options.maxSeconds ?? SIM_SECONDS;
  const state = createGame({
    seed,
    level: options.level,
    laps: options.laps,
    rivals: options.rivals ?? 0,
    countdown: 0,
    quiet: true,
  });
  const events: GameEvent[] = [];
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    hash ^= Math.round(v * 100) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  let topSpeed = 0;
  let airTime = 0;
  let jumps = 0;
  let harsh = 0;
  let treeHits = 0;
  let bumps = 0;
  let resets = 0;
  let autoResets = 0;
  let missed = 0;
  let place = 1;
  let distance = 0;
  const maxSteps = Math.ceil(maxSeconds / TUNING.dt);
  let steps = 0;
  while (state.phase !== "finished" && steps < maxSteps) {
    step(state, botInput(state, profile));
    for (const e of state.events) {
      if (options.keepEvents) events.push(e);
      if (e.kind === "land") {
        if (e.airTime > 0.3) {
          airTime += e.airTime;
          jumps += 1;
        }
        if (e.harsh) harsh += 1;
      } else if (e.kind === "hit") treeHits += 1;
      else if (e.kind === "bump") bumps += 1;
      else if (e.kind === "reset") {
        resets += 1;
        if (e.auto) autoResets += 1;
      } else if (e.kind === "missed") missed += 1;
      else if (e.kind === "finish") place = e.place;
    }
    const c = state.sled;
    if (c.speed > topSpeed) topSpeed = c.speed;
    distance += Math.hypot(c.vx, c.vz) * TUNING.dt;
    steps += 1;
    if (steps % 30 === 0) {
      mix(c.x);
      mix(c.z);
      mix(c.speed);
    }
  }
  mix(state.sled.x);
  mix(state.sled.y);
  mix(state.sled.z);
  const p = state.progress;
  return {
    seed,
    finished: p.finished,
    time: p.time,
    laps: p.lap,
    lapTimes: p.lapTimes,
    checkpoints: p.passed,
    crossings: 1 + state.level.checkpoints.length * state.rules.laps,
    trackLength: state.level.track.length,
    topSpeed,
    meanSpeed: p.time > 0 ? distance / p.time : 0,
    airTime,
    bestAir: p.bestAir,
    jumps,
    harshLandings: harsh,
    treeHits,
    bumps,
    resets,
    autoResets,
    missed,
    place,
    events,
    digest: hash.toString(16).padStart(8, "0"),
  };
}
