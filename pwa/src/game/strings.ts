// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the cards reference a key here and never carry a literal of their own,
// so a line can be fixed without a code review and a second language is a
// second table rather than a rewrite. Composed lines are templates —
// functions of their parameters — never concatenations at the call site
// (§39.2). Developer diagnostics are deliberately not here.

import { formatTime, ordinal } from "../lib/util.ts";

export const STRINGS = {
  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  speedUnit: "km/h",
  revs: "RPM",
  brake: "BRAKE",
  clockLabel: "TIME",
  /** The lap being ridden, of how many. */
  laps: (lap: number, total: number): string => `${lap} / ${total}`,
  lapsLabel: "LAP",
  /** Checkpoints taken this lap, of how many the loop has. */
  checkpoints: (taken: number, total: number): string => `${taken} / ${total}`,
  checkpointsLabel: "CHECKPOINT",
  /** Where the rider stands in the field, `1ST / 4`. */
  place: (place: number, of: number): string => `${ordinal(place)} / ${of}`,
  placeLabel: "POS",
  /** The clock at the last checkpoint taken, and its caption. */
  split: (seconds: number): string => formatTime(seconds),
  splitLabel: "SPLIT",
  /** The air-time readout, tenths. */
  air: (seconds: number): string => `${seconds.toFixed(1)}s`,
  airLabel: "AIR",
  airBest: "BEST",
  /** THE LIGHTS: the whole second still to run, and the word after. */
  count: (left: number): string => String(left),
  go: "GO!",
  /** The standing warning after a checkpoint ridden past without being
   * taken, and how far back it is. */
  missed: "MISSED CHECKPOINT",
  missedBack: (metres: number): string => `${Math.round(metres)} M BACK`,
  /** The three presses in the corner. */
  resetTitle: "Back to the last checkpoint you took (R)",
  cameraTitle: "Next camera (C)",
  pauseTitle: "Pause (Esc)",
  /** The build corner: which map this frame is of. */
  stage: (seed: number): string => `SEED ${seed}`,
  /** The card the HUD puts up while the TAB is away (§37.3) — not the pause
   * card, which is next door in menu-pause.tsx and shares only the word. */
  paused: "PAUSED",
  pausedNote: "The race waits until you come back",

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsCheckpoint: (index: number, seconds: number): string => `CP ${index}  ${formatTime(seconds)}`,
  newsStart: "START LINE",
  newsLap: (lap: number, seconds: number): string => `LAP ${lap}  ${formatTime(seconds)}`,
  newsLastLap: "FINAL LAP",
  newsMissed: (index: number): string => (index === 0 ? "MISSED THE LINE" : `MISSED CP ${index}`),
  newsTree: "TREE!",
  newsHarsh: "HARD LANDING",
  newsReset: "BACK ON THE TRACK",
  newsFinish: (place: number, of: number, seconds: number): string =>
    `${ordinal(place)} OF ${of}  ${formatTime(seconds)}`,

  /* ── THE FINISH PLATE (hud-result.tsx) ─────────────────────────────── */
  resultTitle: "RACE FINISHED",
  resultPlace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  resultTime: (seconds: number): string => formatTime(seconds),
  /** A rider's name on the standings. */
  riderYou: "YOU",
  riderRival: (slot: number): string => `RIDER ${slot}`,
  /** A rider still out on the loop, and how far round. */
  standingOut: (lap: number, laps: number): string => `LAP ${lap}/${laps}`,
  resultAgain: "RACE AGAIN",
  resultNew: "NEW MAP",
  resultNote: "B races again · ESC holds the race",

  /* ── THE UPDATE BUTTON (update-button.tsx) ─────────────────────────── */
  updateWord: "RELOAD",
  updateReady: (version: string | null): string =>
    version !== null
      ? `New build v${version} ready — reload to install`
      : "New build ready — reload to install",
  updateArmed: "Press again to reload onto the new build",

  /* ── THE ATTRACT CARD (splash-screen.tsx) ──────────────────────────── */
  loading: "loading",
  splashPresents: "PRESENTS",
  splashTap: "TAP TO START",
  splashPress: "PRESS ANY KEY TO START",

  /* ── THE FRONT DOOR (menu-main.tsx) ────────────────────────────────── */
  menuRace: "RACE",
  menuRaceLine: (seed: number, laps: number, riders: number): string =>
    `SEED ${seed} · ${laps} LAPS · ${riders} RIDERS`,
  menuRacePinned: "PINNED BY THE LINK",
  menuSound: (on: boolean): string => (on ? "SOUND ON" : "SOUND OFF"),
  menuKeys: "W/↑ throttle · S/↓ brake · A D/← → steer · Q/E lean · R reset · C camera",

  /* ── THE LOADING CARD (loading-screen.tsx) ─────────────────────────── */
  /** The phases of a load, in order; steps sharing a label are one PHASE
   * and one slot in the count. */
  loadLevel: "Shaping the mountain",
  loadScene: "Planting the forest",
  loadWarm: "Packing the track",
  /** The phase and where it sits in the plan — a count of PHASES, never of
   * seconds (see `run-loader.ts`). */
  loadStep: (label: string, at: number, of: number): string => `${label}… (${at}/${of})`,
  /** A seed the generator refused, said on the card the player is looking
   * at rather than swallowed. */
  loadFailed: "NO TRACK ON THIS SEED",
  loadFailedHint: "Try another map",
  loadFailedBack: "BACK",

  /* ── THE PAUSE CARD (menu-pause.tsx) ───────────────────────────────── */
  pauseHead: "PAUSED",
  pauseSub: (seed: number, lap: number, laps: number): string =>
    `SEED ${seed} · LAP ${lap} OF ${laps}`,
  pauseResume: "RESUME",
  pauseRestart: "RESTART RACE",
  pauseMainMenu: "MAIN MENU",
} as const;
