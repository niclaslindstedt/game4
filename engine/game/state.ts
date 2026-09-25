// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The engine's state and event types. The renderer, the HUD and the bot all
// read this shape; only sled.ts, collision.ts, course.ts and step.ts write it
// during a run, and place.ts stands one at a moment before it starts.
//
// Sign conventions (`lib/quat.ts` owns the flips): heading 0 points along +z
// and grows clockwise seen from above (positive steer turns the nose
// clockwise in map view); pitch is nose-up positive; roll is right-side-down
// positive; body-frame angular velocities are right-handed about the sled's
// right (x), up (y) and forward (z) axes, so a nose-up pitch rate is a
// NEGATIVE `wx` and a right-side-down roll rate a negative `wz`.

import type { Rng } from "../lib/prng.ts";
import type { Quat } from "../lib/quat.ts";
import type { Level } from "../mapgen/types.ts";
import type { SledSpec } from "./defs/sled.ts";
import type { Assist, RunRules } from "./defs/modes.ts";

export type SledInput = {
  /** -1..1; positive steers clockwise (right in map view). The rider hangs
   * off into the turn with it — there is no separate side-lean control. */
  steer: number;
  /** 0..1, analogue — the thumb throttle. */
  throttle: number;
  /** 0..1, analogue — the brake lever. The tread never runs backwards. */
  brake: number;
  /** -1..1; +1 is the rider leaning BACK (nose up), -1 forward. On the snow
   * it moves his weight fore and aft; in the air it is the pitch control. */
  lean: number;
  /** Edge-triggered: stand the sled back on the track at the last
   * checkpoint it took — on a free ride, at the nearest point of the
   * track (`course.ts`). */
  reset: boolean;
  /** HELD: the rider's body is off the controls and into a POSE
   * (`strokes.ts`) — which one the lean and the bars say. Read only on a
   * run whose rules count tricks, and only in the air; left out, it is
   * off. */
  trick?: boolean;
};

export const NEUTRAL_INPUT: SledInput = { steer: 0, throttle: 0, brake: 0, lean: 0, reset: false };

/** ONE PROBE WHERE THE MACHINE MEETS THE SNOW — a ski, or one station of
 * the tread — as the renderer needs it to stamp a trail: where the footprint
 * is, how deep into the snow it is pressed, and whether it is touching at
 * all. Rewritten every step; `touching` false leaves the rest at the last
 * place it touched. */
export type SnowContact = {
  kind: "ski" | "tread";
  /** -1 left, +1 right (of the sled's centreline). */
  side: number;
  /** The footprint, world frame, m: on the SNOW SURFACE (`level.groundAt`)
   * under the probe — the top of the trough it cuts, not its floor. */
  x: number;
  y: number;
  z: number;
  /** How far the footprint is pressed below the untouched surface, m —
   * the trail's depth. */
  sink: number;
  /** Width of snow this probe presses, m. */
  width: number;
  /** Suspension compression, m (0 at full extension), and the load, N. */
  compression: number;
  load: number;
  touching: boolean;
};

