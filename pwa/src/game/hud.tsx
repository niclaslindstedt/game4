// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD: chunky arcade chrome over the canvas. Reads a low-rate snapshot
// (the app refreshes it ~12×/s — the canvas is the 60 fps surface, the HUD
// is not) and lays out everything drawn over the snow:
//
//   top left      the race clock, the POSITION, the LAP and the CHECKPOINT
//                 count on one row — the facts about how the race is going,
//                 read down one left-aligned column — and under them the
//                 SPLIT at the last checkpoint while it is fresh. On a FREE
//                 RIDE, which has no race to read, the clock, the BEST AIR
//                 and the distance RIDDEN
//   top right     the three presses: PAUSE, RESET and CAMERA, and under
//                 them the MINIMAP — the loop, the field and the checkpoint
//                 owed, turned heading-up about the rider (minimap.tsx)
//   top centre    the AIR CLOCK while the sled is off the snow — the one
//                 number a rider is trying to make go up, where he is
//                 already looking to aim the landing
//   dead centre   the LIGHTS, and GO
//   upper centre  a MISSED CHECKPOINT warning with an arrow pointing back at
//                 it and the metres to go, until it is taken
//   bottom left   the rev bar over the speed
//   bottom right  the news column — a checkpoint's clock, a lap, a tree
//
// The thumb zones it hangs under all that are next door in hud-touch.tsx:
// they are the one part of this screen that does NOT run off the snapshot
// (they write into the input manager at pointer rate). Every word here comes
// from strings.ts (§39.1).

import { REPO_URL } from "../identity.ts";
import { formatTime } from "../lib/util.ts";
import { HudActions } from "./hud-actions.tsx";
import { RevBar } from "./hud-dial.tsx";
import { BarZone, LeverZone, type ZoneSide } from "./hud-touch.tsx";
import type { TouchFeel } from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { Minimap } from "./minimap.tsx";
import type { HudFlash } from "./run-news.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";
import { UpdateButton } from "./update-button.tsx";

export type { HudFlash };

/** Whether the device has a touchscreen to put the thumb zones on. A laptop
 * with one reports it and gets them; a desktop does not. */
