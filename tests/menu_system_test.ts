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
  freshSettings,
  mergeSettings,
  nextCamera,
} from "../pwa/src/game/settings.ts";
import {
  SHELLS,
  cameraFor,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  type Shell,
} from "../pwa/src/game/shell.ts";
import {
  SPLASH_MIN_MS,
  SPLASH_STUCK_MS,
  splashReady,
  splashSkipped,
} from "../pwa/src/game/splash.ts";
import { dealSeed, readParams } from "../pwa/src/game/url-params.ts";
import { SHELL_COMMANDS } from "../pwa/src/shell-host.ts";

describe("the five surfaces (shell.ts)", () => {
  it("steps the engine behind every card but the pause card", () => {
    for (const s of SHELLS) expect(simulates(s), s).toBe(s !== "pause");
  });

  it("puts the player's hands on the sled only on a run — the bot rides everywhere else", () => {
    for (const s of SHELLS) expect(playerRides(s), s).toBe(s === "run");
    for (const s of SHELLS) expect(soundsLive(s), s).toBe(playerRides(s));
  });

  it("keeps the HUD up under the pause card, and reaches the pause card only from a run", () => {
    expect(SHELLS.filter(hudOver)).toEqual(["pause", "run"]);
    expect(SHELLS.filter(canPause)).toEqual(["run"]);
  });

  it("frames every card with the orbit and a race with the rider's own rung", () => {
    for (const s of SHELLS) {
      expect(cameraFor(s, "hood"), s).toBe(hudOver(s) ? "hood" : "orbit");
    }
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
    expect(mergeSettings({ camera: "far", sound: false })).toEqual({ camera: "far", sound: false });
    // Off the ladder, and the wrong type: back to the defaults.
    expect(mergeSettings({ camera: "orbit", sound: "no" })).toEqual(freshSettings());
    expect(mergeSettings({ camera: "helicopter" }).camera).toBe(DEFAULT_CAMERA);
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
