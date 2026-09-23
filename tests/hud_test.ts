// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD'S PAYLOAD — what the readouts over a race are worked out FROM,
// read without a browser: the snapshot the HUD draws (`snapshot.ts`), the
// line each event earns in the news column (`run-news.ts`), the press a
// second finger makes (`hud-press.ts`) and the grip a thumb zone holds a
// finger by (`thumb-guard.ts`). Plus the strings table's own coverage: a
// word nobody reads is a word nobody fixes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TUNING, botInput, createGame, step, type GameEvent, type GameState } from "@engine";

import { createHudPress } from "../pwa/src/game/hud-press.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { lapOf, standingsOf, takeSnapshot, takenThisLap } from "../pwa/src/game/snapshot.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { createThumbGuard, type GuardWindow } from "../pwa/src/game/thumb-guard.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A race on the stadium, three rivals on the grid and the lights on. */
function race(): GameState {
  return createGame({ level: syntheticLevel(), seed: 7, quiet: true });
}

/** Ride `seconds` of it on the bot. */
function ride(state: GameState, seconds: number): void {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, botInput(state));
}

describe("the snapshot (snapshot.ts)", () => {
  it("reads the lights, then GO, off the engine's own clock", () => {
    const state = race();
    const at = takeSnapshot(state);
    expect(at.countdown).toBe(3);
    expect(at.go).toBe(false);
    expect(at.riders).toBe(4);
    expect(at.lap).toBe(1);
    expect(at.laps).toBe(state.rules.laps);
    expect(at.taken).toBe(0);
    expect(at.checkpoints).toBe(state.level.checkpoints.length);
    ride(state, state.rules.countdown + 0.2);
    const go = takeSnapshot(state);
    expect(go.countdown).toBe(0);
    expect(go.go).toBe(true);
    ride(state, 1.5);
    expect(takeSnapshot(state).go).toBe(false);
  });

  it("reads the speed, the revs and the place straight off the engine", () => {
    const state = race();
    ride(state, 8);
    const snap = takeSnapshot(state);
    expect(snap.speedKmh).toBeCloseTo(state.sled.speed * 3.6);
    expect(snap.rpm).toBeGreaterThan(snap.idle);
    expect(snap.rpm).toBeLessThanOrEqual(1.01);
    expect(snap.place).toBeGreaterThanOrEqual(1);
    expect(snap.place).toBeLessThanOrEqual(4);
    expect(snap.result).toBe(null);
    expect(snap.standings).toBe(null);
  });

  it("counts the start line as the first checkpoint of a lap, and the lap from one", () => {
    const p = race().progress;
    expect(takenThisLap(p, 10)).toBe(0);
    expect(takenThisLap({ ...p, started: true, nextCheckpoint: 1 }, 10)).toBe(1);
    expect(takenThisLap({ ...p, started: true, nextCheckpoint: 7 }, 10)).toBe(7);
    // Every checkpoint of the lap taken; only the line to close it owed.
    expect(takenThisLap({ ...p, started: true, nextCheckpoint: 0 }, 10)).toBe(10);
    expect(takenThisLap({ ...p, started: true, nextCheckpoint: 1, finished: true }, 10)).toBe(10);
    expect(lapOf({ ...p, lap: 0 }, 3)).toBe(1);
    expect(lapOf({ ...p, lap: 2 }, 3)).toBe(3);
    // The last crossing belongs to the last lap, not to a fourth.
    expect(lapOf({ ...p, lap: 3 }, 3)).toBe(3);
  });

  it("points the arrow back at a missed checkpoint, in screen space, until it is taken", () => {
    const state = race();
    expect(takeSnapshot(state).missed).toBe(null);
    state.progress.missed = 2;
    state.progress.nextCheckpoint = 2;
    const snap = takeSnapshot(state);
    expect(snap.missed).not.toBe(null);
    expect(snap.missed!.distance).toBeGreaterThan(0);
    expect(Math.abs(snap.missed!.angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it("bills the finish, and the whole field's table under it, live", () => {
    const state = race();
    ride(state, 6);
    state.progress.finished = true;
    state.progress.time = 181.5;
    state.rivals[1].run.progress.finished = true;
    state.rivals[1].run.progress.time = 170.25;
    const snap = takeSnapshot(state);
    expect(snap.result).not.toBe(null);
    const table = standingsOf(state);
    expect(table.map((s) => s.place)).toEqual([1, 2, 3, 4]);
    // Home first, by the clock; the field still out after them.
    expect(table[0]).toMatchObject({ slot: 3, time: 170.25, you: false });
    expect(table[1]).toMatchObject({ slot: 1, time: 181.5, you: true });
    expect(table[2].time).toBe(null);
    expect(snap.result!.place).toBe(2);
    expect(new Set(table.map((s) => s.slot)).size).toBe(4);
  });
});

describe("the damage instrument and the trench's hint (snapshot.ts)", () => {
  it("draws the damage only on a race run with it, off the engine's figures", () => {
    expect(takeSnapshot(race()).damage).toBe(null);
    const state = createGame({ level: syntheticLevel(), damage: true, quiet: true });
    state.sled.damage.ski[1] = 0.4;
    expect(takeSnapshot(state).damage).toEqual({ skiLeft: 0, skiRight: 0.4, suspension: 0 });
  });

  it("says STUCK while the tread is dug in, and not while the rider is off it", () => {
    const state = race();
    expect(takeSnapshot(state).stuck).toBe(false);
    state.sled.trench = TUNING.trench.max;
    expect(takeSnapshot(state).stuck).toBe(true);
  });
});

describe("the news column (run-news.ts)", () => {
  const state = race();
  const line = (e: GameEvent) => newsFor(e, state);

  it("opens the race on the line and bills every later checkpoint with its clock", () => {
    expect(line({ kind: "checkpoint", t: 1, index: 0, lap: 0, split: 2 })?.text).toBe(
      STRINGS.newsStart,
    );
    expect(line({ kind: "checkpoint", t: 1, index: 0, lap: 1, split: 60 })).toBe(null);
    expect(line({ kind: "checkpoint", t: 1, index: 3, lap: 0, split: 25 })).toEqual({
      text: STRINGS.newsCheckpoint(3, 25),
      tone: "good",
    });
  });

  it("calls the last lap, and leaves the flag to the finish's own line", () => {
    const laps = state.rules.laps;
    expect(line({ kind: "lap", t: 1, lap: laps - 1, time: 60 })?.text).toContain(
      STRINGS.newsLastLap,
    );
    expect(line({ kind: "lap", t: 1, lap: laps, time: 60 })).toBe(null);
    expect(line({ kind: "finish", t: 1, time: 180, place: 2 })?.tone).toBe("good");
  });

  it("says why the rider came off, that he is dug in, and what bent", () => {
    for (const cause of ["tree", "nose", "roll"] as const) {
      expect(line({ kind: "wipeout", t: 1, cause, speed: 14, x: 0, z: 0 })).toEqual({
        text: STRINGS.newsWipeout(cause),
        tone: "bad",
      });
    }
    expect(line({ kind: "stuck", t: 1 })?.text).toBe(STRINGS.newsStuck);
    expect(line({ kind: "damage", t: 1, part: "skiRight", level: 0.3 })?.text).toBe(
      STRINGS.newsDamage("skiRight"),
    );
  });

  it("says the bad news in the bad tone, and a clean landing not at all", () => {
    expect(line({ kind: "missed", t: 1, index: 4 })?.tone).toBe("bad");
    expect(line({ kind: "hit", t: 1, speed: 10, x: 0, z: 0 })?.tone).toBe("bad");
    const land = { kind: "land", t: 1, airTime: 1, impact: 9, speed: 20, lost: 0.1 } as const;
    expect(line({ ...land, harsh: true })?.tone).toBe("bad");
    expect(line({ ...land, harsh: false, lost: 0 })).toBe(null);
    expect(line({ kind: "count", t: 1, left: 3 })).toBe(null);
  });
});

describe("a press made with a thumb already down (hud-press.ts)", () => {
  const box = { left: 0, top: 0, right: 40, bottom: 40 };

  it("fires on the release of the pointer it was holding, inside its own edges", () => {
    const press = createHudPress();
    press.down({ pointerId: 2, pointerType: "touch", clientX: 10, clientY: 10 });
    expect(press.up({ pointerId: 2, clientX: 12, clientY: 12 }, box, 1000)).toBe(true);
    // ...and swallows the click that echoes it.
    expect(press.click(1100)).toBe(false);
    expect(press.click(5000)).toBe(true);
  });

  it("abandons a press the finger slid off, and leaves a mouse to its own click", () => {
    const press = createHudPress();
    press.down({ pointerId: 3, pointerType: "touch", clientX: 10, clientY: 10 });
    expect(press.up({ pointerId: 3, clientX: 90, clientY: 10 }, box, 0)).toBe(false);
    press.down({ pointerId: 1, pointerType: "mouse", clientX: 10, clientY: 10 });
    expect(press.up({ pointerId: 1, clientX: 10, clientY: 10 }, box, 0)).toBe(false);
  });
});

describe("a thumb zone's grip (thumb-guard.ts)", () => {
  function fakeWindow(): GuardWindow & { fire: (type: string, pointerId?: number) => void } {
    const listeners = new Map<string, ((e: { pointerId?: number }) => void)[]>();
    return {
      addEventListener: (type, l) => listeners.set(type, [...(listeners.get(type) ?? []), l]),
      removeEventListener: (type, l) =>
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((x) => x !== l),
        ),
      fire: (type, pointerId) => {
        for (const l of listeners.get(type) ?? []) l({ pointerId });
      },
    };
  }

  it("lets go on the pointer's end anywhere, on blur, and on the watchdog", () => {
    let released = 0;
    const win = fakeWindow();
    const guard = createThumbGuard(() => released++, win);
    expect(guard.claim(5, () => false)).toBe(true);
    win.fire("pointerup", 5);
    expect(released).toBe(1);
    guard.claim(6, () => false);
    win.fire("blur");
    expect(released).toBe(2);
    let down = true;
    guard.claim(7, () => down);
    down = false;
    guard.poll();
    expect(released).toBe(3);
    guard.dispose();
  });

  it("refuses a second finger while the first is demonstrably still down", () => {
    const guard = createThumbGuard(() => {}, fakeWindow());
    expect(guard.claim(1, () => true)).toBe(true);
    expect(guard.claim(2, () => true)).toBe(false);
    expect(guard.owns(1)).toBe(true);
    guard.dispose();
  });
});

describe("the strings table (strings.ts, §39.1)", () => {
  /** Every source file of the app, strings.ts itself left out. */
  function appSources(dir: string): string {
    let out = "";
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out += appSources(path);
      else if (/\.tsx?$/.test(name) && name !== "strings.ts") out += readFileSync(path, "utf8");
    }
    return out;
  }
  const sources = appSources(join(import.meta.dirname, "..", "pwa", "src"));

  it("has a word for every key, and every key is read somewhere", () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      if (typeof value === "string") expect(value.trim().length, key).toBeGreaterThan(0);
      expect(sources.includes(`STRINGS.${key}`), `STRINGS.${key} is never read`).toBe(true);
    }
  });
});
