// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a race, by pressing
// Escape or the HUD's pause mark. The race holds where it stands
// (`shell.ts` says why this is the one card that freezes) and the card
// carries the ways on and nothing else:
//
//   RESUME        back to the snow, on the very frame it was left.
//   RESTART RACE  the race again from the grid, on the same map — the B
//                 key's own line.
//   SOUND         the one setting worth stopping for, and it applies to
//                 the frame in front of you the moment it moves.
//   MAIN MENU     out of the race and back to the front door. Nothing is
//                 torn down: the same sled carries on under the bot.
//
// RESUME IS THE CARD'S `data-nav-back` AND ITS `data-nav-focus`: a card
// opened by a thumb aiming for the reset beside the pause mark must cost one
// press to leave, so Escape, the backdrop and the cursor's landing are all
// the way back to the snow. RESTART and MAIN MENU both END the race, so they
// stand below the harmless rows, never one row's travel from RESUME.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`): it is the
// same game asking the same kind of question, and `menu-nav.ts` already
// walks anything inside a `.menu-card`.

import { Glyph } from "./menu-glyphs.tsx";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

export function PauseMenu({
  snap,
  sound,
  onResume,
  onRestart,
  onSound,
  onMainMenu,
}: {
  /** THE HELD RACE, as the HUD behind this card reads it. */
  snap: HudSnapshot;
  sound: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSound: () => void;
  onMainMenu: () => void;
}) {
  return (
    <div
      class="menu"
      // The backdrop presses the card's own way out: back to the snow.
      onPointerDown={onResume}
      role="presentation"
    >
      <div
        class="menu-card menu-card-pause"
        onPointerDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div class="menu-pause-head">
          <div class="menu-title">{STRINGS.pauseHead}</div>
          <div class="menu-sub">{STRINGS.pauseSub(snap.seed, snap.lap, snap.laps)}</div>
        </div>
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
          <button type="button" class="menu-item" aria-pressed={sound} onClick={onSound}>
            <Glyph name={sound ? "speaker" : "mute"} />
            <span class="menu-item-name">{STRINGS.menuSound(sound)}</span>
          </button>
          <button type="button" class="menu-item" onClick={onRestart}>
            <Glyph name="restart" />
            <span class="menu-item-name">{STRINGS.pauseRestart}</span>
          </button>
          <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
            <Glyph name="exit" />
            <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
