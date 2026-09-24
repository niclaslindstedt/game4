// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHELL AROUND A RACE — every rule the cards and the loop stand on that
// can be read without a browser: which surface steps the engine and who
// rides it (`shell.ts`), the §37 clock (`run-loop.ts`), a load cut into
// phases (`run-loader.ts`), the URL (`url-params.ts`), the attract card's
// timing (`splash.ts`), what is remembered (`settings.ts`), the game's own
// buttons (`run-actions.ts`) and the cursor's walk (`menu-cursor.ts`).

import { describe, expect, it } from "vitest";

import { TUNING } from "@engine";

import { pickNeighbour, type NavRect } from "../pwa/src/game/menu-cursor.ts";
import {
  PAUSE_STATS,
  pauseStats,
  type PauseRun,
  type PauseStat,
} from "../pwa/src/game/pause-stats.ts";
import { createRunActions, type RunPress } from "../pwa/src/game/run-actions.ts";
import {
  advanceLoad,
  createLoad,
  loadBudgetMs,
  loadPhase,
  loadTimes,
  type LoadStep,
} from "../pwa/src/game/run-loader.ts";
import { MAX_FRAME_SECONDS, createRunClock } from "../pwa/src/game/run-loop.ts";
import {
  DEFAULT_CAMERA,
  RUN_CAMERAS,
  assistOf,
  freshSettings,
  mergeSettings,
  mixOf,
  nextCamera,
} from "../pwa/src/game/settings.ts";
import {
  DEFAULT_KEYS,
  KEY_ACTIONS,
  bindKey,
  boundLabel,
  clashesWith,
  freshKeys,
  keyLabel,
  mergeKeys,
  type KeyAction,
} from "../pwa/src/game/settings-input.ts";
import { DEFAULT_VIDEO } from "../pwa/src/game/settings-video.ts";
import {
  SHELLS,
  appDraws,
  cameraFor,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  watching,
  type Shell,
} from "../pwa/src/game/shell.ts";
import {
  SPLASH_MIN_MS,
  SPLASH_STUCK_MS,
  splashReady,
  splashSkipped,
} from "../pwa/src/game/splash.ts";
import { dealSeed, readParams } from "../pwa/src/game/url-params.ts";
import { BENCHMARK } from "../pwa/src/game/benchmark-plan.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { SHELL_COMMANDS } from "../pwa/src/shell-host.ts";

describe("the seven surfaces (shell.ts)", () => {
  it("steps the engine behind every card but the pause card — and leaves the bench to its pump", () => {
    for (const s of SHELLS) expect(simulates(s), s).toBe(s !== "pause" && s !== "bench");
    expect(SHELLS.filter((s) => !appDraws(s))).toEqual(["bench"]);
  });

  it("puts the player's hands on the sled only on a run — the bot rides everywhere else", () => {
    for (const s of SHELLS) expect(playerRides(s), s).toBe(s === "run");
    for (const s of SHELLS) expect(soundsLive(s), s).toBe(playerRides(s) || watching(s));
    expect(SHELLS.filter(watching)).toEqual(["replay"]);
  });

  it("keeps the HUD up under the pause card, and reaches the pause card only from a run", () => {
    expect(SHELLS.filter(hudOver)).toEqual(["pause", "run", "replay"]);
    expect(SHELLS.filter(canPause)).toEqual(["run"]);
  });

  it("frames every card with the orbit and a race with the rider's own rung", () => {
    for (const s of SHELLS.filter((s) => s !== "bench")) {
      expect(cameraFor(s, "hood"), s).toBe(hudOver(s) ? "hood" : "orbit");
    }
    // The benchmark states its own view rather than inheriting one.
    expect(cameraFor("bench", "hood")).toBe(BENCHMARK.camera);
  });
});

describe("the §37 clock (run-loop.ts)", () => {
  it("steps whole steps and carries the fraction", () => {
    const clock = createRunClock(TUNING.physicsHz);
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += clock.frame(1 / 60);
    expect(steps).toBe(TUNING.physicsHz);
    expect(clock.alpha()).toBeGreaterThanOrEqual(0);
    expect(clock.alpha()).toBeLessThan(1);
  });

  it("drops a stall rather than paying it down", () => {
    const clock = createRunClock(TUNING.physicsHz);
    const steps = clock.frame(5);
    expect(steps).toBe(Math.floor(MAX_FRAME_SECONDS * TUNING.physicsHz + 1e-9));
    expect(clock.dropped()).toBeCloseTo(5 - MAX_FRAME_SECONDS);
  });

  it("takes no steps while away, and the first frame back is one frame long", () => {
    const clock = createRunClock(TUNING.physicsHz);
    clock.pause();
    expect(clock.frame(1 / 60)).toBe(0);
    clock.resume();
    expect(clock.frame(1 / 60)).toBe(2);
  });
});

