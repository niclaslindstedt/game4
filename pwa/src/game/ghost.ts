// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST — your best run on a map, kept as the CONTROLS that rode it.
//
// The engine is deterministic: a fixed step (`TUNING.physicsHz`), no
// `Math.random`, every draw off the state's own seeded stream. So the same
// map, the same sled, the same help and the same sequence of inputs put the
// machine over the same metre of snow every time, and a ghost is a tape of
// what the rider's hands did rather than a path of where the sled went. A
// few kilobytes for a lap, and a sled that jumps, lands and resets EXACTLY
// the way it did — because it is the same physics doing it rather than an
// interpolation between recorded poses.
//
// THE BARGAIN THAT BUYS IT IS ONE NUMBER PER AXIS. Every control is snapped
// onto a fixed grid at the place the player's input is produced (`snapInput`,
// applied by `input-model.ts`'s `sampleInput`) and again where the app hands
// the engine any input at all, so the figure the engine is driven on is the
// figure the tape writes down. Record anything the engine did not receive
// and the replay walks off the line a checkpoint later — and at 1/127 of
// full lock the grid is finer than a thumb or a key ramp can resolve.
//
// The OTHER half is that step 0 means the same moment in both runs. A tape
// starts at the first step of the game, the lights included (the engine
// holds every input under the lights, `run.ts`, so whoever rode those steps
// wrote nothing that moves the sled), and the two runs advance in lockstep.
//
// WHAT NAMES THE SNOW is a `GhostStage`: the record-book row the run is
// filed under (`records.ts`'s `recordId` — seed, sled, mode, laps) and a
// FINGERPRINT of the map that was ridden (`mapPrint`), because a generator
// that moves under a seed is exactly the case a matching seed would miss. A
// ghost riding a map that is no longer there is worse than no ghost at all.
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE, so `tests/ghost_test.ts` holds it without a browser, and the
// functions under it are the skin over `localStorage`. A ghost that cannot
// be kept is simply not kept — the record it was set on still stands.

import {
  NEUTRAL_INPUT,
  isGameMode,
  isSledId,
  type Assist,
  type GameMode,
  type Level,
  type SledId,
  type SledInput,
} from "@engine";

import { clamp } from "../lib/util.ts";
import { recordId, type RecordKey } from "./records.ts";

/** Steering and lean positions each side of centre. */
const STEER_STEPS = 127;

/** The lever positions: the throttle and the brake. */
const LEVER_STEPS = 255;

/** Bump when the tape's LAYOUT changes, or when what the engine DOES with
 * one changes — the same controls under a retuned sled put it somewhere
 * else, and a ghost that misses every corner is worse than none. A tape
 * whose format this build does not know is dropped and rewritten by the
 * next run on that map. */
export const GHOST_FORMAT = 1;

/** THE BIGGEST TAPE WORTH KEEPING, characters of JSON. `localStorage` is a
 * few megabytes for the whole origin, shared with the record book and the
 * settings; a tape over the cap is dropped rather than risking the store. */
export const GHOST_CAP = 400_000;

/** Snap an axis onto a recorded grid. Centre comes back as a POSITIVE zero:
 * rounding a hair below it yields -0, which the tape cannot write down. */
function snap(v: number, steps: number): number {
  const index = Math.round(v * steps);
  return index === 0 ? 0 : index / steps;
}

/** ONE STEP'S CONTROLS, ON THE GRID THE TAPE WRITES — in place, and
 * returned. Applying it twice is free: a value on the grid snaps to itself. */
export function snapInput(input: SledInput): SledInput {
  input.steer = snap(clamp(input.steer, -1, 1), STEER_STEPS);
  input.lean = snap(clamp(input.lean, -1, 1), STEER_STEPS);
  input.throttle = snap(clamp(input.throttle, 0, 1), LEVER_STEPS);
  input.brake = snap(clamp(input.brake, 0, 1), LEVER_STEPS);
  return input;
}

/** ONE RUN'S CONTROLS AND NOTHING ELSE: how many steps it runs for, and one
 * RLE'd, base64'd byte per step per axis — the reset's edge in `flags`. */
export type ControlTape = {
  steps: number;
  steer: string;
  lean: string;
  throttle: string;
  brake: string;
  flags: string;
};

