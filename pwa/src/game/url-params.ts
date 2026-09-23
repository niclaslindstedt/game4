// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY PARAMETER THE APP READS OFF ITS URL, and what each one means. A
// surface the player can reach is a surface a link can reach, which is what
// makes a frame somebody found handable to somebody else — and it is the
// contract `scripts/screenshot.mjs` drives the built site through.
//
//   ?seed=<n>       pin the map: the front door's RACE rides this seed every
//                   time instead of dealing a fresh one, and the race the
//                   menu stands over is built on it too.
//   ?start=race     boot straight into a race on the grid (the splash and
//                   the front door skipped). `start=1` is the same.
//   ?t=<s>          ...with this many seconds of it already ridden — by the
//                   BOT, so a picture of a race is a picture of one moving.
//   ?shot=1         ...and held still once drawn, so nothing moves under a
//                   screenshot's shutter.
//   ?paused=1       ...or held under the pause card.
//   ?camera=<rung>  the run's camera (hood, bars, chase, far, high).
//   ?bot=1          the player's own sled ridden by the bot for the whole
//                   run, not just the pre-roll — a race watched from the
//                   saddle to its finish plate with nobody's hands on it.
//   ?menu=root      open on the front door rather than the attract card.
//   ?splash=1|0     force the attract card up, or off an ordinary visit.
//   ?update=1       draw the new-build button as if a build were waiting
//                   (read by `update-button.tsx` itself).
//
// DOM-free: the query string is an argument, so `tests/menu_system_test.ts`
// reads every rule here without a browser.

import type { CameraRung } from "./renderer-api.ts";
import { RUN_CAMERAS } from "./settings.ts";

export type UrlParams = {
  seed: number | null;
  /** The URL names a RACE to boot into rather than a card. */
  rides: boolean;
  /** Seconds of the race to pre-ride before the first frame is shown. */
  t: number;
  shot: boolean;
  paused: boolean;
  camera: CameraRung | null;
  /** The bot rides the player's sled for the whole run. */
  bot: boolean;
  /** The URL names the front door. */
  menu: boolean;
};

/** A seed a link may name: a whole number the generator's stream takes. */
function seedOf(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}

export function readParams(search: string): UrlParams {
  const q = new URLSearchParams(search);
  const start = q.get("start");
  const paused = q.get("paused") === "1";
  const t = Number(q.get("t") ?? 0);
  const camera = q.get("camera");
  return {
    seed: seedOf(q.get("seed")),
    rides: start === "race" || start === "1" || paused || q.get("shot") === "1",
    t: Number.isFinite(t) && t > 0 ? Math.min(t, 600) : 0,
    shot: q.get("shot") === "1",
    paused,
    camera:
      camera !== null && RUN_CAMERAS.includes(camera as CameraRung) ? (camera as CameraRung) : null,
    bot: q.get("bot") === "1",
    menu: q.get("menu") !== null,
  };
}

/** A fresh seed for a race nobody pinned. Off `Math.random` on purpose:
 * this is the APP choosing which map to build, not the engine drawing
 * inside a run, so the determinism contract is not in play — the engine is
 * handed the number and everything after it replays exactly. */
export function dealSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 99_999);
}
