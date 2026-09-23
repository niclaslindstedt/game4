// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: the shell the game lives inside, and the §37 clock underneath it.
//
// FIVE SURFACES, ONE CANVAS, AND THE SNOW NEVER STOPS — except under the
// card standing over the PLAYER's own race. `game/shell.ts` names the
// surfaces and owns that distinction; this file decides when one gives way
// to the next.
//
//   splash   the attract card (`splash-screen.tsx`) — the house's name while
//            the first map is built, then the title and an invitation.
//   menu     the front door (`menu-main.tsx`), over a bot-ridden race — and
//            its pages: the SLED card RACE opens (`menu-sled.tsx`), the last
//            card before the grid; the FREE RIDE's start card before it
//            (`menu-start.tsx`); OPTIONS (`menu-options.tsx`) and OPTIONS ▸
//            KEYS (`menu-keys.tsx`). All the same surface: the race behind
//            them is the one the picture rows are judged against.
//   loading  a race being stood up (`loading-screen.tsx` over `app-load.ts`),
//            paid for in slices so the page stays a page.
//   pause    the race HELD (`menu-pause.tsx`), reached by Escape or the
//            HUD's pause mark: RESUME, SOUND, RESTART, or out to the door.
//   run      the player's hands on the bars, with the HUD over the top —
//            and the finish plate over that once the flag has fallen.
//
// ONE ENGINE STATE THROUGHOUT, and the surface decides who rides it:
// `botInput` under a card, the input manager under a run. Leaving a race
// for the front door hands the same sled back to the bot rather than
// tearing anything down, which is why the menu comes up over the map the
// player was just on. Under a card the camera is the slow ORBIT round the
// sled; over a run it is the rung the rider chose (`cameraFor`).
//
// THE RECORD BOOK AND THE GHOST (`ghost-run.ts`): every run the player
// rides is armed with a ticket — its seed, sled, mode and length — before
// its first step; every input the engine is handed passes `snapInput` on
// the way in, so what the book's tape writes down is what was ridden; and
// a TIME TRIAL is ridden beside the ghost of the best run on that ticket.
// The bot's race under a card is armed with nothing.
//
// THE REPLAY (`replay-run.ts`): the same runs are recorded as the controls
// that rode them, and WATCH REPLAY on the finish plate or the pause card
// rebuilds the race and steps it off the tape under the `replay` surface —
// on the broadcast camera, in slow motion where the director says so.
//
// THE URL: every parameter the app reads is listed in `game/url-params.ts`.
// A URL that names a race (`start`, `shot`, `paused`) boots into one;
// anything else opens on the attract card or the front door.
//
// THE LOOP: `requestAnimationFrame` hands the clock (run-loop.ts) the wall
// time; the clock says how many fixed steps to take; each step samples the
// input (§37.1, once per step) and calls `step`. The renderer draws the
// state once per frame; the HUD is refreshed from a snapshot at ~12 Hz. A
// hidden tab pauses the clock (§37.3) and the HUD says so.
//
// THE RENDERER IS FETCHED, NOT BUNDLED: `game/renderer.ts` is the one import
// that reaches three.js, so it arrives as its own chunk behind the attract
// card, and everything this file asks of it is `renderer-api.ts`'s — it
// draws a `GameState` and never writes one.
//
// THE SOUND AND THE MOTOR FOLLOW THE SAME RULE AS THE SNOW: fed every frame
// the engine steps — the beds ducked under a card, where the bot's race is
// scenery — and told to be quiet on every frame it does not, because a bed
// that is merely not fed holds its last note. The race's events make a
// noise and a pulse only with the player's hands on the bars: a checkpoint
// the bot takes under the menu is not news.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  TUNING,
  botInput,
  createGame,
  error,
  sledById,
  step,
  type CreateGameOptions,
  type GameMode,
  type GameState,
  type Level,
  type SkyOverride,
  type SledSpec,
} from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { onShellCommand } from "./shell-host.ts";
import { createRunAudio, setAudioVolumes, unlockAudio } from "./game/audio/index.ts";
import { createLoader } from "./game/app-load.ts";
import { freeGameOptions } from "./game/free-ride.ts";
import { snapInput } from "./game/ghost.ts";
import { createRunBook, type RunBook, type RunTicket } from "./game/ghost-run.ts";
import { keepsRecords } from "./game/records.ts";
import { runRumble } from "./game/haptics.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { ResultPlate } from "./game/hud-result.tsx";
import { ReplayBar } from "./game/hud-replay.tsx";
import { createReplayRun, type ReplayBarFacts } from "./game/replay-run.ts";
import { prepareMinimap } from "./game/minimap.tsx";
import { createInputManager, type InputManager } from "./game/input.ts";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { KeysPage } from "./game/menu-keys.tsx";
import { MainMenu } from "./game/menu-main.tsx";
import { createMenuNav, walkCardsOnKeys } from "./game/menu-nav.ts";
import { OptionsPage } from "./game/menu-options.tsx";
import { SledPage } from "./game/menu-sled.tsx";
import { StartPage } from "./game/menu-start.tsx";
import { PauseMenu } from "./game/menu-pause.tsx";
import type { WorldRenderer } from "./game/renderer-api.ts";
import { createRunActions } from "./game/run-actions.ts";
import type { LoadPhase } from "./game/run-loader.ts";
import { createRunClock } from "./game/run-loop.ts";
import { newsFor } from "./game/run-news.ts";
import {
  assistOf,
  loadSettings,
  mixOf,
  nextCamera,
  nextTrialLaps,
  saveSettings,
  type Settings,
} from "./game/settings.ts";
import { keysLine } from "./game/settings-input.ts";
import { withPreset, type VideoSettings } from "./game/settings-video.ts";
import {
  cameraFor,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  watching,
  type Shell,
} from "./game/shell.ts";
import { SplashScreen } from "./game/splash-screen.tsx";
import { splashSkipped } from "./game/splash.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { dealSeed, readParams, type MenuPage } from "./game/url-params.ts";
import { applyVerdict, createVideoProbe } from "./game/video-probe.ts";
import { UpdateButton } from "./game/update-button.tsx";
import { clamp } from "./lib/util.ts";