export type SledState = {
  spec: SledSpec;
  /** Centre of gravity, m, world frame. */
  x: number;
  y: number;
  z: number;
  /** Velocity, m/s, world frame. */
  vx: number;
  vy: number;
  vz: number;
  /** Orientation, body → world. Full 3D so a rollover is representable. */
  q: Quat;
  /** Angular velocity, BODY frame, rad/s (see the header for the signs). */
  wx: number;
  wy: number;
  wz: number;
  /** Derived from `q` each step for the HUD, the camera and the bot; nobody
   * integrates these. */
  heading: number;
  pitch: number;
  roll: number;
  /** |v|, m/s, vertical included — what the speedo reads. Written once at
   * the end of the step. */
  speed: number;
  /** The way made good along the sled's own nose, flattened, m/s — signed. */
  way: number;
  /** Engine speed, rpm. */
  rpm: number;
  /** The inputs as the machine has them, after their lags: the throttle
   * 0..1, the brake 0..1, the bars -1..1 and the lean -1..1. */
  throttle: number;
  brake: number;
  steer: number;
  lean: number;
  /** The skis' actual angle, rad, positive clockwise. */
  skiAngle: number;
  /** Where the rider's mass currently sits, m: to the sled's right, and aft
   * of nominal. Lags the bars and the lean. */
  riderRight: number;
  riderAft: number;
  /** The tread's surface speed, m/s — and how much faster it is running
   * than the snow under it (wheelspin), m/s. */
  treadSpeed: number;
  slip: number;
  /** Share of the machine's load on packed snow, 0..1, this step. */
  packed: number;
  /** Every probe (`SnowContact`): the two skis first (left, right), then
   * the tread's stations front to back, left before right. */
  contacts: SnowContact[];
  /** Suspension compression per ski, m (left, right), and the tread's
   * mean — the renderer's spring heights. */
  skiCompression: [number, number];
  treadCompression: number;
  /** True while nothing is touching the snow; `airTime` is the seconds
   * since it left, 0 when grounded. */
  airborne: boolean;
  airTime: number;
  /** The vertical speed it left with, m/s, for the `air` event, and
   * whether that event has been reported for this flight. */
  launchVy: number;
  airReported: boolean;
  /** Seconds since the last landing; starts large. */
  landing: number;
  /** Seconds on its side or back, and seconds held at full throttle going
   * nowhere — the automatic reset's two clocks. */
  overFor: number;
  stuckFor: number;
  /** THE TRENCH (`trench.ts`): how far the tread has dug itself into the
   * powder under it, m, on top of the sink — and seconds it has been
   * trenched, the automatic reset's third clock; and seconds it has been
   * bogged (on the gas going nowhere in powder), which is when it digs. */
  trench: number;
  trenchFor: number;
  boggedFor: number;
  /** Seconds lying over on the snow (`crash.ts`) — the rollover wipeout's
   * clock; turning over in the air does not run it. */
  rolledFor: number;
  /** THE RIDER OFF THE SLED, or null while he is on it (`crash.ts`). */
  thrown: Thrown | null;
  /** What the machine has taken (`damage.ts`). */
  damage: SledDamage;
  /** Seconds before another tree hit (or sled bump) is reported. */
  hitCooldown: number;
  bumpCooldown: number;
  /** The support depth each probe has settled to, m — the snow's own lag
   * (`snow.ts`), one per `contacts` entry. */
  sinks: number[];
  /** Each probe's compression at the last step, m (0 when it was not
   * touching) — what the damper's rate is read off (`sled.ts`). */
  comps: number[];
};

/** WHAT PUT THE RIDER OFF (`crash.ts`): a trunk met hard, a landing taken
 * on the nose, or the sled going over at speed. */
export type CrashCause = "tree" | "nose" | "roll";

/** THE RIDER THROWN — a body of his own from the moment he leaves the sled
 * until the reset stands them both back on the track (`crash.ts`): a
 * RAGDOLL (`ragdoll.ts`), thirteen points held together at the joints and
 * each meeting the snow and the trunks on its own, so he flops, slides and
 * comes to rest the way a body does. Written by `stepThrown` only; the
 * renderer hangs the figure on `points` and stamps the snow where he is
 * `touching`. */
export type Thrown = {
  cause: CrashCause;
  /** Seconds since he left the sled. */
  t: number;
  /** His centre of mass, world frame, m, and its velocity, m/s — what the
   * camera follows and the reset waits on. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The bearing he was thrown along, rad (0 = +z, clockwise), and how far
   * his spine has turned in all since, rad — the tumble, counted. */
  heading: number;
  tumble: number;
  /** The body's points (`RAGDOLL` order), x y z each, world frame, m, and
   * where they were a step ago — the velocity is the difference. */
  points: number[];
  last: number[];
  /** Some part of him on the snow this step. */
  touching: boolean;
  /** Seconds he has lain STILL on the snow — every point under
   * `crash.restSpeed`, touching — without a break: what the reset waits on. */
  still: number;
};

/** A part `damage.ts` keeps a figure for. */
export type DamagePart = "skiLeft" | "skiRight" | "suspension";

/** WHAT THE MACHINE HAS TAKEN (`damage.ts`), each 0 sound … 1 wrecked:
 * the two skis (left, right) and the suspension. Kept only on a run that
 * asked for damage (`GameState.damage`); all zero, and read as nothing,
 * otherwise. A reset does not mend it. */
export type SledDamage = {
  ski: [number, number];
  suspension: number;
};

/** WHAT A RIDER CAN BE PAID FOR (`tricks.ts`) — the engine names the
 * thing and never the word (`pwa/src/game/strings.ts` owns those):
 * - `air` — the flight itself as an element, credited only beside a trick;
 * - `backflip` / `frontflip` — a revolution nose over tail, either way;
 * - `spin` — a revolution about the sled's own up axis (the 360);
 * - `twist` — a flip and a spin both come round in ONE flight;
 * - the three POSES (`TrickPose`), a rider's body held off the sled. */
export type TrickKind = "air" | "backflip" | "frontflip" | "spin" | "twist" | "landing" | TrickPose;