describe("a load, cut into phases (run-loader.ts)", () => {
  const step = (id: string, label: string, run: LoadStep["run"], extra = {}): LoadStep => ({
    id,
    label,
    run,
    ...extra,
  });

  it("counts PHASES, not steps, and never reads past the last", () => {
    const job = createLoad([
      step("a", "One", () => false),
      step("b", "One", () => false),
      step("c", "Two", () => false),
    ]);
    expect(loadPhase(job)).toMatchObject({ label: "One", at: 1, of: 2 });
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    // A phase boundary ends the slice, so the card names the phase it pays for.
    expect(loadPhase(job)).toMatchObject({ label: "Two", at: 2, of: 2 });
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(false);
    expect(loadPhase(job).at).toBe(2);
    expect(Object.keys(loadTimes(job)).sort()).toEqual(["a", "b", "c"]);
  });

  it("ends the slice on a step WAITING on a promise rather than spinning on it", () => {
    let runs = 0;
    const job = createLoad([
      step("scene", "Build", () => (++runs, true), { waiting: () => true }),
      step("warm", "Warm", () => false),
    ]);
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    expect(runs).toBe(1);
  });

  it("abandons a step that throws and says why, rather than throwing out of a frame", () => {
    const job = createLoad([
      step("level", "Mountain", () => {
        throw new Error("no loop on this seed");
      }),
      step("scene", "Forest", () => false),
    ]);
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(false);
    expect(job.failed).toBe("no loop on this seed");
    expect(loadTimes(job)).toEqual({});
  });

  it("budgets a share of the frame, bounded both ways", () => {
    expect(loadBudgetMs(16)).toBeGreaterThanOrEqual(12);
    expect(loadBudgetMs(1000)).toBeLessThanOrEqual(250);
    expect(loadBudgetMs(100)).toBeCloseTo(60);
  });
});

describe("the URL (url-params.ts, splash.ts)", () => {
  it("boots a race only when the link names one", () => {
    expect(readParams("").rides).toBe(false);
    expect(readParams("?start=race&seed=42")).toMatchObject({ rides: true, seed: 42 });
    expect(readParams("?start=1").rides).toBe(true);
    expect(readParams("?paused=1")).toMatchObject({ rides: true, paused: true });
    expect(readParams("?shot=1&t=8")).toMatchObject({ rides: true, shot: true, t: 8 });
  });

  it("refuses a seed or a camera this build cannot take", () => {
    expect(readParams("?seed=abc").seed).toBe(null);
    expect(readParams("?seed=-3").seed).toBe(null);
    expect(readParams("?seed=1.5").seed).toBe(null);
    expect(readParams("?camera=far").camera).toBe("far");
    expect(readParams("?camera=orbit").camera).toBe(null);
    expect(readParams("?t=-4").t).toBe(0);
    expect(readParams("?start=race&bot=1").bot).toBe(true);
    expect(readParams("?start=race").bot).toBe(false);
    expect(readParams("?menu=root")).toMatchObject({ menu: true, page: "root" });
    expect(readParams("?menu=options").page).toBe("options");
    expect(readParams("?menu=keys").page).toBe("keys");
    expect(readParams("?menu=gallery").page).toBe("gallery");
    expect(readParams("?menu=cellar").page).toBe("root");
    expect(readParams("?video=low").video).toBe("low");
    expect(readParams("?video=ultra").video).toBe(null);
    expect(readParams("").probe).toBe(true);
    expect(readParams("?probe=0").probe).toBe(false);
  });

  it("deals a seed in the generator's range", () => {
    expect(dealSeed(() => 0)).toBe(1);
    expect(dealSeed(() => 0.999999)).toBeLessThan(100_000);
  });

  it("skips the attract card for a link into a race or the door, and not otherwise", () => {
    expect(splashSkipped("")).toBe(false);
    expect(splashSkipped("?start=race")).toBe(true);
    expect(splashSkipped("?menu=root")).toBe(true);
    expect(splashSkipped("?paused=1")).toBe(true);
    expect(splashSkipped("?start=race&splash=1")).toBe(false);
    expect(splashSkipped("?splash=0")).toBe(true);
  });

  it("waits for the game before inviting a press, and never forever", () => {
    expect(splashReady(SPLASH_MIN_MS - 1, true)).toBe(false);
    expect(splashReady(SPLASH_MIN_MS, true)).toBe(true);
    expect(splashReady(SPLASH_MIN_MS * 3, false)).toBe(false);
    expect(splashReady(SPLASH_STUCK_MS, false)).toBe(true);
  });
});