const STREAMS = ["steer", "lean", "throttle", "brake", "flags"] as const;

/** WHAT NAMES THE SNOW a tape was cut on — see this file's header. */
export type GhostStage = {
  /** The record-book row, and the storage key the tape is kept at. */
  id: string;
  /** The map's fingerprint (`mapPrint`). */
  map: string;
};

/** A FINGERPRINT OF A MAP: FNV-1a over its seed, its loop's length and
 * every checkpoint's place. Cheap, and enough to tell a map the generator
 * has moved from the one a tape was ridden on. */
export function mapPrint(level: Level): string {
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    const n = Math.round(v * 100) | 0;
    for (let s = 0; s < 32; s += 8) {
      hash ^= (n >>> s) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  mix(level.seed);
  mix(level.track.length);
  for (const cp of level.checkpoints) {
    mix(cp.x);
    mix(cp.z);
  }
  return hash.toString(16).padStart(8, "0");
}

/** THE MODES A TAPE IS KEPT FOR: the one ridden ALONE. A race has a field
 * to be measured against instead — and a ghost's run is stepped beside the
 * player's, so a field would have to be stepped twice. */
export const GHOST_MODES: readonly GameMode[] = ["timeTrial"];

/** Which piece of snow a run is on — null on a run that keeps no tape. */
export function ghostStage(key: RecordKey, level: Level): GhostStage | null {
  if (!GHOST_MODES.includes(key.mode)) return null;
  return { id: recordId(key), map: mapPrint(level) };
}

export type GhostRun = GhostStage &
  ControlTape & {
    format: number;
    seed: number;
    sled: SledId;
    mode: GameMode;
    laps: number;
    /** The help the run was ridden with: the ghost rides with it too, since
     * the same hands with another hold on the yaw are another line. */
    assist: Assist;
    /** The time the run set, s. */
    value: number;
  };

const FLAG_RESET = 1;

/** `String.fromCharCode` takes its bytes as arguments, and a whole run's
 * worth at once overflows the call stack. */
const BASE64_CHUNK = 0x8000;

function toBase64(bytes: number[]): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    raw += String.fromCharCode(...bytes.slice(i, i + BASE64_CHUNK));
  }
  return btoa(raw);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Run-length encode a byte per step, then base64 it: (run, value) pairs,
 * a run capped at 255 steps and simply continued in the next pair. A
 * throttle buried down a straight is two bytes for two seconds. */
export function encodeStream(values: readonly number[]): string {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const value = values[i];
    let run = 1;
    while (run < 255 && i + run < values.length && values[i + run] === value) run++;
    out.push(run, value);
    i += run;
  }
  return toBase64(out);
}

/** Decode `steps` bytes back out. A short or damaged tape leaves its tail at
 * zero rather than throwing: a ghost is a picture, and half a picture beats
 * a crash on the first frame of a run. */
export function decodeStream(text: string, steps: number): Uint8Array {
  const out = new Uint8Array(steps);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(text);
  } catch {
    return out;
  }
  let at = 0;
  for (let i = 0; i + 1 < bytes.length && at < steps; i += 2) {
    const run = Math.min(bytes[i], steps - at);
    out.fill(bytes[i + 1], at, at + run);
    at += run;
  }
  return out;
}

export type ControlRecorder = {
  /** Write down the controls a step was ridden on — the input the engine
   * ACTUALLY received. */
  record: (input: SledInput) => void;
  steps: () => number;
  /** The tape as it stands; callable mid-run. */
  seal: () => ControlTape;
};

export function createControlRecorder(): ControlRecorder {
  const steer: number[] = [];
  const lean: number[] = [];
  const throttle: number[] = [];
  const brake: number[] = [];
  const flags: number[] = [];
  return {
    record: (input) => {
      steer.push(Math.round(clamp(input.steer, -1, 1) * STEER_STEPS) + STEER_STEPS);
      lean.push(Math.round(clamp(input.lean, -1, 1) * STEER_STEPS) + STEER_STEPS);
      throttle.push(Math.round(clamp(input.throttle, 0, 1) * LEVER_STEPS));
      brake.push(Math.round(clamp(input.brake, 0, 1) * LEVER_STEPS));
      flags.push(input.reset ? FLAG_RESET : 0);
    },
    steps: () => steer.length,
    seal: () => ({
      steps: steer.length,
      steer: encodeStream(steer),
      lean: encodeStream(lean),
      throttle: encodeStream(throttle),
      brake: encodeStream(brake),
      flags: encodeStream(flags),
    }),
  };
}

