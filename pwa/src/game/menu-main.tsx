// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FRONT DOOR — the card the app opens onto once the attract card has
// been pressed away, painted over a LIVE RACE: the engine is stepping a
// bot-ridden race behind this card the whole time it is up, and the camera
// turns slowly round the sled. A menu that stopped the snow would be a menu
// that announces the game is not running.
//
// ONE WAY ONTO THE SNOW, and it is the lit tile: RACE, three laps against
// three riders on a map dealt fresh from a seed. The seed is ON the tile —
// the map is the thing the press is about to build, and a number a player
// can read off it is a number they can hand to somebody else (`?seed=`).
// A link that pinned the seed says so, because a RACE press that rode the
// same map every time with nothing on the card to say why would read as a
// broken dealer.
//
// EVERYTHING THAT IS NOT SNOW, along the foot: the sound switch, OPTIONS
// (`menu-options.tsx`), the keys on a machine that has them — read off the
// bindings the rider actually has — and the build. Low, and not tile-shaped at
// all, because a thing that does not start a race should not wear the shape
// of one.

import { APP_NAME, REPO_URL } from "../identity.ts";
import { MarkTrails } from "./mark-trails.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

/** The build, bottom right, linking to the exact commit it was cut from. A
 * build with no commit behind it says so and links nowhere — a dead link is
 * worse than an honest label. */
function VersionStamp() {
  const label = `v${__APP_VERSION__}`;
  const sha = __COMMIT_SHA__;
  if (!sha || sha === "dev") {
    return <span class="menu-version menu-version-dev">{label} · dev</span>;
  }
  return (
    <a
      class="menu-version"
      href={`${REPO_URL}/commit/${sha}`}
      target="_blank"
      rel="noreferrer noopener"
      title="Open this build's commit on GitHub"
    >
      {label} · {sha}
    </a>
  );
}

export function MainMenu({
  seed,
  pinned,
  laps,
  riders,
  sound,
  keys,
  onRace,
  onSound,
  onOptions,
}: {
  /** The seed RACE will build. */
  seed: number;
  /** Whether a link pinned it. */
  pinned: boolean;
  laps: number;
  riders: number;
  sound: boolean;
  /** The keys line, on a machine that has keys worth listing. */
  keys: string | null;
  onRace: () => void;
  onSound: () => void;
  onOptions: () => void;
}) {
  return (
    <div class="menu">
      <div class="menu-card menu-card-root">
        <div class="menu-brand">
          <div class="menu-brand-line">
            <MarkTrails lay="once" className="menu-brand-mark" />
            <span class="menu-brand-name">{APP_NAME.toUpperCase()}</span>
          </div>
        </div>
        <div class="menu-tiles">
          <button
            type="button"
            class="menu-tile menu-tile-hero"
            data-menu="race"
            data-nav-next
            data-nav-focus
            onClick={onRace}
          >
            {/* The sheen: a slow bar of light travelling the tile, the one
                moving thing on the card. A transform, and off under
                `prefers-reduced-motion`. */}
            <span class="menu-tile-sheen" aria-hidden="true" />
            <Glyph name="flag" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuRace}</span>
              <span class="menu-tile-line">{STRINGS.menuRaceLine(seed, laps, riders)}</span>
              {pinned && <span class="menu-tile-line">{STRINGS.menuRacePinned}</span>}
            </span>
          </button>
        </div>
        <div class="menu-strip">
          <button
            type="button"
            class="menu-chip"
            data-menu="sound"
            aria-pressed={sound}
            onClick={onSound}
          >
            <Glyph name={sound ? "speaker" : "mute"} />
            <span class="menu-tile-name">{STRINGS.menuSound(sound)}</span>
          </button>
          <button type="button" class="menu-chip" data-menu="options" onClick={onOptions}>
            <Glyph name="sliders" />
            <span class="menu-tile-name">{STRINGS.menuOptions}</span>
          </button>
          {keys !== null && <span class="menu-keys">{keys}</span>}
          <VersionStamp />
        </div>
      </div>
    </div>
  );
}