/** How often the HUD's readouts are refreshed, s. */
const HUD_TICK = 1 / 12;
/** How long a line stays in the news column, s. */
const FLASH_LIFE = 3.2;
/** How long the loading card takes to fade off the race underneath. Must
 * match the `.loading.leaving` transition in styles.css. */
const LOAD_FADE_MS = 260;
/** How much of the mix the bot's race gets under a card. */
const CARD_DUCK = 0.5;

declare global {
  interface Window {
    __SH_READY__?: boolean;
    /** A LAB'S WINDOW ON THE RUN: what the HUD reads, where the player's
     * sled is and which way it points, the shell, the rung, and a tally of
     * every event the player's run has raised — so a script driving the
     * built app can check a key did what it says without reading pixels.
     * Read-only; nothing in the app calls it. */
    __SH_PROBE__?: () => Record<string, unknown>;
  }
}

/** The presses the cards make, boxed so a card re-rendering is never a
 * reason to rebuild the loop that owns the race. */
type Presses = {
  race: (seed: number, mode: GameMode) => void;
  free: (options: CreateGameOptions) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  abandonLoad: () => void;
  camera: () => void;
  watch: () => void;
};

const NO_PRESSES: Presses = {
  race: () => {},
  free: () => {},
  restart: () => {},
  pause: () => {},
  resume: () => {},
  toMenu: () => {},
  abandonLoad: () => {},
  camera: () => {},
  watch: () => {},
};

/** A whole race on `seed` — or, where the generator refuses it, the map the
 * game falls back on, so the page ALWAYS mounts over something. `rider` is
 * the player's help and machine for a race a link boots into; the race under
 * the front door is the bot's, on the default machine with every hand on. */
