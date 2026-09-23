// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE OVER A TRICKS RUN: the run's banked points and the buzzer in the
// top row where a race keeps its laps, the COMBO in hand over the nose —
// what the elements read as, and what they are worth so far, base × mult —
// and, for a moment after it closes, what it paid or what was lost. On a
// touchscreen, the TRICK press the poses are held on.
//
// Everything is drawn from the snapshot's `TrickTile` (`trick-tile.ts`); no
// number here is worked out, and no word is written here (`strings.ts`).

import type { InputManager } from "./input.ts";
import { STRINGS } from "./strings.ts";
import type { TrickTile } from "./trick-tile.ts";

/** The top row's two: the score, keyed on it so a combo banked lands with
 * its own beat, and the seconds before the buzzer. */
export function TricksChips({ tile }: { tile: TrickTile }) {
  return (
    <>
      <div class="hud-chip hud-score" key={tile.score}>
        <span>{STRINGS.score(tile.score)}</span>
        <span class="hud-chip-sub">{STRINGS.scoreLabel}</span>
      </div>
      <div class={`hud-chip${tile.left < 10 ? " hud-score-late" : ""}`}>
        <span>{Math.ceil(tile.left)}</span>
        <span class="hud-chip-sub">{STRINGS.timeLeftLabel}</span>
      </div>
    </>
  );
}

/** The combo over the nose: the line of elements and base × mult while it
 * is in hand; the points it paid (or the ones it lost) once it closes. */
export function ComboTile({ tile }: { tile: TrickTile }) {
  if (tile.combo) {
    return (
      <div class="hud-combo" role="status">
        {tile.combo.line && <span class="hud-combo-line">{tile.combo.line}</span>}
        <span class="hud-combo-points" key={tile.combo.mult}>
          {STRINGS.comboPoints(tile.combo.base, tile.combo.mult)}
        </span>
      </div>
    );
  }
  if (!tile.last) return null;
  const { last } = tile;
  return (
    <div
      class={`hud-combo hud-combo-closed${last.bailed ? " hud-combo-bailed" : ""}`}
      key={last.at}
      role="status"
    >
      {last.line && <span class="hud-combo-line">{last.line}</span>}
      <span class="hud-combo-points">
        {last.bailed ? STRINGS.comboBailed(last.points) : STRINGS.comboBanked(last.points)}
      </span>
    </div>
  );
}

/** THE TRICK PRESS for a thumb: held, the rider poses (`strokes.ts`). It
 * writes the input manager's touch channel directly, from the pointer events
 * every finger gets — a thumb is already on the bar or the lever. */
export function TrickPress({ input }: { input: InputManager }) {
  const up = (): void => {
    input.touch.trick = false;
  };
  return (
    <button
      type="button"
      class="hud-trick-press"
      onPointerDown={(e) => {
        e.preventDefault();
        input.touch.trick = true;
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
    >
      {STRINGS.trickPress}
    </button>
  );
}
