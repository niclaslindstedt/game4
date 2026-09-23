// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the cards reference a key here and never carry a literal of their own,
// so a line can be fixed without a code review and a second language is a
// second table rather than a rewrite. Composed lines are templates —
// functions of their parameters — never concatenations at the call site
// (§39.2). Developer diagnostics are deliberately not here.

import type { TrickKind, TrickPart } from "@engine";

import { formatTime, ordinal } from "../lib/util.ts";
import { CAMPAIGN_STRINGS } from "./strings-campaign.ts";
import { DEV_STRINGS } from "./strings-dev.ts";
import { GALLERY_STRINGS } from "./strings-gallery.ts";

/** THE TRICK VOCABULARY: what each element the engine names (`TrickKind`)
 * is CALLED. The engine names the thing and never the word. */
export const TRICK_WORDS: Readonly<Record<TrickKind, string>> = {
  air: "BIG AIR",
  backflip: "BACKFLIP",
  frontflip: "FRONT FLIP",
  spin: "360",
  twist: "TWIST",
  oneFoot: "ONE-FOOTER",
  canCan: "CAN-CAN",
  tuck: "TUCK",
};

/** How a revolution's count reads in front of a flip. */
const TIMES = ["", "", "DOUBLE ", "TRIPLE "];

/** One element as read: a flip by its count, a spin by its degrees. */
function trickWord(kind: TrickKind, spins: number): string {
  if (kind === "spin") return String(360 * spins);
  if (kind === "backflip" || kind === "frontflip") {
    return `${TIMES[spins] ?? `${spins}× `}${TRICK_WORDS[kind]}`;
  }
  return TRICK_WORDS[kind];
}

/** THE COMBO AS ONE LINE: its elements in the order they were won, a
 * revolution's later index read INTO its first (a backflip that came round
 * twice in one flight is one DOUBLE BACKFLIP, not two words). */
export function comboLine(parts: readonly TrickPart[]): string {
  const merged: { kind: TrickKind; spins: number; flight: number }[] = [];
  for (const p of parts) {
    const same = p.spins > 1 && merged.find((m) => m.kind === p.kind && m.flight === p.flight);
    if (same) same.spins = Math.max(same.spins, p.spins);
    else merged.push({ ...p });
  }
  return merged.map((m) => trickWord(m.kind, m.spins)).join(" + ");
}

