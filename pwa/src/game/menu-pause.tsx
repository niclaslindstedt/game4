// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a race, by pressing
// Escape or the HUD's pause mark. The race holds where it stands
// (`shell.ts` says why this is the one card that freezes) and the card
// carries the ways on and nothing else:
//
//   RESUME        back to the snow, on the very frame it was left.
//   OPTIONS       the handful of settings a rider actually stops mid-race
//                 for, ON A PANEL OF THEIR OWN rather than inline under
//                 RESUME.
//   RESTART RACE  the race again from the grid, on the same map — the B
//                 key's own line. Over a free ride, START AGAIN: the same
//                 ride from where it started.
//   WATCH REPLAY  the race so far, from the outside (`replay-run.ts`) —
//                 which ENDS it, and the row says so.
//   MAIN MENU     out of the race and back to the front door. Nothing is
//                 torn down: the same sled carries on under the bot.
//
// AND THE RACE ITSELF IS BILLED (`pause-stats.ts`): up to four figures under
// the head — the standing and the clock, then what the corner behind this
// card cannot hold: the record being ridden against, the longest flight, how
// far has been ridden.
//
// THE SETTINGS ARE BEHIND A DOOR, NOT SPREAD ACROSS THE CARD. Nine people in
// ten open this card to RESUME, and every row above that press is a row in
// the way of it; one word costs the card one row. IT IS STILL NOT THE
// OPTIONS PAGE: the picture rows and the assists wait for the front door —
// the assists are dealt when a race is stood up, and a picture row is judged
// against snow that is MOVING. What is here is what is about the FRAME in
// front of you and reads perfectly well held still: where the eye rides, and
// the sound.
//
// EACH PANEL OWNS ITS OWN WAY OUT, one press deep at all times. On the card
// that is RESUME (`data-nav-back`, and where the cursor lands —
// `data-nav-focus`): a card opened by a thumb aiming for the reset beside the
// pause mark must cost one press to leave. On the panel it is the head's ‹
// back to the card. The BACKDROP follows whichever is up, so Escape, the
// backdrop and the cursor's own way out are always the same step. RESTART and
// MAIN MENU both END the race, so they stand below OPTIONS, never one row's
// travel from RESUME.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`): it is the
// same game asking the same kind of question, and `menu-nav.ts` already
// walks anything inside a `.menu-card`. Every word comes from strings.ts.

import { useState } from "preact/hooks";

import { Glyph } from "./menu-glyphs.tsx";
import { Caption, KnobGroup, MenuHead, StepRow, type Hint, type Stop } from "./menu-knobs.tsx";
import { SoundRows } from "./menu-options.tsx";
import { pauseStats } from "./pause-stats.ts";
import type { CameraRung } from "./renderer-api.ts";
import { RUN_CAMERAS, type Settings } from "./settings.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** The camera ladder in words, the C key's own rungs in its own order. */
const CAMERA_STOPS: Stop<CameraRung>[] = RUN_CAMERAS.map((id) => ({
  id,
  label: STRINGS.cameraWords[id as Exclude<CameraRung, "orbit">],
}));

/** The pause card's OPTIONS panel: the camera and the sound, on the card's
 * own narrow plate. It keeps the caption bar — a rider who has stopped
 * mid-race is exactly the one with a moment to read what a row does. */
function PauseOptions({
  settings,
  onSettings,
  onCamera,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onCamera: (rung: CameraRung) => void;
  onBack: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  return (
    <div
      class="menu-card menu-card-pause menu-card-pause-options"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerLeave={() => setHint(null)}
      role="presentation"
    >
      <MenuHead back={onBack} backLabel={STRINGS.pauseBack} title={STRINGS.menuOptions} />
      <div class="knob-groups">
        <KnobGroup title={STRINGS.optCameraGroup} glyph="display">
          <StepRow
            label={STRINGS.optCamera}
            hint={STRINGS.optCameraHint}
            stops={CAMERA_STOPS}
            value={settings.camera}
            onPick={onCamera}
            onHint={setHint}
          />
        </KnobGroup>
        <KnobGroup title={STRINGS.optSoundGroup} glyph={settings.sound ? "speaker" : "mute"}>
          <SoundRows settings={settings} onSettings={onSettings} onHint={setHint} />
        </KnobGroup>
      </div>
      <Caption hint={hint} fallback={STRINGS.pauseOptionsCaption} />
    </div>
  );
}

export function PauseMenu({
  snap,
  settings,
  onSettings,
  onCamera,
  onResume,
  onRestart,
  onMainMenu,
  onReplay = null,
}: {
  /** THE HELD RACE, as the HUD behind this card reads it — which is what the
   * card bills it by, the figures chosen from it by rule (`pause-stats.ts`). */
  snap: HudSnapshot;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  /** A rung picked on the panel: stored AND put on the lens now, so the held
   * frame behind the card is the answer. */
  onCamera: (rung: CameraRung) => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  /** Watch the race so far, or null where there is no recording of it. */
  onReplay?: (() => void) | null;
}) {
  // Which of the card's two faces is up. Local, and dropped the moment the
  // card is: coming back to a held race costs the same one press every time.
  const [options, setOptions] = useState(false);
  const stats = pauseStats(snap);
  return (
    <div
      class="menu"
      // The backdrop presses whatever the card's own way out is: one step
      // back off the panel, and off the card back to the snow.
      onPointerDown={() => (options ? setOptions(false) : onResume())}
      role="presentation"
    >
      {options ? (
        <PauseOptions
          settings={settings}
          onSettings={onSettings}
          onCamera={onCamera}
          onBack={() => setOptions(false)}
        />
      ) : (
        <div
          class="menu-card menu-card-pause"
          onPointerDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div class="menu-pause-head">
            <div class="menu-title">{STRINGS.pauseHead}</div>
            <div class="menu-sub">
              {snap.tricks
                ? STRINGS.pauseSubTricks(snap.seed, snap.tricks.score)
                : snap.free
                  ? STRINGS.pauseSubFree(snap.seed)
                  : STRINGS.pauseSub(snap.seed, snap.lap, snap.laps)}
            </div>
          </div>
          {/* HOW THE RACE HAS GONE, in one row across: the figure over its
              caption, the HUD's own arrangement. */}
          {stats.length > 0 && (
            <div class="pause-stats">
              {stats.map((stat) => (
                <div class="pause-stat" key={stat.key}>
                  <span class="pause-stat-value">{stat.value}</span>
                  <span class="pause-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
          <div class="menu-items">
            <button
              type="button"
              class="menu-item menu-item-start"
              data-nav-back
              data-nav-focus
              onClick={onResume}
            >
              <Glyph name="play" />
              <span class="menu-item-name">{STRINGS.pauseResume}</span>
            </button>
            {/* Second, so a thumb aiming for the snow cannot land on a press
                that ends the race. */}
            <button type="button" class="menu-item" onClick={() => setOptions(true)}>
              <Glyph name="sliders" />
              <span class="menu-item-name">{STRINGS.pauseOptions}</span>
            </button>
            <button type="button" class="menu-item" onClick={onRestart}>
              <Glyph name="restart" />
              <span class="menu-item-name">
                {snap.free ? STRINGS.pauseRestartFree : STRINGS.pauseRestart}
              </span>
            </button>
            {onReplay && (
              <button type="button" class="menu-item" onClick={onReplay}>
                <Glyph name="play" />
                <span class="menu-item-name">{STRINGS.replayWatch}</span>
                <span class="menu-item-note">{STRINGS.replayWatchNote}</span>
              </button>
            )}
            <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
              <Glyph name="exit" />
              <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
