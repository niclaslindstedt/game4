// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the controls a TRICKS run reads off the SHAPE of an input
// rather than its value, and the rider's POSES. THE PUMP is the lean thrown
// to the top of its axis: back, and it buys rotation nose over tail (the
// backflip); forward, and it buys the other way (the front flip). THE TWIRL
// is the bars thrown over, and it buys rotation about the sled's own up axis
// (the 360). Under the skin they are one mechanism read twice.
//
// Both are bookkeeping on an input rather than a force, which is why they
// live here and not in `flight.ts`: a stroke is EARNED by carrying the input
// across a gate near the top of its axis, on a sled that is flying, and
// bought whole out of the flight's budget that step. Below the gate the lean
// and the bars are the ordinary air control — the lean's torque and the
// throttle's gyro behind it — and a rider trimming his pitch for the landing
// never turns a trick by accident. Tap, it turns faster; tap, faster again;
// tap, and nothing more happens, because the flight's budget is spent.
//
// A STROKE IS A THROW, NOT A SNAP. What one buys is WOUND UP rather than
// handed over in a step (`TrickState.flipWind` / `.spinWind`): it is paid
// out along a critically damped rise (`flipWindUp`, `spinWindUp`), so the
// sled gathers, surges and settles at the rate the stroke bought, the way a
// body thrown round takes a machine with it. And a throw HELD is a throw
// still carried: the lean's own torque keeps gathering a held flip, and the
// bars held over on the side they were thrown to keep winding a 360 out of
// the same budget (`spinCarry`) — either builds until the rider lets go, and
// then coasts down under the air's damping. A throw the snow comes back
// under dies with the flight — whatever was still wound is not paid.
//
// YOU CANNOT START A TRICK ON THE WAY DOWN. The first stroke of a flight is
// only spent by a sled still going UP — a rider leaning back as he falls is
// reaching for his landing — and once one has landed the flight is latched
// a trick (`TrickState.tricking`) and every stroke after it is his to throw
// whichever way the sled is going.
//
// A KICKER, AND NOT A BUMP. The lean held across the gate up a kicker's ramp
// is one stroke at the lip: the rider set the trick up. Held anywhere else
// on the snow — leaning back to float through powder, which every rider does
// — the crossing is marked as already made, and the same hold off a crest
// buys nothing until he lets it go and throws it again.
//
// THE POSES. With the trick button held in the air the rider's body is off
// the controls and into a pose: a foot off to the side (the bars over), both
// legs kicked out over the seat (the lean back), or tucked up over the bars
// (the lean forward, or nothing). While he poses the lean and the bars move
// his body and not the sled (`poseInput`), so the sled flies on its own and
// the pose is a thing he has to get out of before the snow comes back
// (`tricks.ts` judges that).
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same rotation.

import { clamp } from "../lib/math.ts";
import { inertiaOf } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState, SledInput, TrickPose } from "./state.ts";

const T = TUNING.tricks;

/** Which pose the lean and the bars ask for with the trick button held. */
export function poseOf(input: SledInput): TrickPose {
  const steer = Math.abs(input.steer);
  if (steer >= 0.5 && steer >= Math.abs(input.lean)) return "oneFoot";
  return input.lean >= 0.5 ? "canCan" : "tuck";
}

/** Whether the rider is posing this step: the trick button, on a run that
 * counts tricks, with the sled off the snow and the rider on it. */
function posing(state: GameState, input: SledInput): boolean {
  const c = state.sled;
  return state.rules.tricks && input.trick === true && c.airborne && c.thrown === null;
}

const posed: SledInput = { steer: 0, throttle: 0, brake: 0, lean: 0, reset: false };

/** THE INPUT THE SLED IS RIDDEN ON while the rider poses: the throttle and
 * the brake are still under his thumbs, but the lean and the bars are his
 * body, and the sled flies on without them. Anything else passes as it is. */
export function poseInput(state: GameState, input: SledInput): SledInput {
  if (!posing(state, input)) return input;
  posed.throttle = input.throttle;
  posed.brake = input.brake;
  posed.reset = input.reset;
  return posed;
}

/** Whether the sled stands on the ramp of a kicker (R4, R9, R20) — where a
 * lean held across the gate is a trick being set up. */
function onRamp(state: GameState): boolean {
  const kickers = state.level.kickers;
  if (!kickers) return false;
  const c = state.sled;
  for (const k of kickers) {
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const dx = c.x - k.x;
    const dz = c.z - k.z;
    const u = dx * fx + dz * fz;
    if (u < -k.ramp || u > 1) continue;
    if (Math.abs(dx * fz - dz * fx) <= k.width / 2) return true;
  }
  return false;
}

/** Which way an axis is across its gate: +1, −1, or 0 at trim. */
function across(value: number, gate: number): number {
  const v = clamp(value, -1, 1);
  return v >= gate ? 1 : v <= -gate ? -1 : 0;
}