export const STRINGS = {
  /* ── THE SHUTTER AND THE GALLERY — stated in strings-gallery.ts ─────── */
  ...GALLERY_STRINGS,
  /* ── THE DEVELOPER PAGE — stated in strings-dev.ts ─────────────────── */
  ...DEV_STRINGS,

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
  /** THE FREE RIDE's two readouts in place of the race's: the longest
   * flight so far, and how far has been ridden. */
  bestAirLabel: "BEST AIR",
  distance: (metres: number): string =>
    metres < 1000 ? `${Math.round(metres)} M` : `${(metres / 1000).toFixed(2)} KM`,
  distanceLabel: "RIDDEN",
  /** THE LIGHTS: the whole second still to run, and the word after. */
  count: (left: number): string => String(left),
  go: "GO!",
  /** The standing warning after a checkpoint ridden past without being
   * taken, and how far back it is. */
  missed: "MISSED CHECKPOINT",
  missedBack: (metres: number): string => `${Math.round(metres)} M BACK`,
  /** The standing hint while the tread is dug in (`trench.ts`). */
  stuck: "STUCK",
  stuckHow: "ROCK IT: LEAN AND BARS",
  /** THE DAMAGE INSTRUMENT: its caption, and what each part is called. */
  damageLabel: "DAMAGE",
  damageSkiLeft: "Left ski",
  damageSkiRight: "Right ski",
  damageSuspension: "Suspension",
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
  /** THE WIPEOUT (`crash.ts`), by what put the rider off. */
  newsWipeout: (cause: "tree" | "nose" | "roll"): string =>
    cause === "tree" ? "WIPEOUT! TREE" : cause === "nose" ? "WIPEOUT! NOSED IN" : "WIPEOUT! ROLLED",
  newsStuck: "STUCK! ROCK IT OUT",
  newsDamage: (part: "skiLeft" | "skiRight" | "suspension"): string =>
    part === "suspension"
      ? "SUSPENSION HURT"
      : part === "skiLeft"
        ? "LEFT SKI BENT"
        : "RIGHT SKI BENT",
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
  menuFree: "FREE RIDE",
  menuFreeLine: "THE WHOLE MAP · NO CLOCK TO BEAT",
  /* ── THE TRICKS RUN (menu-main.tsx, hud-combo.tsx, hud-result.tsx) ── */
  menuTricks: "TRICKS",
  menuTricksLine: (seed: number, seconds: number): string =>
    `SEED ${seed} · THE TRICK FIELD · ${Math.round(seconds / 60)} MIN`,
  /** The run's banked score, the buzzer, and the combo in hand. */
  score: (points: number): string => points.toLocaleString("en-US"),
  scoreLabel: "SCORE",
  timeLeftLabel: "LEFT",
  comboPoints: (base: number, mult: number): string =>
    `${Math.round(base).toLocaleString("en-US")} × ${mult}`,
  comboBanked: (points: number): string => `+${points.toLocaleString("en-US")}`,
  comboSketchy: "SKETCHY",
  comboBailed: (points: number): string => `BAILED −${points.toLocaleString("en-US")}`,
  /** The touch press held for a pose. */
  trickPress: "TRICK",
  keyTrick: "TRICK",
  newsTricksFinish: (points: number): string => `TIME! ${points.toLocaleString("en-US")} PTS`,
  resultTricksTitle: "TRICKS",
  pauseSubTricks: (seed: number, points: number): string =>
    `SEED ${seed} · TRICKS · ${points.toLocaleString("en-US")} PTS`,
  menuSound: (on: boolean): string => (on ? "SOUND ON" : "SOUND OFF"),

  menuOptions: "OPTIONS",
  menuBack: "BACK",

  /* ── THE SLED CARD (menu-sled.tsx, sled-picker.tsx, sled-stats.ts) ─── */
  sledTitle: "SLED",
  sledRide: "RIDE",
  sledPrev: "Previous sled",
  sledNext: "Next sled",
  sledOf: (at: number, of: number): string => `${at} / ${of}`,
  sledFacts: { top: "TOP SPEED", sprint: "0–100", power: "POWER" },
  sledUnits: { speed: "KM/H", seconds: "S", power: "HP" },
  sledBars: {
    accel: "ACCELERATION",
    top: "TOP SPEED",
    corner: "CORNERING",
    powder: "POWDER",
    landing: "LANDINGS",
  },

  /* ── THE START CARD (menu-start.tsx, seed-preview.tsx) ─────────────── */
  startTitle: "FREE RIDE",
  startNext: "NEXT",
  startMap: "MAP",
  startMapHint: "Which map: every seed is another basin. Type one, or step through them.",
  startReroll: "ANOTHER MAP",
  startRegion: "COUNTRY",
  startRegionHint:
    "What kind of snow country the map is built in: boreal forest, high alpine bowls above the tree line, a wind-crusted tundra plateau, or a birch valley with a frozen river through it.",
  /** The REGION row's stops (R21) — a kind of country, never a place. */
  regionNames: { boreal: "BOREAL", alpine: "ALPINE", tundra: "TUNDRA", birch: "BIRCH VALLEY" },
  startDate: "DATE",
  startDateHint:
    "The day of the year: how high the sun climbs and how long the shadows are. Starts on the map's own.",
  startTime: "TIME",
  startTimeHint:
    "The hour the ride starts at, sunrise to sunset on that date. The sun moves an hour every ten minutes of riding.",
  startWeather: "WEATHER",
  startWeatherHint:
    "The sky over the ride: the map's own, or clear, fair, high cloud, overcast (flat light, the bumps hard to read), falling snow or a valley fog.",
  /** The WEATHER row's stops: the map's own first, then R19's six. */
  weatherDealt: "AS DEALT",
  weatherNames: {
    clear: "CLEAR",
    fair: "FAIR",
    high: "HIGH CLOUD",
    overcast: "OVERCAST",
    snow: "SNOWING",
    fog: "FOG",
  },
  startSnow: "SNOW",
  startSnowHint:
    "How deep the powder is: how far a sled sinks in it standing still. Deeper is slower going and softer landings.",
  /** The date row's reading: a day of a month (0 = January). */
  date: (day: number, month: number): string =>
    `${day} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month]}`,
  /** The snow row's reading: the rest sink it asks for. */
  snowRead: (metres: number): string => `${Math.round(metres * 100)} CM`,
  startGrid: "FROM THE GRID",
  startCaption: "Tap the chart to start anywhere on the map · the arrows are kickers",
  seedReading: "SHAPING THE MAP…",
  seedRefused: "NO MAP ON THIS SEED",
  /** The line under the chart. */
  seedRead: (loop: number, kickers: number): string =>
    `${(loop / 1000).toFixed(1)} KM LOOP · ${kickers} KICKERS`,
  seedChart: (seed: number, kickers: number): string =>
    `The map on seed ${seed}, with ${kickers} kickers`,

  /* ── OPTIONS (menu-options.tsx) and its rows (menu-knobs.tsx) ──────── */
  optCaption: "Point at a row to read what it does",
  optRestore: "RESTORE DEFAULTS",
  optOff: "OFF",
  optOn: "ON",
  optLow: "LOW",
  optMedium: "MEDIUM",
  optHigh: "HIGH",
  optShadowSleds: "SLEDS",
  optCustom: "CUSTOM",
  optUnset: "—",
  optPrev: "previous",
  optNext: "next",
  optLess: "less",
  optMore: "more",
  percent: (share: number): string => `${Math.round(share * 100)}%`,
  times: (factor: number): string => `×${factor.toFixed(1)}`,

  optControlsGroup: "CONTROLS",
  optKeys: "KEYS",
  optKeysHint: "Put any action on any key.",
  optKeysCount: (n: number): string => `${n} ACTIONS`,
  optLever: "LEVER SIDE",
  optLeverHint:
    "Which thumb the throttle lever is under on a touchscreen; the handlebar takes the other.",
  optLeverRight: "RIGHT",
  optLeverLeft: "LEFT",
  optSensitivity: "TRAVEL",
  optSensitivityHint:
    "How far a thumb travels for full lock and full throttle. Higher is a shorter throw.",
  optInvertLean: "INVERT LEAN",
  optInvertLeanHint:
    "Off: pull the touch handlebar toward you to lean back. On: push it away to lean back.",

  optAssistGroup: "ASSIST",
  optAssistSteer: "STEER HOLD",
  optAssistSteerHint:
    "Holds the nose on the line the skis ask for and catches a slide. Off is the bare machine.",
  optAssistAir: "AIR LEVEL",
  optAssistAirHint:
    "The rider's body keeps the sled level side to side in the air. Off, a jump taken leaning lands leaning.",
  assistOff: "OFF",
  assistHalf: "HALF",
  assistFull: "FULL",
  optAssistNote: "Applies from the next race.",
  optDamage: "DAMAGE",
  optDamageHint:
    "On: a trunk or a hard landing bends a ski or hurts the suspension, and the sled rides it for the rest of the race.",

  optSoundGroup: "SOUND",
  optSound: "SOUND",
  optSoundHint: "Every sound the game makes, on or off. The same switch as on the front door.",
  optMaster: "MASTER",
  optMasterHint: "Everything, under the three rows below it.",
  optEngine: "ENGINE",
  optEngineHint: "The machine's own voice: the engine and the belt.",
  optEffects: "EFFECTS",
  optEffectsHint: "The snow, the wind, every landing, every checkpoint and every tree.",
  optSoundOff: "OFF",

  optPicture: "PICTURE",
  optPreset: "PRESET",
  optPresetHint:
    "Every row below at once. CUSTOM means a row has been moved off the preset it was on.",
  optResolution: "RESOLUTION",
  optResolutionHint: "How many pixels are drawn, as a share of the screen's own.",
  optDistance: "DISTANCE",
  optDistanceHint:
    "How far out the woods are drawn as trees. Shorter is cheaper, and a hazier day hides the edge.",
  optTerrain: "TERRAIN",
  optTerrainHint: "How fine the ground's mesh is under the sled. Every setting reaches the rim.",
  optTrails: "TRAILS",
  optTrailsHint:
    "How finely the snow keeps every furrow ridden, and how far round the sled. Off leaves the snow untouched.",
  optForest: "FOREST",
  optForestHint: "How far out trees are drawn in full, and how thick the far woods stand.",
  optShadows: "SHADOWS",
  optShadowsHint:
    "The sun's shadows: SLEDS casts the machines and their riders alone; MEDIUM adds every tree's; HIGH draws every rider's shadow sharp in a map of his own.",
  optSpray: "SPRAY",
  optSprayHint: "How much snow the sleds throw.",
  optAntialias: "SMOOTH EDGES",
  optAntialiasHint: "Antialiasing. Takes effect the next time the game is opened.",

  /* ── OPTIONS ▸ KEYS (menu-keys.tsx) ────────────────────────────────── */
  keysTitle: "KEYS",
  keysCaption: "Press a row, then the key to put on it. Escape leaves it as it was.",
  keysRestore: "RESET KEYS",
  keysPrompt: "PRESS A KEY…",
  keysUnbound: "NONE",
  keysClash: "ALSO",
  keysRowHint: (action: string): string => `Press, then the key for ${action.toLowerCase()}.`,
  keysClashHint: (action: string, others: string): string =>
    `The key on ${action.toLowerCase()} also does ${others.toLowerCase()} — pressing it does both.`,
  keyThrottle: "THROTTLE",
  keyBrake: "BRAKE",
  keyLeft: "STEER LEFT",
  keyRight: "STEER RIGHT",
  keyLeanBack: "LEAN BACK",
  keyLeanForward: "LEAN FORWARD",
  keyReset: "RESET",
  keyRestart: "RESTART RACE",
  keyCamera: "NEXT CAMERA",
  keyPause: "PAUSE",

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
  /** ...over a free ride, where there is no lap to count. */
  pauseSubFree: (seed: number): string => `SEED ${seed} · FREE RIDE`,
  pauseResume: "RESUME",
  pauseRestart: "RESTART RACE",
  pauseRestartFree: "START AGAIN",
  pauseOptions: "OPTIONS",
  pauseMainMenu: "MAIN MENU",
  /** The card BEHIND the pause card's own options panel, named on the way
   * back to it. */
  pauseBack: "PAUSED",
  /** The options panel's line while no row is being looked at. */
  pauseOptionsCaption:
    "What the frame in front of you looks and sounds like. The rest is on the front door.",
  /** THE CAPTION ON THE HELD RACE'S RECORD CELL (`pause-stats.ts`); the
   * other cells wear the HUD's own captions. */
  pauseRecord: "RECORD",
  /** THE CAMERA ROW on the pause card's panel, and a word per rung
   * (`RUN_CAMERAS`). */
  optCameraGroup: "CAMERA",
  optCamera: "VIEW",
  optCameraHint: "Where the eye rides — the same ladder the C key walks.",
  cameraWords: {
    hood: "HOOD",
    bars: "BARS",
    chase: "CHASE",
    far: "FAR",
    high: "HIGH",
  },

  /* ── THE TIME TRIAL AND THE RECORD BOOK (menu-main.tsx, hud.tsx,
        hud-result.tsx) ─────────────────────────────────────────────────── */
  menuTrial: "TIME TRIAL",
  menuTrialLine: (seed: number, laps: number): string =>
    `SEED ${seed} · ${laps} ${laps === 1 ? "LAP" : "LAPS"} · ALONE`,
  /** The row standing for this map, sled and length, on the tile. */
  menuTrialBest: (seconds: number, sled: string): string =>
    `BEST ${formatTime(seconds)} · ${sled.toUpperCase()}`,
  menuTrialNoBest: "NO TIME SET YET",
  /** The chip that walks the trial's length. */
  /** The gap to the record at a crossing: `-0.42` ahead, `+1.30` behind. */
  gap: (seconds: number): string => `${seconds < 0 ? "−" : "+"}${Math.abs(seconds).toFixed(2)}`,
  gapLabel: "VS BEST",
  resultTrialTitle: "TIME TRIAL",
  resultRecord: "NEW RECORD",
  /** The row that stood, with its sled and the day it was set. */
  resultBest: (seconds: number, sled: string, at: number): string =>
    `BEST ${formatTime(seconds)} · ${sled.toUpperCase()}${
      at > 0 ? ` · ${new Date(at).toISOString().slice(0, 10)}` : ""
    }`,
  resultOff: (seconds: number): string => `+${seconds.toFixed(2)} OFF THE RECORD`,
  resultTrialAgain: "RIDE AGAIN",
  /** The news line at the flag of a run with nobody else on it. */
  newsFinishAlone: (seconds: number): string => `FINISH  ${formatTime(seconds)}`,

  /* ── THE REPLAY (hud-replay.tsx, hud-result.tsx, menu-pause.tsx) ─────── */
  replayWatch: "WATCH REPLAY",
  /** Under the pause card's row: taken mid-race, the race is over. */
  replayWatchNote: "ends this race",
  replayLabel: "REPLAY",
  /** Said while the picture runs slow, so it is not read as dropped frames. */
  replaySlow: "SLOW",
  replayTitle: (seed: number, mode: string): string =>
    `SEED ${seed} · ${mode === "timeTrial" ? "TIME TRIAL" : "RACE"}`,
  replayLine: (sled: string, time: number | null, place: number | null): string =>
    `${sled.toUpperCase()} · ${
      time === null
        ? "UNFINISHED"
        : place === null
          ? formatTime(time)
          : `${ordinal(place)} · ${formatTime(time)}`
    }`,
  /** The rung the recording is watched from. */
  replayCamera: (rung: string): string => (rung === "tv" ? "BROADCAST" : rung.toUpperCase()),
  replayExit: "EXIT",
  replayNote: "C for the camera · ESC to leave",

  /* ── THE CAMPAIGN (strings-campaign.ts, spread in) ─────────────────── */
  ...CAMPAIGN_STRINGS,
} as const;