function raceOrFallback(
  seed: number,
  rider: { assist: Settings["assist"]; spec: SledSpec; mode: GameMode; laps: number } | null,
  sky?: SkyOverride,
): GameState {
  const help = {
    ...(rider
      ? {
          assist: assistOf(rider.assist),
          spec: rider.spec,
          mode: rider.mode,
          laps: rider.mode === "timeTrial" ? rider.laps : undefined,
        }
      : {}),
    sky,
  };
  try {
    return createGame({ seed, ...help });
  } catch (e) {
    error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
    return createGame({ seed: 1, ...help });
  }
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params] = useState(() => readParams(location.search));
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  /** The TAB is away and the clock with it (§37.3) — not the pause card. */
  const [away, setAway] = useState(false);
  const [shell, setShell] = useState<Shell>(() =>
    params.rides
      ? params.paused
        ? "pause"
        : "run"
      : splashSkipped(location.search)
        ? "menu"
        : "splash",
  );
  const [loadingPhase, setLoadingPhase] = useState<LoadPhase | null>(null);
  const [loadLeaving, setLoadLeaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  /** True once the renderer has drawn a frame — what the attract card waits
   * on before it will take a press (`splash.ts`). */
  const [warm, setWarm] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    return params.camera ? { ...s, camera: params.camera } : s;
  });
  /** Which page of the front door is up. */
  const [page, setPage] = useState<MenuPage>(params.page);
  /** A link's machine for this visit (`?sled=`), never written back — until
   * the rider picks one on the sled card, which is theirs to keep. */
  const [linkSled, setLinkSled] = useState(params.sled);
  const linkSledRef = useRef(linkSled);
  linkSledRef.current = linkSled;
  /** The machine the player rides. */
  const specOf = (s: Settings): SledSpec => sledById(linkSledRef.current ?? s.sled);
  /** The picture drawn: the stored one, or a lab's preset for this visit —
   * `?video=` is never written back. */
  const videoOf = (s: Settings): VideoSettings =>
    params.video ? withPreset(s.video, params.video) : s.video;
  /** THE SEED RACE WILL BUILD, shown on the tile. Pinned by `?seed=`,
   * otherwise dealt fresh after every race stood up. */
  const [nextSeed, setNextSeed] = useState(() => params.seed ?? dealSeed());
  const [laps, setLaps] = useState(3);
  const [riders, setRiders] = useState(4);
  /** THE MAP THE MENU IS STANDING OVER — what the TIME TRIAL tile rides. */
  const [mapSeed, setMapSeed] = useState(nextSeed);
  /** The mode the sled card's RIDE is for: whichever tile opened it. */
  // (A link to the start card is a free ride on its way to the sled card.)
  const modeRef = useRef<GameMode>(params.page === "start" ? "free" : params.mode);
  const bookRef = useRef<RunBook | null>(null);
  const [input, setInput] = useState<InputManager | null>(null);
  /** The bar over a recording, and whether there is one worth offering —
   * both refreshed on the HUD's tick, never per frame. */
  const [replayBar, setReplayBar] = useState<ReplayBarFacts | null>(null);
  const [canReplay, setCanReplay] = useState(false);
  const [touch] = useState(hasTouch);
  const [keys] = useState(
    () => typeof matchMedia === "undefined" || matchMedia("(pointer: fine)").matches,
  );

  const shellRef = useRef<Shell>(shell);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const nextSeedRef = useRef(nextSeed);
  nextSeedRef.current = nextSeed;
  const pressRef = useRef<Presses>(NO_PRESSES);
  /** The two flags the loop raises at most once a frame, as refs beside the
   * state, so the loop can ask "have I already said this?" without waiting
   * for a render to answer. */
  const warmRef = useRef(false);
  const awayRef = useRef(false);
  const rendererRef = useRef<WorldRenderer | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  // The switch reaches the bus the moment it moves; a layer reads the bus
  // every frame, so the engine under the card goes quiet with the press.
  const mix = mixOf(settings);
  useEffect(
    () => setAudioVolumes({ engine: mix.engine, effects: mix.effects }),
    [mix.engine, mix.effects],
  );
  // The keys and the picture reach the manager and the renderer the same
  // way: the moment they are pressed, over the live race.
  useEffect(() => input?.setBindings(settings.keys), [input, settings.keys]);

  // THE RENDER STACK, FETCHED RATHER THAN BUNDLED (see the header).
  const [renderKit, setRenderKit] = useState<typeof import("./game/renderer.ts") | null>(null);
  useEffect(() => {
    let live = true;
    void import("./game/renderer.ts").then((mod) => {
      if (live) setRenderKit(mod);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderKit) return;
    connectOutput();
    const manager = createInputManager(
      window,
      () => playerRides(shellRef.current),
      settingsRef.current.keys,
    );
    setInput(manager);
    const renderer = renderKit.createWorldRenderer(canvas, { video: videoOf(settingsRef.current) });
    rendererRef.current = renderer;
    const book = createRunBook({ show: (ghost) => renderer.setGhost(ghost) });
    bookRef.current = book;
    const replays = createReplayRun({
      renderer,
      adopt: (s) => adopt(s),
      shell: () => shellRef.current,
    });
    const audio = createRunAudio();
    const clock = createRunClock(TUNING.physicsHz);
    const nav = createMenuNav();

    /* ── WHICH MAP THE RENDERER HOLDS ───────────────────────────────────
       A map is built into the renderer asynchronously, and until it has
       been the renderer cannot draw a race on it — nor may that race be
       stepped, or its lights would count down under a card the player
       cannot see through. So every build goes through `build`, which
       remembers which level is standing; `drawable` is the one question the
       loop asks before it steps or draws. */
    let standing: Level | null = null;
    let wanted: Level | null = null;
    const build = (s: GameState): Promise<void> => {
      const level = s.level;
      // A new race on the map already standing needs nothing built: the
      // renderer sees a fresh state and starts its trails and spray clean.
      if (standing === level) return Promise.resolve();
      wanted = level;
      standing = null;
      prepareMinimap(level);
      return renderer.load(s).then(() => {
        if (wanted === level) standing = level;
      });
    };
    const view: WorldRenderer = {
      load: build,
      draw: (s, alpha, dt) => renderer.draw(s, alpha, dt),
      setCamera: (rung) => renderer.setCamera(rung),
      camera: () => renderer.camera(),
      resize: (w, h, r) => renderer.resize(w, h, r),
      setVideo: (v) => renderer.setVideo(v),
      setGhost: (g) => renderer.setGhost(g),
      setShot: (shot) => renderer.setShot(shot),
      drain: () => renderer.drain(),
      dispose: () => renderer.dispose(),
    };

    const raceSeed = params.seed ?? nextSeedRef.current;
    /** The options the free ride on the pause card's START AGAIN rides:
     * the last one stood up, on the map it was stood up on. */
    let freeAgain: CreateGameOptions | null = null;
    /** A free ride off the start card's answers — or, where the seed will
     * not build, the race fallback's map. */
    const freeBoot = (): GameState => {
      const s = settingsRef.current;
      const seed = params.seed ?? s.ride.seed ?? raceSeed;
      const ride = freeGameOptions(s.ride, seed, specOf(s), assistOf(s.assist));
      // A link's sky (`?weather=` / `?hour=`) over the card's, as on a race.
      const opts = params.sky ? { ...ride, sky: { ...ride.sky, ...params.sky } } : ride;
      try {
        const game = createGame(opts);
        freeAgain = { ...opts, level: game.level };
        return game;
      } catch (e) {
        error(`seed ${seed} would not build (${e instanceof Error ? e.message : String(e)})`);
        return raceOrFallback(1, {
          assist: s.assist,
          spec: specOf(s),
          mode: "race",
          laps: s.trialLaps,
        });
      }
    };
    // A race a link boots into is the player's, with the player's help; the
    // one under the front door is the bot's, with every hand on.
    let state: GameState = params.free
      ? freeBoot()
      : raceOrFallback(
          raceSeed,
          params.rides
            ? {
                assist: settingsRef.current.assist,
                spec: specOf(settingsRef.current),
                mode: params.mode,
                laps: settingsRef.current.trialLaps,
              }
            : null,
          params.sky ?? undefined,
        );
    /** The mode the player's runs are ridden in, until a tile says otherwise. */
    let mode: GameMode = params.mode;
    /** The run the player is about to ride, in `mode`, on the machine they
     * picked and with the help they asked for — on this map, or a fresh one. */
    const playerGame = (level: Level | undefined, seed: number): GameState =>
      createGame({
        level,
        seed,
        sky: params.sky ?? undefined,
        mode,
        laps: mode === "timeTrial" ? settingsRef.current.trialLaps : undefined,
        spec: specOf(settingsRef.current),
        assist: assistOf(settingsRef.current.assist),
        damage: settingsRef.current.damage,
      });
    /** What a player's run is filed under — nothing for a run the bot rides
     * from the line (`?bot=1`), which is nobody's time, and nothing for a
     * mode that keeps no book (a free ride, `keepsRecords`). */
    const ticketFor = (s: GameState): RunTicket | null =>
      params.bot || !keepsRecords(mode)
        ? null
        : {
            key: { seed: s.seed, sled: s.sled.spec.id, mode, laps: s.rules.laps },
            assist: { ...s.assist },
          };
    const drawable = (): boolean => standing !== null && standing === state.level;
    let frozen = params.shot;
    let preroll = false;
    let ready = false;
    const live: { id: number; text: string; tone: HudFlash["tone"]; until: number }[] = [];
    let flashId = 0;
    /** Every event the player's run has raised, by kind (`__SH_PROBE__`). */
    const tally: Record<string, number> = {};
    let hudClock = HUD_TICK;
    let wall = 0;

    const setShellNow = (next: Shell): void => {
      shellRef.current = next;
      setShell(next);
      renderer.setCamera(cameraFor(next, settingsRef.current.camera));
    };

    /** A new race has taken over the engine: everything that belonged to
     * the one before it goes with it. */
    const adopt = (next: GameState, ticket: RunTicket | null = null): void => {
      state = next;
      book.arm(next, ticket);
      replays.arm(next, ticket ? mode : null);
      setMapSeed(next.seed);
      live.length = 0;
      for (const k of Object.keys(tally)) delete tally[k];
      audio.reset();
      runRumble.reset();
      // The RACE tile's line reads a race's numbers, never a trial's.
      if (next.rules.rivals > 0) {
        setLaps(next.rules.laps);
        setRiders(next.rivals.length + 1);
      }
    };

    /** What this step is ridden on: the player's hands on a run, and the BOT
     * everywhere else — the race behind a card is still being raced — and
     * through a link's pre-roll, so a picture of a race is of one moving. */
    const inputFor = () =>
      preroll || params.bot || !playerRides(shellRef.current)
        ? botInput(state)
        : manager.sample(TUNING.dt);

    // The minimap's payload is left off: it carries the level itself, which
    // a lab would be handed across the page boundary whole.
    window.__SH_PROBE__ = () => ({
      ...takeSnapshot(state, book.ledger()),
      ghost: book.ghost() !== null,
      minimap: undefined,
      phase: state.phase,
      t: state.t,
      x: state.sled.x,
      z: state.sled.z,
      heading: state.sled.heading,
      sled: state.sled.spec.id,
      input: { ...state.input },
      shell: shellRef.current,
      camera: renderer.camera(),
      replay: replays.bar()?.rung ?? null,
      events: { ...tally },
    });

    const stepOnce = (): void => {
      // ON THE TAPE'S GRID whoever is riding (`ghost.ts`), and written down.
      const input = snapInput(replays.input() ?? inputFor());
      step(state, input);
      book.step(input, state.events);
      replays.step(input, state);
      for (const e of state.events) tally[e.kind] = (tally[e.kind] ?? 0) + 1;
      if (preroll) return;
      const rides = playerRides(shellRef.current);
      if (soundsLive(shellRef.current)) audio.events(state.events);
      if (rides) {
        runRumble.events(state.events);
        runRumble.step(state.sled);
      }
      if (rides || watching(shellRef.current)) {
        for (const e of state.events) {
          const line = newsFor(e, state);
          if (line) live.push({ id: flashId++, ...line, until: wall + FLASH_LIFE });
        }
      }
    };

    // THE FIRST RACE: the map the menu stands over (and RACE rides, unless
    // the player waits for another), or the race a link names — already
    // `t` seconds in, ridden by the bot.
    // A link's race is the player's, and filed — unless the bot pre-rides it.
    adopt(state, params.rides && params.t === 0 ? ticketFor(state) : null);
    if (params.rides && params.t > 0) {
      preroll = true;
      const steps = Math.round(params.t * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) stepOnce();
      preroll = false;
    }
    renderer.setCamera(cameraFor(shellRef.current, settingsRef.current.camera));
    build(state).catch((e: unknown) =>
      error(`the renderer could not build the map: ${e instanceof Error ? e.message : String(e)}`),
    );

    /* ── STANDING A RACE UP ────────────────────────────────────────────── */
    const loader = createLoader(
      { renderer: view, adopt: (s) => adopt(s, ticketFor(s)), current: () => state },
      {
        phase: setLoadingPhase,
        start: () => {
          setLoadLeaving(false);
          setShellNow("loading");
        },
        failed: setLoadFailed,
      },
    );

    const lift = (): void => {
      setLoadLeaving(true);
      setShellNow("run");
      clock.resume();
      hudClock = HUD_TICK;
      window.setTimeout(() => setLoadLeaving(false), LOAD_FADE_MS);
    };

    /** The race again from the grid, on the same map: nothing to generate
     * and nothing to build — the renderer sees a fresh state and starts its
     * trails and its spray clean — so no card, just the lights again. */
    const restart = (): void => {
      if (loader.busy()) return;
      // A free ride starts again from where it was stood up; every other
      // run from the grid, on the same map, in its mode.
      const next =
        !state.rules.course && freeAgain
          ? createGame(freeAgain)
          : playerGame(state.level, state.seed);
      adopt(next, ticketFor(next));
      frozen = false;
      clock.resume();
      setShellNow("run");
      hudClock = HUD_TICK;
    };

    pressRef.current = {
      race: (seed, asked) => {
        mode = asked;
        loader.begin({
          // THE MAP UNDER THE MENU IS REUSED when it is the one asked for —
          // the race the player presses RACE over is the race they ride.
          // (Never a free ride's: that one is the seed's map on another day.)
          build: () =>
            playerGame(
              state.level.seed === seed && state.rules.course ? state.level : undefined,
              seed,
            ),
          camera: settingsRef.current.camera,
          done: lift,
        });
      },
      free: (options) => {
        mode = "free";
        loader.begin({
          build: () => {
            const reuse =
              state.level.seed === options.seed && state.rules.course ? state.level : undefined;
            const game = createGame({ ...options, level: reuse });
            freeAgain = { ...options, level: game.level };
            return game;
          },
          camera: settingsRef.current.camera,
          done: lift,
        });
      },
      restart,
      pause: () => {
        if (canPause(shellRef.current)) setShellNow("pause");
        else if (watching(shellRef.current)) pressRef.current.toMenu();
      },
      watch: () => {
        if (loader.busy() || !replays.watch()) return;
        frozen = false;
        clock.resume();
        setShellNow("replay");
        hudClock = HUD_TICK;
      },
      resume: () => {
        if (shellRef.current === "pause") setShellNow("run");
      },
      toMenu: () => {
        // The run goes back to the bot: nothing more is filed or recorded.
        book.clear();
        replays.clear();
        setPage("root");
        frozen = false;
        clock.resume();
        setShellNow("menu");
      },
      abandonLoad: () => {
        loader.abandon();
        setShellNow("menu");
      },
      camera: () => {
        if (watching(shellRef.current)) return replays.camera();
        const next = nextCamera(settingsRef.current.camera);
        setSettings((s) => ({ ...s, camera: next }));
        if (hudOver(shellRef.current)) renderer.setCamera(next);
      },
    };

    /** One of the game's own buttons, wherever the press came from. */
    const act = createRunActions({
      shell: () => shellRef.current,
      pause: () => pressRef.current.pause(),
      resume: () => pressRef.current.resume(),
      restart,
      camera: () => pressRef.current.camera(),
      reset: () => manager.requestReset(),
      leave: () => pressRef.current.toMenu(),
    });
    manager.onAction(act);
    // A MENU ROW, PRESSED: the desktop shell's menu bar reaches the game by
    // NAME (shell-host.ts), and every word lands on the handler its key does.
    const stopShellCommands = onShellCommand(act);

    // Walking a card on the keys is `menu-nav.ts`'s.
    const walk = walkCardsOnKeys(nav, () => shellRef.current !== "run");

    // THE FIRST-VISIT PROBE (`video-probe.ts`): times the design point under
    // the front door, once, and moves an untouched picture to the tier this
    // machine can hold. Never over a race, a link's preset or a lab's
    // `?probe=0`, and never twice.
    let probe =
      params.probe && !params.rides && !params.video && !settingsRef.current.probed
        ? createVideoProbe()
        : null;

    let raf = 0;
    let last = performance.now();
    let frameMs = 1000 / 60;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      // CLAMPED AT BOTH ENDS: the ceiling is the long-frame guard, and the
      // floor is the first callback after a build, whose timestamp lands
      // BEHIND the clock read after it.
      const dtFrame = clamp((now - last) / 1000, 0, 0.1);
      frameMs = now - last || frameMs;
      last = now;
      wall += dtFrame;

      // A LOAD IS PAID FOR BEFORE THE STEPS, and the steps still happen.
      loader.frame(frameMs);
      if (walk.walked()) nav.sync();

      // THE BACKDROP RACES ON: a race behind a card that the bot has taken
      // to the flag is stood back up on the same map, so the front door is
      // never over a sled coasting to a stop.
      const backdrop = !playerRides(shellRef.current) && !watching(shellRef.current);
      if (backdrop && shellRef.current !== "pause" && !loader.busy()) {
        if (state.progress.finished) {
          book.clear();
          adopt(createGame({ level: state.level, seed: state.seed }));
        }
      }

      const held = !simulates(shellRef.current);
      const shown = drawable();
      // SLOW MOTION is fewer steps per frame and nothing else (`replay-shots.ts`).
      const rate = replays.frame();
      const dtRun = dtFrame * rate;
      if (!frozen && !held && shown) {
        const steps = clock.frame(dtRun);
        for (let i = 0; i < steps; i++) stepOnce();
        if (replays.over()) pressRef.current.toMenu();
      } else {
        // Held: the controls are still read, so a banked reset does not
        // fire the moment the picture thaws.
        manager.sample(TUNING.dt);
      }
      if (!shown) return;
      const still = frozen || held || clock.paused();
      const timing = probe !== null && !playerRides(shellRef.current) && !loader.busy() && !still;
      const drawAt = performance.now();
      renderer.draw(state, clock.alpha(), still ? 0 : dtRun);
      if (timing && probe) {
        const verdict = probe.frame(frameMs, performance.now() - drawAt + renderer.drain());
        if (verdict !== null) {
          probe = null;
          setSettings((s) => ({ ...s, probed: true, video: applyVerdict(s.video, verdict) }));
        }
      }
      if (!still) {
        audio.setView(renderer.camera());
        audio.frame(state, dtRun, soundsLive(shellRef.current) ? 1 : CARD_DUCK);
        if (playerRides(shellRef.current)) runRumble.frame(dtFrame);
      } else {
        audio.silence();
      }
      if (!warmRef.current) {
        warmRef.current = true;
        setWarm(true);
      }
      // The frame above is presented on the NEXT animation frame; the flag
      // waits for it, and for the race to be up, so a screenshot never
      // captures a card over it.
      if (!ready && hudOver(shellRef.current)) {
        ready = true;
        requestAnimationFrame(() => {
          window.__SH_READY__ = true;
        });
      }
      hudClock += dtFrame;
      if (hudClock >= HUD_TICK) {
        hudClock = 0;
        setSnap(takeSnapshot(state, book.ledger()));
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        setReplayBar(replays.bar());
        setCanReplay(replays.offers());
        if (clock.paused() !== awayRef.current) {
          awayRef.current = clock.paused();
          setAway(awayRef.current);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // §37.3: a hidden tab is a paused race.
    const onVisibility = (): void => {
      if (document.hidden) {
        clock.pause();
        audio.silence();
      } else {
        clock.resume();
        last = performance.now();
      }
      awayRef.current = clock.paused();
      setAway(awayRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // A browser makes no sound before the player has touched something, so
    // the unlock hangs off real gestures only — captured, so a card that
    // stops propagation cannot swallow it.
    const unlockOpts = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", unlockAudio, unlockOpts);
    document.addEventListener("keydown", unlockAudio, unlockOpts);
    // The canvas's size is the renderer's own business: it is handed the
    // box it draws into and told again whenever the box changes.
    const fit = (): void => {
      const box = canvas.getBoundingClientRect();
      renderer.resize(box.width, box.height, Math.min(2, devicePixelRatio || 1));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();

    return () => {
      cancelAnimationFrame(raf);
      audio.silence();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", unlockAudio, unlockOpts);
      document.removeEventListener("keydown", unlockAudio, unlockOpts);
      walk.stop();
      stopShellCommands();
      manager.dispose();
      renderer.dispose();
      delete window.__SH_PROBE__;
    };
    // Boots once: the URL is read on mount and `renderKit` is set exactly
    // once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKit]);

  // THE PICTURE reaches the renderer the moment a row is pressed — after the
  // renderer's own effect above, so the first call finds it standing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => rendererRef.current?.setVideo(videoOf(settings)), [renderKit, settings.video]);

  /** THE TIME TRIAL'S MAP: a pinned one, or the one the menu stands over. */
  const trialSeed = params.seed ?? mapSeed;
  /** Onto the snow: in the mode the tile that opened the sled card named, on
   * the seed that tile showed and the machine the sled card holds. */
  const race = (): void => {
    setPage("root");
    const trial = modeRef.current === "timeTrial";
    pressRef.current.race(trial ? trialSeed : nextSeed, modeRef.current);
    // The next race deals the next map, unless a link pinned this one.
    if (!trial && params.seed === null) setNextSeed(dealSeed());
  };
  const trialBest = bookRef.current?.standing({
    seed: trialSeed,
    sled: specOf(settings).id,
    mode: "timeTrial",
    laps: settings.trialLaps,
  });

  /** The map on the start card: the one it stored, or the front door's. */
  const startSeed = settings.ride.seed ?? nextSeed;
  /** Onto the snow on a FREE RIDE: the start card's map, day and snow, on
   * the machine the sled card holds. */
  const freeRide = (): void => {
    setPage("root");
    pressRef.current.free(
      freeGameOptions(settings.ride, startSeed, specOf(settings), assistOf(settings.assist)),
    );
  };

  const hudUp = hudOver(shell) && snap !== null && input !== null;
  return (
    <>
      <canvas ref={canvasRef} />
      {hudUp && (
        <Hud
          snap={snap!}
          flashes={flashes}
          touch={touch && !watching(shell)}
          input={input!}
          feel={settings.touch}
          lever={settings.touch.lever}
          away={away}
          onReset={() => playerRides(shell) && input?.requestReset()}
          onCamera={() => pressRef.current.camera()}
          onPause={() => pressRef.current.pause()}
        />
      )}
      {/* THE NEW-BUILD NOTICE over the front door: a deploy most often lands
          on a tab nobody is racing, and the HUD's own corner is not up. */}
      {shell === "menu" && (
        <div class="hud hud-over-card">
          <div class="hud-right">
            <UpdateButton />
          </div>
        </div>
      )}
      {replayBar && watching(shell) && (
        <ReplayBar
          {...replayBar}
          touch={touch}
          onCamera={() => pressRef.current.camera()}
          onLeave={() => pressRef.current.toMenu()}
        />
      )}
      <ResultPlate
        snap={shell === "run" && !away ? snap : null}
        touch={touch}
        onAgain={() => pressRef.current.restart()}
        onNew={race}
        onMenu={() => pressRef.current.toMenu()}
        onReplay={canReplay ? () => pressRef.current.watch() : null}
      />
      {shell === "pause" && snap !== null && (
        <PauseMenu
          snap={snap}
          sound={settings.sound}
          onResume={() => pressRef.current.resume()}
          onRestart={() => pressRef.current.restart()}
          onSound={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
          onMainMenu={() => pressRef.current.toMenu()}
          onReplay={canReplay ? () => pressRef.current.watch() : null}
        />
      )}
      {shell === "menu" && page === "root" && (
        <MainMenu
          seed={nextSeed}
          pinned={params.seed !== null}
          laps={laps}
          riders={riders}
          sound={settings.sound}
          keys={keys ? keysLine(settings.keys) : null}
          trial={{
            seed: trialSeed,
            laps: settings.trialLaps,
            best: trialBest ? { time: trialBest.value, sled: sledById(trialBest.sled).name } : null,
          }}
          onRace={() => {
            modeRef.current = "race";
            setPage("sled");
          }}
          onTrial={() => {
            modeRef.current = "timeTrial";
            setPage("sled");
          }}
          onFree={() => {
            modeRef.current = "free";
            setPage("start");
          }}
          onTrialLaps={() => setSettings((s) => ({ ...s, trialLaps: nextTrialLaps(s.trialLaps) }))}
          onSound={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
          onOptions={() => setPage("options")}
        />
      )}
      {shell === "menu" && page !== "root" && (
        <div class="menu">
          {page === "sled" ? (
            <SledPage
              sled={specOf(settings).id}
              onPick={(sled) => {
                setLinkSled(null);
                setSettings((s) => ({ ...s, sled }));
              }}
              onBack={() => setPage(modeRef.current === "free" ? "start" : "root")}
              onRide={modeRef.current === "free" ? freeRide : race}
            />
          ) : page === "start" ? (
            <StartPage
              settings={settings}
              seed={startSeed}
              onSettings={setSettings}
              onReroll={() =>
                setSettings((s) => ({ ...s, ride: { ...s.ride, seed: dealSeed(), spot: null } }))
              }
              onBack={() => setPage("root")}
              onNext={() => setPage("sled")}
            />
          ) : page === "options" ? (
            <OptionsPage
              settings={settings}
              keys={keys}
              touch={touch}
              onSettings={setSettings}
              onBack={() => setPage("root")}
              onKeys={() => setPage("keys")}
            />
          ) : (
            <KeysPage
              settings={settings}
              onSettings={setSettings}
              onBack={() => setPage("options")}
            />
          )}
        </div>
      )}
      {(shell === "loading" || loadLeaving) && (
        <LoadingScreen
          leaving={loadLeaving}
          phase={loadingPhase}
          failed={loadFailed}
          onBack={() => pressRef.current.abandonLoad()}
        />
      )}
      {shell === "splash" && (
        <SplashScreen
          warm={warm}
          onDone={() => {
            shellRef.current = "menu";
            setShell("menu");
          }}
        />
      )}
    </>
  );
}
