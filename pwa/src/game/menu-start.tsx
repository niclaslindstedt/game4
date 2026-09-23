// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// a FREE RIDE: WHERE, and WHEN. The second, WHAT ON, is the sled card this
// card's way on opens, which is also where RIDE is.
//
// IT IS THE FREE RIDE'S CARD AND NOBODY ELSE'S. A race is dealt its map fresh
// off the front door and rides the day that map came with; the free ride is
// the one way onto the snow where nothing is compared, which is exactly
// where a map of your own, a day of your own and a depth of snow of your own
// belong. (Sibling game3's start card, ported for snow.)
//
// FOUR ROWS AND A CHART, and every one of them changes the ride:
//
//   MAP     which seed, typed or stepped, with ANOTHER MAP under the chart to
//           deal a fresh one. The CHART is the row's meaning — a number
//           nobody can picture is not a choice — and it is cut from the real
//           generated map in a worker (`seed-preview.tsx`), with every
//           KICKER marked on it, which is what a free rider is hunting.
//   DATE    the day of the year, December to April: how high the sun climbs
//           and how long the shadows lie.
//   TIME    the solar hour the ride starts at, anywhere the sun is up on that
//           date at that map's latitude (`freeHours`) — the travel is the
//           ENGINE's answer, never hours written down here. The clock runs
//           on from there at an hour every ten minutes.
//   SNOW    how deep the powder is (`SNOW_DIAL`), read as the sink a sled
//           standing in it takes.
//
// THE WEATHER ROW goes under TIME the day there is weather to ask for: a row
// lands the day the thing behind it exists.
//
// THE DAY'S TWO ROWS DEFER TO THE MAP until they are moved (`free-ride.ts`),
// so a fader stands on the dealt figure — which comes back with the chart —
// and moving it pins one. THE CHART IS A CONTROL too: a press on it is where
// the ride starts, and FROM THE GRID takes that back.
//
// What the rows WRITE is `settings.ride` — so a ride stood up from here and
// one a `?start=free` link boots into are the same ride read the same way.

import { SNOW_DIAL, dayOfYearOf, freeHours, restSinkOf, LEVEL_RULES } from "@engine";
import { useState } from "preact/hooks";

import {
  FREE_DAYS,
  HOUR_STEP,
  dateLabel,
  dayOnTravel,
  hourLabel,
  spotOn,
  type FreeRide,
} from "./free-ride.ts";
import { Caption, FadeRow, MenuHead, NumberRow, type Hint } from "./menu-knobs.tsx";
import { dealOf, SeedPreview, useSeedPreview } from "./seed-preview.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The seeds the MAP row walks. Seed 0 is not a map; a link may name any
 * seed the stream takes, and the row clamps what it is typed. */
export const SEED_RANGE = { min: 1, max: 999_999 } as const;

/** The hour row's travel before the chart has said where the sun is: R15's
 * own band, which every dealt map's hour lies in. */
const FALLBACK_HOURS = LEVEL_RULES.sun.hour;

/** A window of hours onto the row's quarter-hour grid, inside itself. */
function onGrid(w: { min: number; max: number }): { min: number; max: number } {
  const min = Math.ceil(w.min / HOUR_STEP) * HOUR_STEP;
  const max = Math.floor(w.max / HOUR_STEP) * HOUR_STEP;
  return max > min ? { min, max } : { min: w.min, max: w.max };
}

export function StartPage({
  settings,
  seed,
  onSettings,
  onReroll,
  onBack,
  onNext,
}: {
  settings: Settings;
  /** The map on the card: the stored one, or the front door's. */
  seed: number;
  onSettings: (settings: Settings) => void;
  /** Deal a fresh map. */
  onReroll: () => void;
  onBack: () => void;
  /** On to the sled card, which is where RIDE is. */
  onNext: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const ride = settings.ride;
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });

  const chart = useSeedPreview(seed);
  const deal = dealOf(chart);
  const day = ride.day ?? (deal ? dayOnTravel(deal.dayOfYear) : 30);
  const daylight = deal !== null ? freeHours(deal.latitude, dayOfYearOf(day)) : null;
  const hours = onGrid(daylight ?? FALLBACK_HOURS);
  const hour = Math.min(hours.max, Math.max(hours.min, ride.hour ?? deal?.hour ?? 12));

  return (
    <div class="menu-card menu-card-start" onPointerLeave={() => setHint(null)}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        /* THE WAY ON STANDS IN THE HEAD, opposite the way back: a press
           under the chart and the rows would be the part of the card that
           hangs off the bottom of a phone. */
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="next"
            data-nav-next
            data-nav-focus
            onClick={onNext}
          >
            <span class="menu-item-name">{STRINGS.startNext}</span>
          </button>
        }
      />
      <div class="start-cols">
        <div class="start-col">
          <div class="knob-rows">
            <NumberRow
              label={STRINGS.startMap}
              hint={STRINGS.startMapHint}
              value={seed}
              min={SEED_RANGE.min}
              max={SEED_RANGE.max}
              onValue={(next) => setRide({ seed: next })}
              onHint={setHint}
            />
          </div>
          <SeedPreview
            chart={chart}
            spot={spotOn(ride, seed)}
            onSpot={(at) => setRide({ spot: { seed, x: at.x, z: at.z } })}
          />
        </div>
        <div class="start-col">
          <div class="knob-rows">
            <FadeRow
              label={STRINGS.startDate}
              hint={STRINGS.startDateHint}
              value={day}
              min={FREE_DAYS.min}
              max={FREE_DAYS.max}
              step={FREE_DAYS.step}
              read={dateLabel}
              onChange={(next) => setRide({ day: next })}
              onHint={setHint}
            />
            <FadeRow
              label={STRINGS.startTime}
              hint={STRINGS.startTimeHint}
              value={hour}
              min={hours.min}
              max={hours.max}
              step={HOUR_STEP}
              read={hourLabel}
              onChange={(next) => setRide({ hour: next })}
              onHint={setHint}
            />
            <FadeRow
              label={STRINGS.startSnow}
              hint={STRINGS.startSnowHint}
              value={ride.depth}
              min={SNOW_DIAL.min}
              max={SNOW_DIAL.max}
              step={SNOW_DIAL.step}
              read={(depth) => STRINGS.snowRead(restSinkOf(depth))}
              onChange={(depth) => setRide({ depth })}
              onHint={setHint}
            />
          </div>
          <div class="start-actions">
            <button type="button" class="menu-chip" data-menu="reroll" onClick={onReroll}>
              <span class="menu-tile-name">{STRINGS.startReroll}</span>
            </button>
            <button
              type="button"
              class="menu-chip"
              data-menu="grid"
              disabled={spotOn(ride, seed) === null}
              onClick={() => setRide({ spot: null })}
            >
              <span class="menu-tile-name">{STRINGS.startGrid}</span>
            </button>
          </div>
        </div>
      </div>
      <Caption hint={hint} fallback={STRINGS.startCaption} />
    </div>
  );
}
