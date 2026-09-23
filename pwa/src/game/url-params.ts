// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY PARAMETER THE APP READS OFF ITS URL, and what each one means. A
// surface the player can reach is a surface a link can reach, which is what
// makes a frame somebody found handable to somebody else — and it is the
// contract `scripts/screenshot.mjs` drives the built site through.
//
//   ?seed=<n>       pin the map: the front door's RACE and TIME TRIAL ride
//                   this seed rather than a campaign map off the level card,
//                   and the race the menu stands over is built on it too.
//   ?start=race     boot straight into a race on the grid (the splash and
//                   the front door skipped). `start=1` is the same.
//   ?start=free     ...or into a FREE RIDE on the start card's stored map,
//                   day and snow (the seed a `?seed=` names over it).
//   ?t=<s>          ...with this many seconds of it already ridden — by the
//                   BOT, so a picture of a race is a picture of one moving.
//   ?shot=1         ...and held still once drawn, so nothing moves under a
//                   screenshot's shutter.
//   ?paused=1       ...or held under the pause card.
//   ?camera=<rung>  the run's camera (hood, bars, chase, far, high).
//   ?sled=<id>      the player's machine for this visit (trail, crossover,
//                   mountain, cross), over the stored one and never written
//                   back — how a lab photographs a sled it did not pick.
//   ?mode=trial     the run a link boots into (or the next one pressed) is
//                   a TIME TRIAL — alone, against the record and the ghost —
//                   rather than a race; ?mode=tricks, a TRICKS run on the
//                   seed's trick field.
//   ?bot=1          the player's own sled ridden by the bot for the whole
//                   run, not just the pre-roll — a race watched from the
//                   saddle to its finish plate with nobody's hands on it.
//   ?menu=root      open on the front door rather than the attract card;
//   ?menu=options   ...on OPTIONS, and `keys` on OPTIONS ▸ KEYS; `sled` on
//                   the sled card RACE opens; `start` on the free ride's
//                   start card; `campaign` on the campaign card; `levels` on
//                   the level card a RACE (or, with `mode=trial`, a TIME
//                   TRIAL) picks its pinned map on.
//   ?weather=<kind> ride the map under this sky instead of the one R19
//                   dealt it (clear, fair, high, overcast, snow, fog) —
//                   how a lab photographs every weather on one seed.
//   ?hour=<h>       ...and from this solar start hour (0–24), so a lab can
//                   stand a race in the dark.
//   ?video=<tier>   ride this visit at a picture preset (low, medium, high —
//                   `settings-video.ts`) without storing it: how a lab
//                   meters or photographs a rung.
//   ?probe=0        do not time the machine on this visit: the first-visit
//                   probe (`video-probe.ts`) may move the picture, and a lab
//                   wants it held still.
//   ?splash=1|0     force the attract card up, or off an ordinary visit.
//   ?update=1       draw the new-build button as if a build were waiting
//                   (read by `update-button.tsx` itself).
//
// DOM-free: the query string is an argument, so `tests/menu_system_test.ts`
// reads every rule here without a browser.

import {
  WEATHER_KINDS,
  isSledId,
  type GameMode,
  type SkyOverride,
  type SledId,
  type WeatherKind,
} from "@engine";

import type { CameraRung } from "./renderer-api.ts";
import { RUN_CAMERAS } from "./settings.ts";
import { TIERS, type Tier } from "./settings-video.ts";

/** The cards a link may open on. */
export type MenuPage = "root" | "sled" | "options" | "keys" | "start" | "campaign" | "levels";
const MENU_PAGES: readonly MenuPage[] = [
  "root",
  "sled",
  "options",
  "keys",
  "start",
  "campaign",
  "levels",
];

export type UrlParams = {
  seed: number | null;
  /** The URL names a RACE to boot into rather than a card. */
  rides: boolean;
  /** ...and that ride is a FREE RIDE. */
  free: boolean;
  /** Seconds of the race to pre-ride before the first frame is shown. */
  t: number;
  shot: boolean;
  paused: boolean;
  camera: CameraRung | null;
  /** The player's machine for this visit. */
  sled: SledId | null;
  /** The mode a booted run is ridden in. */
  mode: GameMode;
  /** The bot rides the player's sled for the whole run. */
  bot: boolean;
  /** The URL names the front door. */
  menu: boolean;
  /** ...and which page of it. */
  page: MenuPage;
  /** A picture preset for this visit only. */
  video: Tier | null;
  /** Whether the first-visit probe may run. */
  probe: boolean;
  /** A sky and a start hour for this visit's races, over the dealt ones;
   * null when the link names neither. */
  sky: SkyOverride | null;
};

/** The sky a link names, if any. */
function skyOf(q: URLSearchParams): SkyOverride | null {
  const weather = q.get("weather");
  const hour = Number(q.get("hour") ?? NaN);
  const sky: SkyOverride = {};
  if (weather !== null && WEATHER_KINDS.includes(weather as WeatherKind)) {
    sky.weather = weather as WeatherKind;
  }
  if (q.get("hour") !== null && Number.isFinite(hour) && hour >= 0 && hour <= 24) sky.hour = hour;
  return sky.weather === undefined && sky.hour === undefined ? null : sky;
}

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
  const sled = q.get("sled");
  return {
    seed: seedOf(q.get("seed")),
    rides: start === "race" || start === "free" || start === "1" || paused || q.get("shot") === "1",
    free: start === "free",
    t: Number.isFinite(t) && t > 0 ? Math.min(t, 600) : 0,
    shot: q.get("shot") === "1",
    paused,
    camera:
      camera !== null && RUN_CAMERAS.includes(camera as CameraRung) ? (camera as CameraRung) : null,
    sled: sled !== null && isSledId(sled) ? sled : null,
    mode:
      start === "free"
        ? "free"
        : q.get("mode") === "trial"
          ? "timeTrial"
          : q.get("mode") === "tricks"
            ? "tricks"
            : "race",
    bot: q.get("bot") === "1",

    menu: q.get("menu") !== null,
    page: MENU_PAGES.includes(q.get("menu") as MenuPage) ? (q.get("menu") as MenuPage) : "root",
    video: TIERS.includes(q.get("video") as Tier) ? (q.get("video") as Tier) : null,
    probe: q.get("probe") !== "0",
    sky: skyOf(q),
  };
}

/** A fresh seed for a race nobody pinned. Off `Math.random` on purpose:
 * this is the APP choosing which map to build, not the engine drawing
 * inside a run, so the determinism contract is not in play — the engine is
 * handed the number and everything after it replays exactly. */
export function dealSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 99_999);
}