describe("what the game remembers (settings.ts)", () => {
  it("merges a stored blob field by field and checks every value", () => {
    expect(mergeSettings(null)).toEqual(freshSettings());
    expect(mergeSettings("junk")).toEqual(freshSettings());
    expect(mergeSettings({ camera: "far", sound: false })).toEqual({
      ...freshSettings(),
      camera: "far",
      sound: false,
    });
    // Off the ladder, and the wrong type: back to the defaults.
    expect(mergeSettings({ camera: "orbit", sound: "no" })).toEqual(freshSettings());
    expect(mergeSettings({ camera: "helicopter" }).camera).toBe(DEFAULT_CAMERA);
  });

  it("puts every stored fader, thumb and hand back on its own grid", () => {
    const s = mergeSettings({
      audio: { master: 0.43, engine: 7, effects: "loud" },
      touch: { lever: "left", sensitivity: 1.23, invertLean: true },
      assist: { steer: "off", air: "most" },
      video: { terrain: "high", trails: "sideways" },
      probed: true,
    });
    expect(s.audio).toEqual({ master: 0.4, engine: 1, effects: 1 });
    expect(s.touch).toEqual({ lever: "left", sensitivity: 1.2, invertLean: true });
    expect(s.assist).toEqual({ steer: "off", air: "full" });
    expect(s.video).toEqual({ ...DEFAULT_VIDEO, terrain: "high" });
    expect(s.probed).toBe(true);
    expect(mergeSettings({ touch: { sensitivity: 9 } }).touch.sensitivity).toBe(1.5);
    expect(mergeSettings({ touch: { lever: "up" } }).touch.lever).toBe("right");
  });

  it("fits the picture to the machine unless the rider has made it theirs", () => {
    expect(freshSettings().autoPicture).toBe(true);
    // A blob from before AUTO: the fit's only if nobody moved the picture.
    expect(mergeSettings({ video: DEFAULT_VIDEO }).autoPicture).toBe(true);
    expect(mergeSettings({ video: { ...DEFAULT_VIDEO, spray: "low" } }).autoPicture).toBe(false);
    expect(
      mergeSettings({ video: { ...DEFAULT_VIDEO, spray: "low" }, autoPicture: true }).autoPicture,
    ).toBe(true);
    expect(mergeSettings({ autoPicture: false }).autoPicture).toBe(false);
  });

  it("keeps damage off unless it was asked for, and only as a switch", () => {
    expect(freshSettings().damage).toBe(false);
    expect(mergeSettings({ damage: true }).damage).toBe(true);
    expect(mergeSettings({ damage: "yes" }).damage).toBe(false);
  });

  it("keeps the readouts up unless they were taken down, and only as a switch", () => {
    expect(freshSettings().hud).toBe(true);
    expect(mergeSettings({ hud: false }).hud).toBe(false);
    expect(mergeSettings({ hud: "off" }).hud).toBe(true);
  });

  it("folds the master and the switch into both faders the mixer is handed", () => {
    const s = { ...freshSettings(), audio: { master: 0.5, engine: 0.8, effects: 0.4 } };
    expect(mixOf(s).engine).toBeCloseTo(0.4);
    expect(mixOf(s).effects).toBeCloseTo(0.2);
    expect(mixOf({ ...s, sound: false })).toEqual({ engine: 0, effects: 0 });
  });

  it("hands the engine a number per hand, every hand on by default", () => {
    expect(assistOf(freshSettings().assist)).toEqual({ yaw: 1, air: 1 });
    expect(assistOf({ steer: "half", air: "off" })).toEqual({ yaw: 0.5, air: 0 });
  });

  it("walks the camera ladder round, and back onto it from anywhere off it", () => {
    let rung = RUN_CAMERAS[0];
    const seen = new Set<string>();
    for (let i = 0; i < RUN_CAMERAS.length; i++) {
      seen.add(rung);
      rung = nextCamera(rung);
    }
    expect(rung).toBe(RUN_CAMERAS[0]);
    expect(seen.size).toBe(RUN_CAMERAS.length);
    expect(nextCamera("orbit")).toBe(DEFAULT_CAMERA);
  });
});