/** THE RIDER'S POSES, picked with the trick button held in the air by what
 * the lean and the bars say (`strokes.ts`'s `poseOf`): a foot off to the
 * side (the bars over), both legs kicked out over the seat (the lean back),
 * or tucked up over the bars (the lean forward, or nothing). */
export type TrickPose = "oneFoot" | "canCan" | "tuck";

/** One element of a combo: what it was, which revolution of its flight
 * (1 for everything that is not a revolution), and which flight of the
 * combo won it (1-based). */
export type TrickPart = { kind: TrickKind; spins: number; flight: number };

/** THE SCORE AND ITS COMBO, and the strokes' per-flight bookkeeping
 * (`tricks.ts`, `strokes.ts` — every rule is theirs). Written only there. */
export type TrickState = {
  /** Points banked this run. */
  score: number;
  /** The combo in hand: its base, points, and its multiplier. */
  base: number;
  mult: number;
  /** Seconds left on the snow before the combo banks. */
  link: number;
  /** This flight's rotation, rad, nose-up positive, and about the up axis
   * (either way), and the whole revolutions of each already paid. */
  rotation: number;
  spins: number;
  yaw: number;
  turns: number;
  /** Where this flight left the snow, and the metres of it already paid. */
  fromX: number;
  fromZ: number;
  paidLength: number;
  /** This flight has lasted `airElement`; its rung has been sold; a flip
   * and a spin have both come round in it. */
  aired: boolean;
  airPaid: boolean;
  twisted: boolean;
  /** THE POSE held now, or null, how long it has been held, and the poses
   * already bought this flight. */
  pose: TrickPose | null;
  poseTime: number;
  posed: TrickPose[];
  /** THE STROKES: rad/s already spent this flight on each axis, which way
   * each input is still across its gate from the last stroke (0 back at
   * trim, ±1 the side it crossed to), and whether this flight is a trick
   * (a first stroke thrown going up latches it). */
  pumped: number;
  twirled: number;
  flipCrossed: number;
  spinCrossed: number;
  tricking: boolean;
  /** The sled was in the air at the last step this module saw. */
  inAir: boolean;
  /** The combo's elements, and which flight of it this is. */
  parts: TrickPart[];
  flight: number;
  /** The last combo closed: its points, when, whether it was lost, and its
   * elements — what a readout holds up after the fact. */
  last: number;
  lastAt: number;
  lastBailed: boolean;
  lastParts: TrickPart[];
};

/** Why a combo was lost (`tricks.ts`): the rider thrown off, the sled put
 * back on the track, or a landing taken still in a pose. */
export type BailCause = "wipeout" | "reset" | "pose";

/** The engine's name for the ridden machine, kept for the vocabulary the
 * sibling games share. */
export type CraftState = SledState;

export type Progress = {
  /** The checkpoint the run OWES next — 0 until the start line is first
   * crossed, then 1, 2 … and back to 0 at the end of every lap. */
  nextCheckpoint: number;
  /** Whether the start line has been crossed once (the first lap is on). */
  started: boolean;
  /** Laps completed. */
  lap: number;
  /** Checkpoints credited in total, the first start-line crossing included
   * — the standings' first measure. */
  passed: number;
  /** The last checkpoint credited, -1 before the start line. */
  lastCheckpoint: number;
  /** Run clock at each checkpoint's latest crossing, s (NaN until). */
  splits: number[];
  /** The clock at each lap's end, s, and when the current lap began. */
  lapTimes: number[];
  lapStart: number;
  /** The run clock, s — from GO; stops at the flag. */
  time: number;
  finished: boolean;
  /** A checkpoint the rider went past without taking — the HUD's arrow
   * points back at it until it is taken. Null when none. */
  missed: number | null;
  /** The clock when a checkpoint was last taken and when the sled was last
   * reset, s — "no progress for a while" is measured from the later. */
  lastPassedAt: number;
  lastResetAt: number;
  /** The run's longest flight, s. */
  bestAir: number;
  /** How far the sled has been ridden, m of plan distance — a reset's jump
   * not counted. The free ride's odometer; a race keeps it too. */
  distance: number;
};

/** ANOTHER RIDER ON THE SAME SNOW (`rivals.ts`): a whole run of its own
 * over the player's very level, rules and stream. `pace` is the throttle
 * its bot is allowed, dealt once at the grid; `id` its grid slot less one. */
export type Rival = {
  id: number;
  run: GameState;
  pace: number;
};

