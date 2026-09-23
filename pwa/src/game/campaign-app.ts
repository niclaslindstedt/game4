// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN AS THE APP HOLDS IT — the board, the rig that books a rung
// into it, the rung the sled card's RIDE is for, and the two presses that
// route a card to the sled card: a front-door tile, and a map picked on the
// campaign card or the level card.
//
// A HOOK, because the board is render state — the front door's tile and both
// cards read it — while the rig and the rung belong to the loop `App.tsx`'s
// effect builds once: the rig is made once and never replaced, so the loop
// may hold it from its first frame and every booking it makes is the board
// the next render draws. The board is written down on every change
// (`saveProgress`), which is the one place it is.

import type { GameMode } from "@engine";
import { useEffect, useRef, useState } from "preact/hooks";

import {
  loadProgress,
  saveProgress,
  type CampaignLevel,
  type CampaignProgress,
} from "./campaign.ts";
import { createCampaignRig, type CampaignRig } from "./campaign-run.ts";
import type { Settings } from "./settings.ts";
import type { MenuPage } from "./url-params.ts";

export type CampaignApp = {
  progress: CampaignProgress;
  rig: CampaignRig;
  /** The rung the sled card's RIDE is for, when the campaign card opened it. */
  rung: { current: CampaignLevel | null };
  /** A front-door tile: the mode its cards are for, and no rung. */
  openCard: (mode: GameMode, page: MenuPage) => void;
  /** A map picked, on to the sled card: a campaign RUNG, or a map off the
   * level card — which is kept as the one the RACE and TIME TRIAL ride. */
  choose: (level: CampaignLevel, rung: boolean) => void;
  /** The board SET rather than earned — DEVELOPER ▸ UNLOCKS. */
  setProgress: (progress: CampaignProgress) => void;
};

export function useCampaign(world: {
  /** The mode the sled card's RIDE is for (`App.tsx`'s own ref). */
  mode: { current: GameMode };
  setPage: (page: MenuPage) => void;
  setSettings: (update: (s: Settings) => Settings) => void;
}): CampaignApp {
  const [progress, setProgress] = useState(loadProgress);
  const held = useRef(progress);
  held.current = progress;
  const rung = useRef<CampaignLevel | null>(null);
  const [rig] = useState(() =>
    createCampaignRig({
      progress: () => held.current,
      setProgress: (next) => setProgress((held.current = next)),
    }),
  );
  useEffect(() => saveProgress(progress), [progress]);
  return {
    progress,
    rig,
    rung,
    setProgress: (next) => setProgress((held.current = next)),
    openCard: (mode, page) => {
      world.mode.current = mode;
      rung.current = null;
      world.setPage(page);
    },
    choose: (level, isRung) => {
      rung.current = isRung ? level : null;
      if (!isRung) world.setSettings((s) => ({ ...s, level: level.id }));
      world.setPage("sled");
    },
  };
}
