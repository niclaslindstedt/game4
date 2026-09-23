// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESSES THE CARDS MAKE, and the race the page always mounts over —
// the two things `App.tsx` needs before it has anything of its own: the
// shape of the box its effect fills with the game's own buttons, and a race
// that cannot fail to stand up (a seed the generator refuses falls back to
// one it does not). Stated here rather than at the top of `App.tsx` because
// neither is the app's decision about WHEN one surface gives way to the next,
// which is what that file is for.

import {
  createGame,
  error,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type SkyOverride,
  type SledSpec,
} from "@engine";

import type { CampaignLevel } from "./campaign.ts";
import { assistOf, type Settings } from "./settings.ts";

/** The presses the cards make, boxed so a card re-rendering is never a
 * reason to rebuild the loop that owns the race. */
export type Presses = {
  race: (seed: number, mode: GameMode) => void;
  free: (options: CreateGameOptions) => void;
  /** A pinned map: a campaign rung (`rung`), or a map off the level card. */
  pinned: (pin: CampaignLevel, mode: CampaignLevel["mode"], rung: boolean) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  abandonLoad: () => void;
  camera: () => void;
  watch: () => void;
};

export const NO_PRESSES: Presses = {
  race: () => {},
  free: () => {},
  pinned: () => {},
  restart: () => {},
  pause: () => {},
  resume: () => {},
  toMenu: () => {},
  abandonLoad: () => {},
  camera: () => {},
  watch: () => {},
};

/** A whole race on `seed` — or, where the generator refuses it, the map the
 * game falls back on, so the page ALWAYS mounts over something. `rider` is
 * the player's help and machine for a race a link boots into; the race under
 * the front door is the bot's, on the default machine with every hand on. */
export function raceOrFallback(
  seed: number,
  rider: { assist: Settings["assist"]; spec: SledSpec; mode: GameMode; laps: number } | null,
  sky?: SkyOverride,
): GameState {
  const help = {
    ...(rider
      ? {
          assist: assistOf(rider.assist),
          spec: rider.spec,
          mode: rider.mode,
          laps: rider.mode === "timeTrial" ? rider.laps : undefined,
        }
      : {}),
    sky,
  };
  try {
    return createGame({ seed, ...help });
  } catch (e) {
    error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
    return createGame({ seed: 1, ...help });
  }
}
