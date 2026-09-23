// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE GAME REMEMBERS between visits — and in this slice that is two
// things: which camera the rider last chose, and whether the sound is on.
// There is no options page yet, so nothing is remembered that the player
// has no way to change: the camera is walked with C (or the HUD's press)
// and the sound is the switch on the front door and the pause card.
//
// `mergeSettings` is the one place a stored blob becomes settings this
// build offers, and it is FIELD BY FIELD with every value CHECKED: a value
// off the ladder is one no press can walk the player back to, so
// `Object.assign` over the whole thing would be the bug. DOM-free; the
// storage skin below it is the only part that touches `localStorage`, and it
// never throws — a browser with storage turned off plays with the defaults.

import type { CameraRung } from "./renderer-api.ts";

/** THE LADDER C WALKS, nearest first. "orbit" is not on it: that is the
 * cards' own slow turn round the sled, and a rung a rider could land on by
 * pressing C would be a race seen through a screensaver. */
export const RUN_CAMERAS: readonly CameraRung[] = ["hood", "bars", "chase", "far", "high"];

/** The rung a first visit rides on — behind and above, the seat the HUD and
 * the sound are tuned at. */
export const DEFAULT_CAMERA: CameraRung = "chase";

/** The rung after `rung` on the ladder, wrapping — and back onto the ladder
 * from anywhere off it. */
export function nextCamera(rung: CameraRung): CameraRung {
  const at = RUN_CAMERAS.indexOf(rung);
  return at < 0 ? DEFAULT_CAMERA : RUN_CAMERAS[(at + 1) % RUN_CAMERAS.length];
}

export type Settings = {
  /** The run's camera rung (`RUN_CAMERAS`). */
  camera: CameraRung;
  /** Whether the game makes a sound at all. */
  sound: boolean;
};

export function freshSettings(): Settings {
  return { camera: DEFAULT_CAMERA, sound: true };
}

/** A stored blob — anything at all — made into settings this build offers. */
export function mergeSettings(parsed: unknown): Settings {
  const out = freshSettings();
  if (!parsed || typeof parsed !== "object") return out;
  const blob = parsed as Record<string, unknown>;
  if (typeof blob.camera === "string" && RUN_CAMERAS.includes(blob.camera as CameraRung)) {
    out.camera = blob.camera as CameraRung;
  }
  if (typeof blob.sound === "boolean") out.sound = blob.sound;
  return out;
}

/** Versioned, so a blob a later build reshapes is a blob it can recognise. */
export const SETTINGS_KEY = "powderrun.settings.v1";

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return mergeSettings(stored === null ? null : JSON.parse(stored));
  } catch {
    // Storage unavailable, or a blob that is not JSON — the defaults are a
    // perfectly good game.
    return freshSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode, a full quota: the visit still plays, it is just not kept.
  }
}
