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
  /** The front door's line of keys, off the bindings the rider has: each
   * part is a key's cap and what it does. */
  menuKeys: (parts: readonly { cap: string; does: string }[]): string =>
    parts.map((p) => `${p.cap} ${p.does}`).join(" · "),
  menuKeyWords: {
    throttle: "throttle",
    brake: "brake",
    steer: "steer",
    lean: "lean",
    reset: "reset",
    camera: "camera",
  },

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

  /* ── OPTIONS (menu-options.tsx) and its rows (menu-knobs.tsx) ──────── */
  optCaption: "Point at a row to read what it does",
  optRestore: "RESTORE DEFAULTS",
  optOff: "OFF",
  optOn: "ON",
  optLow: "LOW",
  optMedium: "MEDIUM",
  optHigh: "HIGH",
  optShadowSleds: "SLEDS",
  optShadowAll: "ALL",
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
    "The sun's shadows: SLEDS casts the machines and their riders alone; ALL adds every tree's.",
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
  pauseResume: "RESUME",
  pauseRestart: "RESTART RACE",
  pauseMainMenu: "MAIN MENU",
} as const;
