// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INPUT MATHS, with no DOM in it: what a held key ramps to, what a thumb
// on the glass is asking for, and the one sign flip between the screen and
// the engine. `input.ts` owns the listeners and hands this module pixels
// and key states; `hud-touch.tsx` hands it drags. Everything here is a pure
// function of its arguments so the root suite can hold the feel numbers to
// their shape without a browser (tests/input_model_test.ts).
//
// SIGN BOUNDARY, stated ONCE. Everything on the screen side is SCREEN-space:
// positive steer means "the nose goes right as seen through the chase
// camera". The engine's positive steer is CLOCKWISE IN MAP VIEW (heading
// grows from +z toward +x), and the renderer maps engine axes straight onto
// three.js's right-handed y-up frame, whose view from behind the sled
// MIRRORS the map — so from the saddle the engine's positive steer is a
// LEFT turn. `SCREEN_TO_ENGINE` is that flip; `sampleInput` applies it to
// the steer, the HUD's missed-checkpoint arrow applies it to a bearing, and
// nothing else may.

import type { SledInput } from "@engine";

import { clamp } from "../lib/util.ts";

export const SCREEN_TO_ENGINE = -1;

/** Keyboard steering ramp, 1/s: a held key eases toward full lock at this
 * rate (about a sixth of a second to full)... */
export const KEY_STEER_ATTACK = 6;
/** ...and a released one snaps back to centre at this one — faster, so
 * letting go is letting go, not a slow unwind. */
export const KEY_STEER_RELEASE = 9;
/** Below this the centred keyboard axis snaps to exactly zero. */
export const KEY_AXIS_SNAP = 0.02;
/** The throttle key's ramp, 1/s: a quarter-second time constant, so a tap
 * is a blip and a hold is the whole engine; and a release that lets go at
 * once, because letting go of a thumb throttle is letting go. */
export const KEY_THROTTLE_ATTACK = 4;
export const KEY_THROTTLE_RELEASE = 12;
/** The brake key's ramp, 1/s — quick both ways: a brake lever is GRABBED,
 * not squeezed, and the engine's own lag on it (`SledState.brake`) is what
 * is meant to soften it, not a second made-up lag here. */
export const KEY_BRAKE_ATTACK = 20;
export const KEY_BRAKE_RELEASE = 30;
/** The lean keys' ramp, 1/s. Quick, because in the air the lean IS the
 * pitch control and a rider fixing a landing has a fraction of a second to
 * do it in; coming back to centre is quicker still. */
export const KEY_LEAN_ATTACK = 10;
export const KEY_LEAN_RELEASE = 14;

/** Walk `value` toward `target` at `attack` per second when the target is
 * away from centre and `release` when it is centre, over `dt` seconds. A
 * first-order ease rather than a linear ramp: the first bit of lock arrives
 * quickly and the last bit settles, which is what a hand does. */
export function rampToward(
  value: number,
  target: number,
  dt: number,
  attack: number,
  release: number,
): number {
  const rate = target === 0 ? release : attack;
  const next = value + (target - value) * Math.min(1, rate * dt);
  return target === 0 && Math.abs(next) < KEY_AXIS_SNAP ? 0 : next;
}

/** THE THROTTLE LEVER. A touch anchors the lever WIDE OPEN under the thumb:
 * a thumb on the glass is a rider on the gas, which is what a race asks of
 * him nearly all the time, and a lever that opened only as it was dragged
 * made every start and every exit a hand-over. Anywhere at or below the
 * anchor is full; sliding UP eases the throttle off over `LEVER_EASE_PX`,
 * and the lever is shut at the top of that throw. Anchoring at the touch
 * point rather than at a fixed zero means the lever works wherever the thumb
 * lands. */
export const LEVER_EASE_PX = 60;
/** ...and further UP again is the BRAKE: past a small dead band over the
 * shut point, so a thumb easing off never grabs it by accident, this much
 * more travel is the lever pulled all the way. */
export const LEVER_BRAKE_DEAD_PX = 12;
export const LEVER_BRAKE_PX = 60;

/** HOW A RIDER HAS ASKED THE THUMBS TO FEEL (OPTIONS ▸ CONTROLS):
 * `sensitivity` multiplies every thumb's travel before it is read, so above
 * one the whole throw is shorter; `invertLean` reads the bar pushed AWAY as
 * the lean back, the way a flight stick does. The keys never pass through
 * it — a key is a whole press either way, and the binding page is how a key
 * is turned round. */
export type TouchFeel = { sensitivity: number; invertLean: boolean };
export const PLAIN_FEEL: TouchFeel = { sensitivity: 1, invertLean: false };

/** How open the throttle is for a thumb `dyPx` below its anchor (screen y
 * grows downward): wide open at the anchor and below it, easing off analogue
 * over `LEVER_EASE_PX` of travel up, shut past that. */
export function leverThrottle(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  return clamp(1 + (dyPx * feel.sensitivity) / LEVER_EASE_PX, 0, 1);
}

/** ...and how far the brake is pulled for the same thumb: the travel above
 * the shut point past the dead band, 0..1. One throw carries both, so a
 * rider can never be asking for the throttle and the brake with the same
 * thumb. */
export function leverBrake(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const past = -dyPx * feel.sensitivity - LEVER_EASE_PX - LEVER_BRAKE_DEAD_PX;
  if (past <= 0) return 0;
  return clamp(past / LEVER_BRAKE_PX, 0, 1);
}

/** THE HANDLEBAR, AND HOW BIG IT IS. Thumb travel from the anchor to the end
 * of the bar's throw — full lock across, full lean up and down, and the
 * radius the reach ring is drawn at (`hud-touch.tsx`), so the circle a
 * player can see IS the control's whole extent on both axes. */
