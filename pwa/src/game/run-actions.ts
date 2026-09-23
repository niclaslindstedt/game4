// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE OF THE GAME'S OWN BUTTONS, WHEREVER THE PRESS CAME FROM.
//
// Three things press these and there is one handler for all of them: a KEY
// (`settings-input.ts` says which key is which action), a THUMB on the HUD's
// own presses (`hud-actions.tsx`), and a ROW OF THE DESKTOP SHELL'S MENU BAR
// (`shell-host.ts`, mirrored in `tauri/shell/src/menu.rs`). That last one is
// the rule rather than a convenience: a shell may add a second way to reach
// a button the game already has, never a second button — so every word the
// menu bar can send lands on the very line a key lands on.
//
// WHAT THE SURFACE DOES TO A PRESS is the whole of this module: every one of
// these is about a RACE BEING RIDDEN, so over a card none of them does
// anything — except PAUSE over the pause card, which is RESUME, because the
// key that opened the card is the key a hand reaches for to close it. (Over
// a card, Escape is usually taken upstream by `menu-nav.ts`'s capture-phase
// walk and pressed as the card's own way back; the shell's menu row arrives
// here instead, and has to mean the same thing.)
//
// A FACTORY over the app's own closures: the surface, the camera and the
// race are `App.tsx`'s. DOM-free, so `tests/menu_system_test.ts` reads it.

import type { ShellCommand } from "../shell-host.ts";
import type { InputAction } from "./settings-input.ts";
import type { Shell } from "./shell.ts";

export type RunActionWorld = {
  shell: () => Shell;
  /** Hold the race under the pause card, and let it go again. */
  pause: () => void;
  resume: () => void;
  /** The race again from the grid, on the same map — the B key's line. */
  restart: () => void;
  /** One rung along the camera ladder. */
  camera: () => void;
  /** Put the sled back at the last checkpoint — the R key's edge. */
  reset: () => void;
};

/** Everything that can be pressed: the app's own actions and the shell's
 * words, which are the same four spelled the same way. */
export type RunPress = InputAction | ShellCommand;

export function createRunActions(world: RunActionWorld): (press: RunPress) => void {
  return (press) => {
    const shell = world.shell();
    if (press === "pause") {
      if (shell === "run") world.pause();
      else if (shell === "pause") world.resume();
      return;
    }
    if (shell !== "run") return;
    if (press === "restart") world.restart();
    else if (press === "camera") world.camera();
    else if (press === "reset") world.reset();
  };
}
