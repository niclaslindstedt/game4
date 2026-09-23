// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS, taken off the state about twelve times a second. The
// canvas is the sixty-frame surface; the HUD is not, and a readout that
// re-rendered every frame would spend more on the DOM than on the snow. So
// the loop takes THIS every ~80 ms and the HUD draws from it. DOM-free — a
// snapshot is numbers, and the same numbers a lab could print.
//
// Nothing in here decides anything: the speed is the engine's `speed`, the
// rev fraction is against the engine's own redline, the lap and the
// checkpoint count are the progress the engine keeps, the place is
// `racePlace` and the standings are `fieldOrder`. A number that decided an
// outcome would be a rule in the shell (§23.2), and there are none.

import {
  TUNING,
  bearingToNext,
  fieldOrder,
  maxRpm,
  racePlace,
  type GameState,
  type Progress,
} from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";
import { buildMinimap, type HudMinimap } from "./minimap-view.ts";

/** The brake's share past which the rev bar says the brake is on. */
const BRAKE_SHOWN = 0.05;

/** How long GO stays on screen after the lights go out, s of race clock. */
const GO_HOLD = 1;

/** How long the SPLIT chip holds the clock at the last checkpoint, s of race
 * clock — long enough to read it off the corner between two checkpoints,
 * gone before the next so a stale split is never read as a fresh one. */
const SPLIT_HOLD = 6;

/** One rider on the finish plate's table. */
export type Standing = {
  /** 1-based, in `fieldOrder`'s order. */
  place: number;
  /** Grid slot, 1-based: the player is 1, the rivals 2… — what a rival is
   * called on the table (`strings.ts`). */
  slot: number;
  you: boolean;
  /** The race clock at the flag, or null while still out on the loop. */
  time: number | null;
  /** The lap being ridden, for a rider still out. */
  lap: number;
};

export type HudSnapshot = {
  speedKmh: number;
  /** Revs as a share of the redline, 0..1, and where idle sits on the same
   * scale — the bar starts there. */
  rpm: number;
  idle: number;
  /** The brake lever is on (the machine's own reading, after its lag). */
  braking: boolean;
  /** The race clock, s, and whether it has stopped. */
  time: number;
  finished: boolean;
  /** THE LIGHTS: the whole second showing (3, 2, 1) while they hold the
   * field, and 0 once they are out. `go` is the moment after, read off the
   * engine's clock so nothing here keeps time. */
  countdown: number;
  go: boolean;
  /** THE FIELD: where the rider stands, 1-based, and how many are in it. */
  place: number;
  riders: number;
  /** Which lap is being ridden, 1-based, and how many there are. */
  lap: number;
  laps: number;
  /** Checkpoints taken this lap — the line that opened it included — and
   * how many the loop has. */
  taken: number;
  checkpoints: number;
  /** The race clock at the last checkpoint taken, while it is fresh; null
   * otherwise. */
  split: number | null;
  /** THE AIR CLOCK, s — the flight so far, and 0 until it has lasted
   * `TUNING.air.counts`: a hop off a bump is not air time, and a readout
   * that counted it would flicker through every mogul. */
  airTime: number;
  /** The flight in progress is the race's longest so far. */
  airBest: boolean;
  /** THE MISSED CHECKPOINT: where it is as a SCREEN angle, rad clockwise
   * from straight ahead, and how far, m — or null with nothing owed. */
  missed: { angle: number; distance: number } | null;
  seed: number;
  /** THE FINISH: the player's own result once the flag has fallen, and the
   * whole field's table under it — live, because the field is still racing
   * home behind the rider. Null until then. */
  result: { place: number; time: number } | null;
  standings: Standing[] | null;
  /** THE MINIMAP: the plate's pose and every mark on it
   * (`minimap-view.ts`). */
  minimap: HudMinimap;
};

/** The lap a run is on, 1-based, and never past the last: the final
 * crossing of the line belongs to the last lap, not to one after it. */
export function lapOf(p: Progress, laps: number): number {
  return Math.min(laps, p.lap + 1);
}

/** Checkpoints taken in the lap being ridden, the start line that opened it
 * counted as the first. Before the line is first crossed, none; after the
 * flag, all of them — the crossing that ended the race closed its last lap
 * rather than opening a fourth. */
export function takenThisLap(p: Progress, checkpoints: number): number {
  if (p.finished) return checkpoints;
  if (!p.started) return 0;
  return p.nextCheckpoint === 0 ? checkpoints : p.nextCheckpoint;
}

/** THE TABLE: every rider in `fieldOrder`'s order. */
export function standingsOf(state: GameState): Standing[] {
  const laps = state.rules.laps;
  return fieldOrder(state).map((id, i) => {
    const rival = id === null ? null : state.rivals.find((r) => r.id === id);
    const run = rival ? rival.run : state;
    const p = run.progress;
    return {
      place: i + 1,
      slot: id === null ? 1 : id + 2,
      you: id === null,
      time: p.finished ? p.time : null,
      lap: lapOf(p, laps),
    };
  });
}

export function takeSnapshot(state: GameState): HudSnapshot {
  const c = state.sled;
  const p = state.progress;
  const n = state.level.checkpoints.length;
  const laps = state.rules.laps;
  const last = p.lastCheckpoint;
  const lastAt = last >= 0 ? p.splits[last] : Number.NaN;
  const airTime = c.airborne && c.airTime > TUNING.air.counts ? c.airTime : 0;
  const owed = p.missed !== null ? bearingToNext(state) : null;
  return {
    speedKmh: c.speed * 3.6,
    rpm: c.rpm / maxRpm(c.spec),
    idle: c.spec.idleRpm / maxRpm(c.spec),
    braking: c.brake > BRAKE_SHOWN,
    time: p.time,
    finished: p.finished,
    countdown: state.phase === "countdown" ? Math.ceil(state.countdown) : 0,
    go: state.rules.countdown > 0 && state.phase !== "countdown" && p.time < GO_HOLD,
    place: racePlace(state),
    riders: state.rivals.length + 1,
    lap: lapOf(p, laps),
    laps,
    taken: takenThisLap(p, n),
    checkpoints: n,
    split: Number.isFinite(lastAt) && p.time - lastAt < SPLIT_HOLD && !p.finished ? lastAt : null,
    airTime,
    airBest: airTime > 0 && airTime > p.bestAir,
    missed: owed ? { angle: owed.error * SCREEN_TO_ENGINE, distance: owed.distance } : null,
    seed: state.seed,
    result: p.finished ? { place: racePlace(state), time: p.time } : null,
    standings: p.finished ? standingsOf(state) : null,
    minimap: buildMinimap(state),
  };
}