export const BAR_REACH_PX = 90;
/** The throw is shaped `travel ** this`, so the first centimetre of thumb
 * buys less lock than the last: a slight steer is a target a thumb can hit
 * instead of the twitch either side of centre. */
export const BAR_THROW_CURVE = 1.15;
/** The dead band around the anchor a sideways drag may wander in without
 * shifting the rider's weight: steering alone must never lean the nose. */
export const LEAN_DEAD_PX = 14;
/** ...and the travel past it for full lean, px: the lean maxes exactly where
 * the reach ring is drawn, as the steer does. */
export const LEAN_REACH_PX = BAR_REACH_PX - LEAN_DEAD_PX;

/** Screen-space steer, -1..1, for a thumb `dxPx` right of its anchor. */
export function barSteer(dxPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const travel = clamp((dxPx * feel.sensitivity) / BAR_REACH_PX, -1, 1);
  return Math.sign(travel) * Math.abs(travel) ** BAR_THROW_CURVE;
}

/** Lean, -1..1, for a thumb `dyPx` below its anchor: pulling the bar TOWARD
 * the rider (down the glass) is leaning BACK (+1, nose up — the engine's
 * sign), pushing it away is leaning forward. The dead band is spent before
 * the travel counts. */
export function barLean(dyPx: number, feel: TouchFeel = PLAIN_FEEL): number {
  const dy = dyPx * feel.sensitivity * (feel.invertLean ? -1 : 1);
  const beyond = Math.max(0, Math.abs(dy) - LEAN_DEAD_PX);
  if (beyond === 0) return 0;
  return clamp((Math.sign(dy) * beyond) / LEAN_REACH_PX, -1, 1);
}

/** Where the bar's reach ring is drawn for a feel, px: the thumb travel
 * that IS full lock, so the circle a player sees is still the control's
 * whole extent at any sensitivity. */
export function barReachPx(feel: TouchFeel = PLAIN_FEEL): number {
  return BAR_REACH_PX / feel.sensitivity;
}

/** Which keys are down, as the actions they are bound to. */
export type KeysHeld = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
  leanBack: boolean;
  leanForward: boolean;
};

export const NO_KEYS: KeysHeld = {
  left: false,
  right: false,
  throttle: false,
  brake: false,
  leanBack: false,
  leanForward: false,
};

/** What the thumb zones have written, screen-space, at pointer rate. A zone
 * that is not being touched writes zeros and `false`; the one that IS being
 * touched overrides the keyboard on the axes it owns. */
export type TouchChannel = {
  /** The handlebar: steer and lean, and whether a thumb is on it. */
  steer: number;
  lean: number;
  bar: boolean;
  /** The lever, 0..1 each way from its anchor, and whether a thumb is on
   * it. Only one of the two can be open: the thumb is either below the
   * anchor or above it. */
  throttle: number;
  brake: number;
  lever: boolean;
};

export function neutralTouch(): TouchChannel {
  return { steer: 0, lean: 0, bar: false, throttle: 0, brake: 0, lever: false };
}

/** The keyboard's ramped axes, screen-space. Advanced once per STEP (§37.1)
 * so a ramp is the same ramp on every display. */
export type InputModel = {
  steer: number;
  throttle: number;
  brake: number;
  lean: number;
};

export function createInputModel(): InputModel {
  return { steer: 0, throttle: 0, brake: 0, lean: 0 };
}

/** One step's input: advance the keyboard ramps by `dt`, merge the thumbs
 * in, apply the sign flip and hand the engine its structure. `reset` is the
 * edge the caller has banked since the last step (§37.1: a press is never
 * lost between steps).
 *
 * Merging: a thumb on the bar owns steer and lean outright — a key held
 * under it would fight the hand. The throttle takes the DEEPER of key and
 * lever, and so does the brake; and then the brake WINS over the throttle,
 * because a rider reaching for the brake is not also asking to go faster,
 * whichever hand the other input came from. */
export function sampleInput(
  model: InputModel,
  keys: KeysHeld,
  touch: TouchChannel,
  dt: number,
  reset: boolean,
): SledInput {
  const steerTarget = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  model.steer = rampToward(model.steer, steerTarget, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  model.throttle = rampToward(
    model.throttle,
    keys.throttle ? 1 : 0,
    dt,
    KEY_THROTTLE_ATTACK,
    KEY_THROTTLE_RELEASE,
  );
  model.brake = rampToward(
    model.brake,
    keys.brake ? 1 : 0,
    dt,
    KEY_BRAKE_ATTACK,
    KEY_BRAKE_RELEASE,
  );
  const leanTarget = (keys.leanBack ? 1 : 0) - (keys.leanForward ? 1 : 0);
  model.lean = rampToward(model.lean, leanTarget, dt, KEY_LEAN_ATTACK, KEY_LEAN_RELEASE);

  const steer = touch.bar ? touch.steer : model.steer;
  const lean = touch.bar ? touch.lean : model.lean;
  const brake = clamp(Math.max(model.brake, touch.lever ? touch.brake : 0), 0, 1);
  const throttle = clamp(Math.max(model.throttle, touch.lever ? touch.throttle : 0), 0, 1);
  return {
    // `0 * -1` is -0, and a -0 is a wart every equality downstream trips on.
    steer: steer === 0 ? 0 : clamp(steer, -1, 1) * SCREEN_TO_ENGINE,
    throttle: brake > 0 ? 0 : throttle,
    brake,
    lean: clamp(lean, -1, 1),
    reset,
  };
}
