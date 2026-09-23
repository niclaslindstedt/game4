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
// THE TIME TRIAL beside it: the same loop alone, against the clock, the
// record book's row for this map, sled and length, and the ghost of the run
// that set it (`ghost-run.ts`). Its seed is the map the menu is standing
// over — the one just ridden, or the one a link pinned — because a trial is
// ridden again and again on ONE map, and a tile that dealt a fresh one
// every press would be a stopwatch with nothing to beat. Its length is the
// chip along the foot.
// TRICKS beside it: two minutes on the map's trick field (R20), alone, the
// score the run — on the map the menu stands over, like the trial's.
// THE FREE RIDE beside it, unlit: the whole map and nobody on it, set up on
// its own start card (`menu-start.tsx`) — a second way onto the snow, so a
// tile, but never a second red one.
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
  trial,
  onRace,
  onFree,
  onTrial,
  onTrialLaps,
  onSound,
  onOptions,
  tricks,
  onTricks,
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
  /** The TIME TRIAL tile: its seed, its length, and the row standing. */
  trial: { seed: number; laps: number; best: { time: number; sled: string } | null };
  onRace: () => void;
  onTrial: () => void;
  onTrialLaps: () => void;
  /** Onto the free ride's start card. */
  onFree: () => void;
  onSound: () => void;
  onOptions: () => void;
  /** The TRICKS tile: its seed and how long the run lasts, s. */
  tricks?: { seed: number; seconds: number };
  onTricks?: () => void;
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
          <button
            type="button"
            class="menu-tile menu-tile-wide"
            data-menu="trial"
            onClick={onTrial}
          >
            <Glyph name="clock" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuTrial}</span>
              <span class="menu-tile-line">{STRINGS.menuTrialLine(trial.seed, trial.laps)}</span>
              <span class="menu-tile-line">
                {trial.best
                  ? STRINGS.menuTrialBest(trial.best.time, trial.best.sled)
                  : STRINGS.menuTrialNoBest}
              </span>
            </span>
          </button>
          {tricks && (
            <button
              type="button"
              class="menu-tile menu-tile-wide"
              data-menu="tricks"
              onClick={onTricks}
            >
              <Glyph name="flip" />
              <span class="menu-tile-words">
                <span class="menu-tile-name">{STRINGS.menuTricks}</span>
                <span class="menu-tile-line">
                  {STRINGS.menuTricksLine(tricks.seed, tricks.seconds)}
                </span>
              </span>
            </button>
          )}
          <button type="button" class="menu-tile menu-tile-wide" data-menu="free" onClick={onFree}>
            <Glyph name="kicker" />
            <span class="menu-tile-words">
              <span class="menu-tile-name">{STRINGS.menuFree}</span>
              <span class="menu-tile-line">{STRINGS.menuFreeLine}</span>
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
          <button type="button" class="menu-chip" data-menu="trial-laps" onClick={onTrialLaps}>
            <Glyph name="clock" />
            <span class="menu-tile-name">{STRINGS.menuTrialLaps(trial.laps)}</span>
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
