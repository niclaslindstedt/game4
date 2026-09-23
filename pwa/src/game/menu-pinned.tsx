// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWO CARDS A PINNED MAP IS CHOSEN ON, as the front door's pages see
// them: the CAMPAIGN card (a rung, ridden for points) and the LEVEL card (a
// map for a RACE or a TIME TRIAL, ridden for the record book). One component
// so `App.tsx` routes both pages with one branch: which card is up is the
// page, and what a pick does is the app's.

import { sledById, type GameMode, type SledId } from "@engine";

import { measuredLaps, type CampaignLevel, type CampaignProgress } from "./campaign.ts";
import { CampaignPage } from "./menu-campaign.tsx";
import { LevelsPage } from "./menu-levels.tsx";
import type { RecordKey, RunRecord } from "./records.ts";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

export function PinnedCards({
  page,
  mode,
  settings,
  sled,
  progress,
  standing,
  onBack,
  onChoose,
}: {
  page: "campaign" | "levels";
  /** The mode the level card picks a map for. */
  mode: GameMode;
  /** The trial's length off the front door's chip, and the map the level
   * card last picked (`Settings.level`). */
  settings: Settings;
  /** The machine the sled card holds — a record book row is one sled's. */
  sled: SledId;
  progress: CampaignProgress;
  /** The record book's row under a key (`ghost-run.ts`'s `standing`). */
  standing: (key: RecordKey) => RunRecord | null;
  onBack: () => void;
  /** A map picked, on to the sled card: a campaign RUNG, or a map off the
   * level card. */
  onChoose: (level: CampaignLevel, rung: boolean) => void;
}) {
  if (page === "campaign") {
    return (
      <CampaignPage progress={progress} onBack={onBack} onRide={(level) => onChoose(level, true)} />
    );
  }
  const laps = measuredLaps(mode, settings.trialLaps);
  return (
    <LevelsPage
      mode={mode}
      laps={laps}
      progress={progress}
      chosen={settings.level}
      best={(level) => {
        const row = standing({ seed: level.seed, sled, mode, laps });
        return row ? STRINGS.levelsBest(row.value, sledById(row.sled).name) : null;
      }}
      onBack={onBack}
      onPick={(level) => onChoose(level, false)}
    />
  );
}
