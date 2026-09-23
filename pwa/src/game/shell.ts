// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SURFACE IS UP, and everything that follows from it. Five surfaces
// over ONE canvas and ONE engine state — the shell never tears a run down,
// it only decides who rides it and what is drawn over the top:
//
//   splash   the attract card (`splash-screen.tsx`).
//   menu     the front door (`menu-main.tsx`), over a bot-ridden race.
//   loading  a race being stood up (`loading-screen.tsx`).
//   pause    the race HELD for the player to read (`menu-pause.tsx`).
//   run      the player's hands on the bars, with the HUD over the top.
//
// THE SNOW NEVER STOPS BEHIND A CARD — with exactly one exception, and the
// difference between the two is the whole reason this module exists. The
// attract card, the front door and the loading card all stand over a race
// nobody is riding: the bot has the player's sled, the field races on, the
// camera orbits, and a menu that stopped it would announce that the game is
// not running. The PAUSE card stands over a race the PLAYER is in the middle
// of, and a race that carried on being ridden while its rider read a menu
// would be a card that costs them the checkpoint they stopped at. So the
// pause card, and only the pause card, freezes.
//
// DOM-free, so `tests/menu_system_test.ts` holds the rules below without a
// browser. `App.tsx` is the one module that decides WHEN the surface
// changes; these say what each one means once it has.

import type { CameraRung } from "./renderer-api.ts";

export const SHELLS = ["splash", "menu", "loading", "pause", "run"] as const;

export type Shell = (typeof SHELLS)[number];

/** Whether the player's hands are on the sled. Everywhere else the BOT
 * rides it, which is what keeps the snow moving under a card. */
export function playerRides(shell: Shell): boolean {
  return shell === "run";
}

/** Whether the sound is the FULL mix rather than a bed ducked under a card,
 * and whether the race's events make a noise and a pulse at all: a
 * checkpoint the bot takes under the front door is not news. */
export function soundsLive(shell: Shell): boolean {
  return playerRides(shell);
}

/** Whether the engine takes steps at all — every surface but the pause
 * card (see this module's header). */
export function simulates(shell: Shell): boolean {
  return shell !== "pause";
}

/** Whether the HUD is drawn. The pause card stands OVER the readouts rather
 * than in place of them: the frozen frame the player is looking at is still
 * the race, and its clock, its lap and its place are part of what they
 * stopped to read. */
export function hudOver(shell: Shell): boolean {
  return shell === "run" || shell === "pause";
}

/** Whether the pause card can be reached from here. Only out of a run: a
 * card opened over the front door would be offering to freeze an attract
 * demo, and one over the loading card would freeze a race being built. */
export function canPause(shell: Shell): boolean {
  return shell === "run";
}

/** WHICH CAMERA A SURFACE IS SEEN THROUGH. Every card is framed by the
 * slow orbit round the sled — a card is a picture of the race, not a seat
 * in it — and the run and the frame held under the pause card are seen
 * through the rung the rider chose. */
export function cameraFor(shell: Shell, chosen: CameraRung): CameraRung {
  return hudOver(shell) ? chosen : "orbit";
}