describe("the keys page (settings-input.ts)", () => {
  it("lists every action once, the held six first", () => {
    const ids = KEY_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual((Object.keys(DEFAULT_KEYS) as KeyAction[]).sort());
    for (const a of KEY_ACTIONS) expect(a.label.length).toBeGreaterThan(0);
  });

  it("rebinds a row to one key, and says when a key does two jobs", () => {
    const keys = bindKey(freshKeys(), "reset", "KeyC");
    expect(keys.reset).toEqual(["KeyC"]);
    expect(clashesWith(keys, "reset")).toEqual(["camera"]);
    expect(clashesWith(keys, "camera")).toEqual(["reset"]);
    expect(clashesWith(freshKeys(), "throttle")).toEqual([]);
    // The shipped table is never handed out to be rebound.
    const fresh = freshKeys() as Record<KeyAction, string[]>;
    fresh.throttle.push("KeyX");
    expect(DEFAULT_KEYS.throttle).not.toContain("KeyX");
  });

  it("reads a code the way the cap is printed", () => {
    expect(keyLabel("KeyW")).toBe("W");
    expect(keyLabel("ArrowUp")).toBe("UP ARROW");
    expect(keyLabel("ShiftLeft")).toBe("L SHIFT");
    expect(boundLabel([])).toMatch(/\S/);
    expect(boundLabel(["KeyE", "ShiftLeft"])).toBe("E / L SHIFT");
  });

  it("merges stored keys against the actions this build has", () => {
    // A row still exactly as an earlier build shipped it moves with the
    // shipped layout; a rebound one is the rider's.
    const old = mergeKeys({
      throttle: ["KeyW", "ArrowUp"],
      brake: ["KeyS", "ArrowDown", "Space"],
      leanForward: ["KeyQ", "KeyZ"],
      leanBack: ["KeyP"],
    });
    expect(old.throttle).toEqual(freshKeys().throttle);
    expect(old.brake).toEqual(freshKeys().brake);
    expect(old.leanForward).toEqual(freshKeys().leanForward);
    expect(old.leanBack).toEqual(["KeyP"]);
    expect(mergeKeys(null)).toEqual(freshKeys());
    const merged = mergeKeys({ throttle: ["KeyI", 4, "KeyI"], hover: ["KeyH"], brake: "KeyK" });
    expect(merged.throttle).toEqual(["KeyI"]);
    expect(merged.brake).toEqual(DEFAULT_KEYS.brake);
    expect("hover" in merged).toBe(false);
  });
});

describe("the game's own buttons (run-actions.ts)", () => {
  function rig(shell: Shell) {
    const did: string[] = [];
    const act = createRunActions({
      shell: () => shell,
      pause: () => did.push("pause"),
      resume: () => did.push("resume"),
      restart: () => did.push("restart"),
      camera: () => did.push("camera"),
      reset: () => did.push("reset"),
      leave: () => did.push("leave"),
      shoot: () => did.push("shot"),
      toggleHud: () => did.push("hud"),
    });
    return { did, act };
  }

  it("answers every word the desktop shell's menu bar can send", () => {
    for (const command of SHELL_COMMANDS) {
      const { did, act } = rig("run");
      act(command as RunPress);
      expect(did, command).toEqual([command]);
    }
  });

  it("does nothing to a race that is not being ridden, but PAUSE over the card resumes", () => {
    for (const shell of ["splash", "menu", "loading"] as Shell[]) {
      const { did, act } = rig(shell);
      for (const command of SHELL_COMMANDS) act(command as RunPress);
      expect(did, shell).toEqual([]);
    }
    const { did, act } = rig("pause");
    act("pause");
    act("restart");
    expect(did).toEqual(["resume"]);
  });

  // The shutter and the HUD's switch are about the PICTURE, so they answer
  // wherever a race is on screen — the frame held under the pause card and a
  // replay included — and nowhere a card stands over the bot's race.
  it("takes a picture and walks the HUD over a race on screen only", () => {
    for (const shell of ["run", "pause", "replay"] as Shell[]) {
      const { did, act } = rig(shell);
      act("shot");
      act("hud");
      expect(did, shell).toEqual(["shot", "hud"]);
    }
    for (const shell of ["splash", "menu", "loading"] as Shell[]) {
      const { did, act } = rig(shell);
      act("shot");
      act("hud");
      expect(did, shell).toEqual([]);
    }
  });

  it("over a replay walks the camera, leaves on PAUSE and takes a picture, and nothing else", () => {
    const { did, act } = rig("replay");
    for (const command of SHELL_COMMANDS) act(command as RunPress);
    act("reset");
    expect(did.sort()).toEqual(["camera", "leave", "shot"]);
  });
});