/** One step of both stroke detectors and the pose, run after the sled has
 * been stepped (its flight bookkeeping is current), on a run whose rules
 * count tricks. `input` is what the rider asked for, before `poseInput`. */
export function stepStrokes(state: GameState, input: SledInput): void {
  const k = state.tricks;
  const c = state.sled;
  const flip = across(input.lean, T.flipGate);
  const spin = across(input.steer, T.spinGate);

  // THE POSE: chosen off the input every airborne step, its clock restarted
  // whenever it changes. Left standing on the step the snow comes back, so
  // `tricks.ts` can see a landing taken in one.
  if (c.airborne) {
    const pose = posing(state, input) ? poseOf(input) : null;
    if (pose !== k.pose) k.poseTime = 0;
    else if (pose !== null) k.poseTime += TUNING.dt;
    k.pose = pose;
  }

  const flying =
    c.airborne && c.thrown === null && c.airTime >= TUNING.air.counts && c.launchVy >= T.launch;
  if (!flying) {
    k.pumped = 0;
    k.twirled = 0;
    k.tricking = false;
    k.flipWind = 0;
    k.spinWind = 0;
    k.flipPay = 0;
    k.spinPay = 0;
    k.spinSide = 0;
    if (!c.airborne) {
      // ARMED on the snow: across the gate up a kicker's ramp is a stroke
      // waiting for the lip; anywhere else it is a crossing already made.
      const ramp = onRamp(state);
      k.flipCrossed = ramp ? 0 : flip;
      k.spinCrossed = ramp ? 0 : spin;
    }
    return;
  }
  if (k.pose !== null) {
    // Posing: the body is busy, and whatever the axes are doing is the
    // pose's — nothing is thrown and nothing carried, though a throw
    // already wound is still paid out below. Let go, they must be thrown
    // afresh.
    k.flipCrossed = flip;
    k.spinCrossed = spin;
    k.spinSide = 0;
  } else {
    throwStrokes(state, flip, spin);
  }

  // THE THROW PAID OUT, a critically damped rise on each axis toward what
  // the strokes have wound: the rate paid grows from nothing, peaks and
  // dies away as the wind runs out. Nose up is a negative `wx` (`state.ts`),
  // so a backflip's wind takes rate off it; a positive `wy` turns the nose
  // clockwise, the way positive bars steer.
  const dt = TUNING.dt;
  const fw = T.flipWindUp;
  k.flipPay += (fw * fw * k.flipWind - 2 * fw * k.flipPay) * dt;
  const pitch = k.flipPay * dt;
  k.flipWind -= pitch;
  c.wx -= pitch;
  const sw = T.spinWindUp;
  k.spinPay += (sw * sw * k.spinWind - 2 * sw * k.spinPay) * dt;
  const yaw = k.spinPay * dt;
  k.spinWind -= yaw;
  c.wy += yaw;
}

/** The strokes a flying, unposed rider throws this step, and the 360 he is
 * still carrying — wound onto each axis out of the flight's budget. */
function throwStrokes(state: GameState, flip: number, spin: number): void {
  const k = state.tricks;
  const c = state.sled;
  const may = k.tricking || c.vy > 0;
  let I: { x: number; y: number; z: number } | null = null;

  // THE PUMP, wound the way the lean went: back (+1) is the backflip.
  if (flip === 0) k.flipCrossed = 0;
  else if (flip !== k.flipCrossed && may) {
    I = inertiaOf(c.spec);
    const rate = Math.min(T.flip / I.x, Math.max(T.flipCeiling - k.pumped, 0));
    if (rate > 0) {
      k.flipWind += flip * rate;
      k.pumped += rate;
      k.tricking = true;
    }
    k.flipCrossed = flip;
  }

  // THE TWIRL, about the up axis. A throw to the other side crosses the
  // centre and is a fresh stroke — the brake on a spin, or the start of one
  // the other way, out of the same budget.
  if (spin === 0) {
    k.spinCrossed = 0;
    k.spinSide = 0;
  } else if (spin !== k.spinCrossed && may) {
    I ??= inertiaOf(c.spec);
    const rate = Math.min(T.spin / I.y, Math.max(T.spinCeiling - k.twirled, 0));
    if (rate > 0) {
      k.spinWind += spin * rate;
      k.twirled += rate;
      k.tricking = true;
    }
    k.spinCrossed = spin;
    k.spinSide = spin;
  } else if (spin === k.spinSide) {
    // HELD where it was thrown: the 360 is still being carried.
    const rate = Math.min(T.spinCarry * TUNING.dt, Math.max(T.spinCeiling - k.twirled, 0));
    k.spinWind += spin * rate;
    k.twirled += rate;
  }
}
