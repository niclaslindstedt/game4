// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PLAYER PRESSES: every action the game can be given from the
// keyboard, and the keys bound to each. Data only — reading a keyboard is
// `input.ts`'s, and the maths a held key ramps through is `input-model.ts`'s.
// There is no binding page in this slice, so the table below IS the layout;
// it is still a table rather than a switch in the listener, so the day a
// page arrives it rebinds a row and nothing in `input.ts` changes.
//
// THE HELD SET IS NOT RESTATED. `HeldAction` is `keyof KeysHeld`, so a key
// the sled grows tomorrow is an action this table does not compile without.

import type { KeysHeld } from "./input-model.ts";

/** The actions a key is HELD for — the sled's own, and the only ones the
 * ramps in `input-model.ts` know about. */
export type HeldAction = keyof KeysHeld;

/** The presses the APP answers rather than the sled. `reset` is the one
 * edge that is not here: it reaches the engine as an input flag on the step
 * it arrives in, which is the whole difference between putting the sled
 * back and changing the camera. */
export type InputAction = "restart" | "camera" | "pause";

/** An action taken on the PRESS, not held. */
export type EdgeAction = "reset" | InputAction;

export type KeyAction = HeldAction | EdgeAction;

/** Bound `KeyboardEvent.code` values per action. */
export type KeyBindings = Record<KeyAction, readonly string[]>;

/** Is this one of the sled's held actions? The table behind it is typed
 * `Record<HeldAction, true>`, so a new held key does not compile until it
 * is named here. */
const HELD: Record<HeldAction, true> = {
  throttle: true,
  brake: true,
  left: true,
  right: true,
  leanBack: true,
  leanForward: true,
};

export function isHeldAction(action: KeyAction): action is HeldAction {
  return action in HELD;
}

/**
 * THE KEYBOARD AS IT SHIPS.
 *
 * TWO HANDS, EITHER CLUSTER: WASD and the arrows are the same machine, so
 * a player sits at whichever their hand already knows — W / ↑ is the thumb
 * throttle, S / ↓ the brake lever, A D / ← → the bars. SPACE is a second
 * brake because it is where a hand that has never played this reaches
 * first.
 *
 * THE LEAN is the rider's own body, and in the air it is the pitch control:
 * E or SHIFT leans BACK (nose up — the landing saved off a big kicker),
 * Q or Z leans forward (nose down). Shift and Z sit under the left hand of
 * an arrow player; Q and E either side of W for the WASD hand. Never Ctrl:
 * Ctrl held beside W is a closed tab.
 *
 * R puts the sled back on the track at the last checkpoint it took — the
 * press a rider makes with a sled upside down in a tree well. Standing the
 * WHOLE race back up on the grid is the rarer press and far more expensive
 * to make by accident, so it is B beside it rather than a key shared with
 * it. C walks the camera ladder; Escape holds the race under the pause card.
 */
export const DEFAULT_KEYS: KeyBindings = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown", "Space"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  leanBack: ["KeyE", "ShiftLeft", "ShiftRight"],
  leanForward: ["KeyQ", "KeyZ"],
  reset: ["KeyR"],
  restart: ["KeyB"],
  camera: ["KeyC"],
  pause: ["Escape"],
};