export type GameEvent =
  /** ONE LIGHT: `left` whole seconds still to run (3, 2, 1). */
  | { kind: "count"; t: number; left: number }
  /** The lights are out and the clock runs. */
  | { kind: "go"; t: number }
  /** The sled has been off the snow long enough to count as air
   * (`air.counts`); `vy` is the climb it left with, m/s. */
  | { kind: "air"; t: number; vy: number; speed: number }
  /** Back on the snow after `airTime` s. `impact` is the speed INTO the
   * slope it met, m/s; `harsh` whether the suspension could not take it
   * all, and `lost` the share of its way that cost. */
  | {
      kind: "land";
      t: number;
      airTime: number;
      impact: number;
      speed: number;
      harsh: boolean;
      lost: number;
    }
  /** A trunk met at `speed` m/s closing. */
  | { kind: "hit"; t: number; speed: number; x: number; z: number }
  /** THE RIDER THROWN OFF: why, how fast the sled was going, and where. */
  | { kind: "wipeout"; t: number; cause: CrashCause; speed: number; x: number; z: number }
  /** The tread has dug itself in (`trench.ts`): rock it out or reset. */
  | { kind: "stuck"; t: number }
  /** A part of the machine has taken a blow worth saying (`damage.ts`):
   * which, and how bad it now is, 0..1. */
  | { kind: "damage"; t: number; part: DamagePart; level: number }
  /** Another sled — the player's own contact with rival `rival`. */
  | { kind: "bump"; t: number; rival: number; speed: number }
  /** A checkpoint taken: its index, the lap it was taken on (0 before the
   * first line), and the clock. */
  | { kind: "checkpoint"; t: number; index: number; lap: number; split: number }
  /** A checkpoint ridden past without being taken. */
  | { kind: "missed"; t: number; index: number }
  /** A lap finished: `lap` is how many are done, `time` that lap's own. */
  | { kind: "lap"; t: number; lap: number; time: number }
  /** The flag: the whole race's `time`, and the `place` it earned. */
  | { kind: "finish"; t: number; time: number; place: number }
  /** Stood back on the track at `checkpoint` (-1: behind the start line);
   * `auto` when the engine did it rather than the rider. */
  | { kind: "reset"; t: number; checkpoint: number; auto: boolean }
  /** AN ELEMENT WON (`tricks.ts`): which, which revolution of its flight,
   * what it added to the base, and the multiplier now. */
  | { kind: "trick"; t: number; trick: TrickKind; spins: number; points: number; mult: number }
  /** THE COMBO BANKED: `points` (= `base × mult`) went into the score; a
   * `sketchy` landing banked it at its base alone. */
  | { kind: "combo"; t: number; points: number; base: number; mult: number; sketchy: boolean }
  /** THE COMBO LOST, and what it would have been worth. */
  | { kind: "bail"; t: number; lost: number; cause: BailCause };

/** `countdown` is the lights: the engines idle, nothing is steered and the
 * clock reads 0. `racing` runs the clock; `finished` coasts. */
export type GamePhase = "countdown" | "racing" | "finished";

export type GameState = {
  seed: number;
  rng: Rng;
  /** Sim time since creation, s, and the number of steps taken. */
  t: number;
  tick: number;
  level: Level;
  sled: SledState;
  /** The input the last step was given — what the HUD reads back. */
  input: SledInput;
  progress: Progress;
  rules: RunRules;
  /** The arcade's help (`Assist`), 0..1 per hand; the field always rides
   * with every hand on. */
  assist: Assist;
  /** Whether blows bend the machine (`damage.ts`) — the player's option,
   * off unless asked for; a rival never takes damage. */
  damage?: boolean;
  /** THE SNOW DIAL (`SNOW_DIAL`): the powder's sink as a multiple of the
   * ordinary snow's, 1 unless the run asked otherwise. Read, never written,
   * during a run, and shared with the field. */
  snowDepth: number;
  /** THE NEW SNOW, m: what the fall (`snowfall.ts`) has laid since the run
   * was stood up — 0 under a sky that does not snow, centimetres an hour
   * under one that does. Written once a step by `step`, shared with the
   * field, and read through `packedUnder` / `depthUnder` wherever the
   * surface is. */
  fresh: number;
  /** THE FIELD: every other rider, in grid order; empty on a solo run. */
  rivals: Rival[];
  /** THE SCORE (`tricks.ts`): kept on every run — the sim reads it — and
   * worked for (`strokes.ts`) only on one whose rules count tricks. */
  tricks: TrickState;
  /** Seconds of the lights still to run; 0 once they are out. */
  countdown: number;
  phase: GamePhase;
  /** This step's events, cleared at the top of each step. */
  events: GameEvent[];
};