export function hasTouch(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

/** THE ARROW BACK TO A MISSED CHECKPOINT: a chevron turned by the screen
 * angle the snapshot hands it (clockwise from straight ahead), so "behind
 * you and to the left" reads as an arrow pointing down and left. */
function MissedArrow({ angle }: { angle: number }) {
  return (
    <svg
      class="hud-missed-arrow"
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      style={{ transform: `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)` }}
    >
      <path d="M 0 -42 L 34 20 L 0 4 L -34 20 Z" />
    </svg>
  );
}

export function Hud({
  snap,
  flashes,
  touch,
  input,
  feel,
  lever,
  away,
  onReset,
  onCamera,
  onPause,
}: {
  snap: HudSnapshot;
  flashes: HudFlash[];
  /** Draw the thumb zones. */
  touch: boolean;
  input: InputManager;
  /** How the thumbs read (OPTIONS ▸ CONTROLS). */
  feel: TouchFeel;
  /** Which side of the glass the lever stands on; the bar takes the other. */
  lever: ZoneSide;
  /** The TAB is away and the clock with it (§37.3) — not the pause card,
   * which is a surface of its own (`menu-pause.tsx`) and stands over all of
   * this. The two share a word and nothing else. */
  away: boolean;
  onReset: () => void;
  onCamera: () => void;
  onPause: () => void;
}) {
  return (
    <div
      class="hud"
      data-air={snap.airTime > 0 ? "1" : undefined}
      data-finished={snap.finished ? "1" : undefined}
      data-touch={touch ? "1" : undefined}
    >
      <div class="hud-top">
        <div class="hud-top-row">
          <div class="hud-clock">
            <span class="hud-clock-time">{formatTime(snap.time)}</span>
            <span class="hud-chip-sub">{STRINGS.clockLabel}</span>
          </div>
          {/* THE FREE RIDE'S TWO: the longest flight so far — keyed on it,
              so a new best lands with its own beat — and the odometer. */}
          {snap.free && (
            <div class="hud-chip hud-best-air" key={snap.bestAir}>
              <span>{STRINGS.air(snap.bestAir)}</span>
              <span class="hud-chip-sub">{STRINGS.bestAirLabel}</span>
            </div>
          )}
          {snap.free && (
            <div class="hud-chip">
              <span>{STRINGS.distance(snap.distance)}</span>
              <span class="hud-chip-sub">{STRINGS.distanceLabel}</span>
            </div>
          )}
          {/* THE PLACE — the one number a racer reads more than the clock.
              Keyed on the place, so a pass lands with its own beat. Left
              out of a race alone, where 1 / 1 says nothing. */}
          {!snap.free && snap.riders > 1 ? (
            <div class="hud-chip hud-place" key={snap.place}>
              <span>{STRINGS.place(snap.place, snap.riders)}</span>
              <span class="hud-chip-sub">{STRINGS.placeLabel}</span>
            </div>
          ) : null}
          {!snap.free && (
            <div class="hud-chip">
              <span>{STRINGS.laps(snap.lap, snap.laps)}</span>
              <span class="hud-chip-sub">{STRINGS.lapsLabel}</span>
            </div>
          )}
          {!snap.free && (
            <div class="hud-chip">
              <span>{STRINGS.checkpoints(snap.taken, snap.checkpoints)}</span>
              <span class="hud-chip-sub">{STRINGS.checkpointsLabel}</span>
            </div>
          )}
        </div>
        {/* THE SPLIT, under the row it belongs to: the clock as it stood at
            the checkpoint just taken, held for a few seconds and then gone,
            so a stale figure is never read as a fresh one. Keyed on the
            figure so a new split lands with the beat. */}
        {snap.split !== null && (
          <div class="hud-top-row">
            <div class="hud-chip hud-split" key={snap.split}>
              <span>{STRINGS.split(snap.split)}</span>
              <span class="hud-chip-sub">{STRINGS.splitLabel}</span>
            </div>
            {/* ...and beside it, against the record at the same crossing:
                green ahead, red behind. */}
            {snap.gap !== null && (
              <div
                class={`hud-chip hud-split hud-gap ${snap.gap < 0 ? "hud-gap-ahead" : "hud-gap-behind"}`}
                key={`gap-${snap.split}`}
              >
                <span>{STRINGS.gap(snap.gap)}</span>
                <span class="hud-chip-sub">{STRINGS.gapLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div class="hud-topright">
        <HudActions
          onPause={onPause}
          onReset={onReset}
          onCamera={onCamera}
          missed={snap.missed !== null}
        />
        <Minimap map={snap.minimap} />
      </div>

      {/* THE MISSED CHECKPOINT, centred in the upper quarter where the eye
          can read it without leaving the snow: the word, the arrow back at
          it and the metres. Up until the checkpoint is taken, however long
          that is — the engine keeps it owed, so nothing here keeps time. */}
      {snap.missed !== null && (
        <div class="hud-missed" role="status">
          <span class="hud-missed-title">{STRINGS.missed}</span>
          <MissedArrow angle={snap.missed.angle} />
          <span class="hud-missed-distance">{STRINGS.missedBack(snap.missed.distance)}</span>
        </div>
      )}

      <div class="hud-speed">
        <div class="hud-revs-row">
          <RevBar rpm={snap.rpm} idle={snap.idle} braking={snap.braking} />
          <span class={`hud-chip-sub ${snap.braking ? "hud-brake" : ""}`}>
            {snap.braking ? STRINGS.brake : STRINGS.revs}
          </span>
        </div>
        <div class="hud-cluster">
          <span class="hud-speed-num">{Math.round(snap.speedKmh)}</span>
          <span class="hud-speed-unit">{STRINGS.speedUnit}</span>
        </div>
      </div>

      {/* THE LIGHTS, dead centre and as big as the frame allows: the one
          moment the whole screen is about one number. Keyed on the count,
          so each light lands with its own beat; GO is the same element with
          the word in it, for the moment after. */}
      {(snap.countdown > 0 || snap.go) && (
        <div class="hud-center hud-lights">
          <span
            class={`hud-count${snap.go ? " hud-count-go" : ""}`}
            key={snap.go ? 0 : snap.countdown}
          >
            {snap.go ? STRINGS.go : STRINGS.count(snap.countdown)}
          </span>
        </div>
      )}

      {/* THE AIR CLOCK, top centre, from the moment a flight has lasted long
          enough to BE one until the skis are back on the snow. A flight on
          course to be the race's longest says so while it is still up. */}
      {snap.airTime > 0 && (
        <div class="hud-air">
          <div class="hud-air-tile">
            <span class={`hud-air-read ${snap.airBest ? "hud-air-read-best" : ""}`}>
              <span class="hud-air-num">{STRINGS.air(snap.airTime)}</span>
              <span class="hud-chip-sub">{STRINGS.airLabel}</span>
              {snap.airBest && <span class="hud-air-best">{STRINGS.airBest}</span>}
            </span>
          </div>
        </div>
      )}

      <div class="hud-right">
        <div class="hud-flashes">
          {flashes.map((f) => (
            <span key={f.id} class={`hud-flash hud-flash-${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
        {/* Nothing on the days there is no new build: it draws itself or it
            draws nothing. At the FOOT of the column, so a flash arriving
            never moves a button a thumb is on its way to. */}
        <UpdateButton />
      </div>

      {/* §38.3: the build says what it is — version and commit, linked to
          the source — and beside it the map this frame is of. */}
      <div class="hud-build">
        <span>{STRINGS.stage(snap.seed)}</span>
        <a href={`${REPO_URL}/commit/${__COMMIT_SHA__}`} target="_blank" rel="noreferrer">
          {__BUILD_LABEL__}
        </a>
      </div>

      {away && (
        <div class="hud-center">
          <div class="hud-card">
            <span class="hud-card-title">{STRINGS.paused}</span>
            <span class="hud-card-note">{STRINGS.pausedNote}</span>
          </div>
        </div>
      )}

      {touch && (
        <div class="hud-touch">
          {/* In reading order, so the zone on the left is the first child
              whichever of the two it is. */}
          {lever === "left" && <LeverZone touch={input.touch} feel={feel} side="left" />}
          <BarZone touch={input.touch} feel={feel} side={lever === "left" ? "right" : "left"} />
          {lever === "right" && <LeverZone touch={input.touch} feel={feel} side="right" />}
        </div>
      )}
    </div>
  );
}