describe("the cursor's walk (menu-cursor.ts)", () => {
  const card: NavRect[] = [
    { x: 0, y: 0, w: 200, h: 40 },
    { x: 0, y: 50, w: 95, h: 40 },
    { x: 105, y: 50, w: 95, h: 40 },
    { x: 0, y: 100, w: 200, h: 40 },
  ];

  it("goes down to the row underneath and right to the button beside", () => {
    expect(pickNeighbour(card, 0, "down")).toBe(1);
    expect(pickNeighbour(card, 1, "right")).toBe(2);
    expect(pickNeighbour(card, 2, "down")).toBe(3);
  });

  it("wraps off the bottom to the top", () => {
    expect(pickNeighbour(card, 3, "down")).toBe(0);
  });
});

describe("what the pause card bills a held race with (pause-stats.ts)", () => {
  /** A race nobody has ridden anywhere yet: every figure at its floor, so
   * each case below turns on exactly the fields it sets. */
  const RESTING: PauseRun = {
    place: 1,
    riders: 1,
    time: 0,
    free: false,
    lap: 1,
    laps: 1,
    taken: 0,
    checkpoints: 8,
    bestAir: 0,
    distance: 0,
    best: null,
  };
  const run = (over: Partial<PauseRun>): PauseRun => ({ ...RESTING, ...over });
  const keys = (over: Partial<PauseRun>): string[] => pauseStats(run(over)).map((stat) => stat.key);

  it("never carries more cells than the card has room for", () => {
    const everything = run({
      riders: 4,
      place: 2,
      laps: 3,
      lap: 2,
      bestAir: 1.4,
      distance: 900,
      best: { time: 150, sled: "hare", at: 0 },
    });
    expect(pauseStats(everything)).toHaveLength(PAUSE_STATS);
    expect(pauseStats(everything, 2)).toHaveLength(2);
    expect(pauseStats(everything, -1)).toHaveLength(0);
  });

  it("leads a race with the standing and the clock, then the race's own story", () => {
    expect(keys({ riders: 4, laps: 3, bestAir: 1.2, distance: 400 })).toEqual([
      "place",
      "time",
      "air",
      "distance",
    ]);
    // With no story yet it IS the corner's reading — nothing else is true.
    expect(keys({ riders: 4, laps: 3 })).toEqual(["place", "time", "lap", "checkpoint"]);
  });

  it("puts the record a time trial is ridden against ahead of the flights", () => {
    expect(keys({ best: { time: 95, sled: "hare", at: 0 }, bestAir: 1, distance: 50 })).toEqual([
      "time",
      "record",
      "air",
      "distance",
    ]);
    const record = pauseStats(run({ best: { time: 95, sled: "hare", at: 0 } })).find(
      (stat) => stat.key === "record",
    )!;
    expect(record.value).toBe(STRINGS.resultTime(95));
    expect(record.label).toBe(STRINGS.pauseRecord);
  });

  it("bills no standing alone, no lap on a one-lap run and no checkpoint on a free ride", () => {
    expect(keys({})).toEqual(["time", "checkpoint"]);
    expect(keys({ free: true, laps: 3, riders: 1, bestAir: 0.8, distance: 1200 })).toEqual([
      "time",
      "air",
      "distance",
    ]);
    expect(keys({ free: true })).toEqual(["time"]);
  });

  it("reads each figure the way the HUD's own chip does", () => {
    const race = pauseStats(run({ riders: 4, place: 3, time: 72.5, laps: 3, lap: 2, taken: 5 }));
    const by = (key: string): PauseStat => race.find((stat) => stat.key === key)!;
    expect(by("place").value).toBe(STRINGS.place(3, 4));
    expect(by("place").label).toBe(STRINGS.placeLabel);
    expect(by("time").value).toBe(STRINGS.resultTime(72.5));
    expect(by("lap").value).toBe(STRINGS.laps(2, 3));
    expect(by("checkpoint").value).toBe(STRINGS.checkpoints(5, 8));
  });
});