export type GhostTape = {
  steps: number;
  /** The controls step `i` was ridden on — neutral once the tape runs out,
   * which is the ghost coasting where its run ended. The object is REUSED:
   * the engine spends an input inside the step it arrives in. */
  at: (step: number) => SledInput;
};

/** Put a tape back on the snow. */
export function readControls(tape: ControlTape): GhostTape {
  const steps = tape.steps;
  const steer = decodeStream(tape.steer, steps);
  const lean = decodeStream(tape.lean, steps);
  const throttle = decodeStream(tape.throttle, steps);
  const brake = decodeStream(tape.brake, steps);
  const flags = decodeStream(tape.flags, steps);
  const input: SledInput = { ...NEUTRAL_INPUT };
  return {
    steps,
    at: (step) => {
      if (step < 0 || step >= steps) return Object.assign(input, NEUTRAL_INPUT);
      input.steer = (steer[step] - STEER_STEPS) / STEER_STEPS;
      input.lean = (lean[step] - STEER_STEPS) / STEER_STEPS;
      input.throttle = throttle[step] / LEVER_STEPS;
      input.brake = brake[step] / LEVER_STEPS;
      input.reset = (flags[step] & FLAG_RESET) !== 0;
      return input;
    },
  };
}

/** Seal a recorder's tape into a run worth keeping. */
export function sealGhost(
  tape: ControlTape,
  stage: GhostStage,
  key: RecordKey,
  assist: Assist,
  value: number,
): GhostRun {
  return {
    ...stage,
    ...tape,
    format: GHOST_FORMAT,
    seed: key.seed,
    sled: key.sled,
    mode: key.mode,
    laps: key.laps,
    assist: { ...assist },
    value,
  };
}

/** Whether a stored run still describes the snow about to be ridden. */
export function ghostMatches(run: GhostRun, stage: GhostStage): boolean {
  return run.format === GHOST_FORMAT && run.id === stage.id && run.map === stage.map;
}

const share = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** Whether a stored blob is a tape this build can put back on the snow —
 * the same rule `mergeRecords` applies: anything that is not a run somebody
 * could have ridden is dropped rather than trusted. */
export function readsAsGhost(parsed: unknown): parsed is GhostRun {
  if (typeof parsed !== "object" || parsed === null) return false;
  const run = parsed as Partial<GhostRun>;
  if (run.format !== GHOST_FORMAT) return false;
  if (typeof run.id !== "string" || typeof run.map !== "string") return false;
  if (typeof run.sled !== "string" || !isSledId(run.sled)) return false;
  if (!isGameMode(run.mode)) return false;
  if (!Number.isInteger(run.seed) || !Number.isInteger(run.laps) || (run.laps as number) < 1) {
    return false;
  }
  if (!run.assist || !share(run.assist.yaw) || !share(run.assist.air)) return false;
  if (typeof run.value !== "number" || !Number.isFinite(run.value) || run.value <= 0) return false;
  if (!Number.isInteger(run.steps) || (run.steps as number) <= 0) return false;
  return STREAMS.every((key) => typeof run[key] === "string");
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

/** ONE KEY PER STAGE: reading the ghost for the map about to be ridden must
 * not mean parsing every tape this machine has kept. */
export const GHOST_PREFIX = "powderrun.ghost.v1:";

export function loadGhost(stage: GhostStage): GhostRun | null {
  try {
    const stored = localStorage.getItem(GHOST_PREFIX + stage.id);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!readsAsGhost(parsed) || !ghostMatches(parsed, stage)) return null;
    return parsed;
  } catch {
    // Storage unavailable, or not JSON — there is simply no ghost.
    return null;
  }
}

export function saveGhost(run: GhostRun): void {
  try {
    const text = JSON.stringify(run);
    if (text.length > GHOST_CAP) return;
    localStorage.setItem(GHOST_PREFIX + run.id, text);
  } catch {
    // Storage unavailable or full — the time is still in the book.
  }
}
