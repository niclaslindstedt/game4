// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INPUT: one manager merges the keyboard and the HUD's thumb zones into the
// engine's `SledInput`. The maths — the ramps, the lever, the handlebar, the
// sign flip — is next door in input-model.ts, DOM-free so the tests can
// read it; this file is the listeners. Sampled once per STEP (§37.1): the
// ramps advance by the step's own dt, and the reset edge is banked between
// steps and handed to the step it arrives in, so a tap inside one step is
// still seen by that step.
//
// WHICH KEY DOES WHAT is `settings-input.ts`'s table, and nothing in this
// file knows any particular key:
//   W / ↑        throttle             S / ↓ / Space   brake
//   A / ←  D / → steer                E / Shift       lean back (nose up)
//   Q / Z        lean forward         R               back to the checkpoint
//   B            restart the race     C               next camera
//   Escape       hold the race under the pause card (menu-pause.tsx);
//                pressing it again over the card resumes, because the card's
//                RESUME row is its `data-nav-back` and menu-nav.ts takes
//                Escape upstream of this manager.
//
// AN ACTION MAY BE HELD OR TAKEN ON THE PRESS, and `settings-input.ts` says
// which: the sled's six are held and ramped, the four around a race happen
// once however long the key is down.

import type { SledInput } from "@engine";

import {
  DEFAULT_KEYS,
  isHeldAction,
  type InputAction,
  type KeyAction,
  type KeyBindings,
} from "./settings-input.ts";
import {
  NO_KEYS,
  createInputModel,
  neutralTouch,
  sampleInput,
  type KeysHeld,
  type TouchChannel,
} from "./input-model.ts";

export type { InputAction };

export type InputManager = {
  /** Produce this step's input; advances the ramps by `dt`. */
  sample: (dt: number) => SledInput;
  /** The thumb zones write here at pointer rate (screen-space). */
  touch: TouchChannel;
  /** Queue a reset — the HUD button, the R key and the shell's menu row all
   * land here. */
  requestReset: () => void;
  /** Hear the app-level presses. */
  onAction: (handler: (action: InputAction) => void) => void;
  dispose: () => void;
};

/**
 * `claiming` says whether a RACE is being ridden right now. The listeners
 * live for the app's whole life but the held keys are only the sled's while
 * the player is riding it, and the difference matters for exactly one key:
 * every control on every card is a real `<button>`, and SPACE on a focused
 * button is how the browser presses it. Claiming space on a menu —
 * `preventDefault` on the keydown — would swallow that. `App.tsx` passes
 * `playerRides` from `shell.ts`.
 */
export function createInputManager(
  target: Window = window,
  claiming: () => boolean = () => true,
  bindings: KeyBindings = DEFAULT_KEYS,
): InputManager {
  const model = createInputModel();
  const keys: KeysHeld = { ...NO_KEYS };
  const touch = neutralTouch();
  let reset = false;
  let onAction: (action: InputAction) => void = () => {};

  /** The index every keystroke is answered from: one code, the actions on
   * it. A list, because one key may serve two rows. */
  const byCode = new Map<string, KeyAction[]>();
  for (const [action, codes] of Object.entries(bindings) as [KeyAction, string[]][]) {
    for (const code of codes) {
      const on = byCode.get(code);
      if (on) on.push(action);
      else byCode.set(code, [action]);
    }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const actions = byCode.get(e.code);
    if (!actions) return;
    // A browser shortcut on its way past is not a press on the sled.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let took = false;
    for (const action of actions) {
      if (isHeldAction(action)) {
        if (!claiming()) continue;
        keys[action] = true;
        took = true;
      } else if (!e.repeat) {
        if (action === "reset") {
          if (!claiming()) continue;
          reset = true;
        } else onAction(action);
        took = true;
      }
    }
    // The arrows and space scroll the page; on a keyboard-driven game that
    // means the whole shell jumps. Only for a press this manager took.
    if (took) e.preventDefault();
  };
  // A key let go is always let go, claimed or not: a race left mid-throttle
  // must not come back to a throttle that is still down.
  const onKeyUp = (e: KeyboardEvent): void => {
    for (const action of byCode.get(e.code) ?? []) {
      if (isHeldAction(action)) keys[action] = false;
    }
  };
  // A key held while the window loses focus never sends its keyup: the sled
  // would ride off at full throttle behind a dialog.
  const onBlur = (): void => {
    for (const k of Object.keys(keys) as (keyof KeysHeld)[]) keys[k] = false;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  target.document.addEventListener("visibilitychange", onBlur);

  return {
    sample: (dt) => {
      const input = sampleInput(model, keys, touch, dt, reset);
      reset = false;
      return input;
    },
    touch,
    requestReset: () => {
      reset = true;
    },
    onAction: (handler) => {
      onAction = handler;
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      target.document.removeEventListener("visibilitychange", onBlur);
    },
  };
}
