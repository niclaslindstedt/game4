// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINISH PLATE — the card over a race the player has finished.
//
// A FINISHED RACE COASTS: the engine hands the sled neutral from the flag
// on, so the throttle, the bars and the reset all stop answering. That is
// the race being over rather than the game hanging — but a plate that only
// stated the result would leave the rider holding a dead machine with
// nothing on screen saying what to do about it. So it says what happened —
// the place and the time — then the WHOLE FIELD's table under it, which is
// live: the rest of the field is still racing home behind the rider, and
// each of them lands on the table with a time the moment they cross the
// line. Then the ways on, as PRESSES.
//
// IT PRESSES THE GAME'S OWN BUTTONS AND ADDS NONE: RACE AGAIN is the very
// line the B key lands on and MAIN MENU is the pause card's own. NEW MAP is
// the front door's RACE, pressed from here so a rider who wants another map
// is not sent through a card to get it.
//
// A TIME TRIAL'S PLATE is the same card with the time where the place was
// and no table under it — there is nobody else to list — and under either
// the RECORD BOOK's line (`records.ts`): a new record, or the row that
// stood with its sled, its date and how far off it this run was. The row
// is the one that stood when the run began (`HudSnapshot.best`), so the
// plate can say the run beat it after the book has been rewritten.
//
// ON A CAMPAIGN RUNG the plate adds three lines — the rung, what it paid
// (points on a race, a medal on a trial) and what the finish did to the
// ladder — and NEXT MAP takes NEW MAP's place, riding the rung the ladder
// opened (`campaign-run.ts` writes the lines; this only draws them).
// A TRICKS RUN'S PLATE is the score where the time was, and no book under
// it: the record book is a book of times (`records.ts`).
//
// ITS OWN LAYER, drawn by App.tsx outside the HUD, and gated here: it is up
// over a finished race and down under the pause card, which offers its own.

import { isSledId, sledById } from "@engine";

import { formatTime } from "../lib/util.ts";
import type { CampaignLevel } from "./campaign.ts";
import type { CampaignPlate } from "./campaign-run.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function ResultPlate({
  snap,
  touch,
  onAgain,
  onNew,
  onMenu,
  campaign = null,
  onNext,
  onReplay = null,
}: {
  /** The race, or null while the plate is not the player's to press. */
  snap: HudSnapshot | null;
  /** Whether there is a thumb on the screen — the key note is for the other
   * kind of player, and the presses are for both. */
  touch: boolean;
  onAgain: () => void;
  onNew: () => void;
  onMenu: () => void;
  /** A CAMPAIGN RUNG's lines (`campaign-run.ts`): what it paid and what it
   * did to the ladder — and the NEXT press in place of NEW MAP where the
   * ladder has a map open after it. */
  campaign?: CampaignPlate | null;
  onNext?: (next: CampaignLevel) => void;
  /** The race watched back (`replay-run.ts`), or null where there is no
   * recording of it. */
  onReplay?: (() => void) | null;
}) {
  if (!snap?.result || !snap.standings) return null;
  const { result, standings, best } = snap;
  const trial = snap.mode === "timeTrial";
  const record = best === null || result.time < best.time;
  const gold = snap.tricks ? false : trial ? record : result.place === 1;
  const sledName = (id: string): string => (isSledId(id) ? sledById(id).name : id);
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result${gold ? " hud-result-record" : ""}`}>
          <span class="hud-card-note hud-result-label">
            {snap.tricks
              ? STRINGS.resultTricksTitle
              : trial
                ? STRINGS.resultTrialTitle
                : STRINGS.resultTitle}
          </span>
          {snap.tricks ? (
            <span class="hud-card-title">{STRINGS.score(snap.tricks.score)}</span>
          ) : trial ? (
            <span class="hud-card-title">{STRINGS.resultTime(result.time)}</span>
          ) : (
            <>
              <span class="hud-card-title">{STRINGS.resultPlace(result.place, snap.riders)}</span>
              <span class="hud-card-note">{STRINGS.resultTime(result.time)}</span>
            </>
          )}
          {/* THE RECORD BOOK's line: the row this run set, or the one that
              stood and how far off it the run was. */}
          {!snap.tricks && (
            <span class="hud-card-note hud-result-book" data-record={record ? "1" : undefined}>
              {record || best === null
                ? STRINGS.resultRecord
                : `${STRINGS.resultBest(best.time, sledName(best.sled), best.at)} · ${STRINGS.resultOff(result.time - best.time)}`}
            </span>
          )}
          {/* THE CAMPAIGN'S lines on a rung: the rung, what it paid, and
              what the finish did to the ladder. */}
          {campaign && <span class="hud-card-note hud-result-rung">{campaign.title}</span>}
          {campaign && (
            <span
              class="hud-card-note hud-result-award"
              data-cleared={campaign.cleared ? "1" : undefined}
            >
              {campaign.award}
            </span>
          )}
          {campaign?.ladder && (
            <span class="hud-card-note hud-result-ladder">{campaign.ladder}</span>
          )}
          {/* THE FIELD, best first. A rider still out is billed by the lap
              they are on, so the table fills in as they come home. */}
          {standings.length > 1 && (
            <ol class="hud-standings">
              {standings.map((s) => (
                <li key={s.slot} class={`hud-standing${s.you ? " hud-standing-you" : ""}`}>
                  <span class="hud-standing-place">{s.place}</span>
                  <span class="hud-standing-name">
                    {s.you ? STRINGS.riderYou : STRINGS.riderRival(s.slot)}
                  </span>
                  <span class="hud-standing-time">
                    {s.time !== null ? formatTime(s.time) : STRINGS.standingOut(s.lap, snap.laps)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {/* THE WAYS ON. Racing again first — it is what a rider wants most
              of the time and the only one with a key behind it. */}
          <div class="hud-result-acts">
            <button type="button" class="hud-mini hud-result-act" data-nav-next onClick={onAgain}>
              {trial || snap.tricks ? STRINGS.resultTrialAgain : STRINGS.resultAgain}
            </button>
            {campaign ? (
              campaign.next &&
              onNext && (
                <button
                  type="button"
                  class="hud-mini hud-result-act"
                  onClick={() => campaign.next && onNext(campaign.next)}
                >
                  {STRINGS.plateNext}
                </button>
              )
            ) : (
              <button type="button" class="hud-mini hud-result-act" onClick={onNew}>
                {STRINGS.resultNew}
              </button>
            )}
            {onReplay && (
              <button type="button" class="hud-mini hud-result-act" onClick={onReplay}>
                {STRINGS.replayWatch}
              </button>
            )}
            <button type="button" class="hud-mini hud-result-act" onClick={onMenu}>
              {STRINGS.pauseMainMenu}
            </button>
          </div>
          {!touch && <span class="hud-card-note hud-result-note">{STRINGS.resultNote}</span>}
        </div>
      </div>
    </div>
  );
}
