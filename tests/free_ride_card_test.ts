// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE AS THE APP ASKS FOR ONE — every rule behind the start card
// that can be read without a browser: what a stored ride reads back as
// (`free-ride.ts`), the options a ride is stood up with, the rows' readings,
// the chart's one mapping to the snow and back (`seed-chart.ts`), the URL
// that boots one (`url-params.ts`), and the HUD's and the minimap's free
// ride (`snapshot.ts`, `minimap-view.ts`).

import { describe, expect, it } from "vitest";

import { SLED, createGame, generateLevel, NEUTRAL_INPUT, SNOW_DIAL, step } from "@engine";

import {
  FREE_DAYS,
  dateLabel,
  dayOnTravel,
  freeGameOptions,
  freshRide,
  hourLabel,
  mergeRide,
  spotOn,
} from "../pwa/src/game/free-ride.ts";
import { CHART_VIEW, fromChart, seedSchematic, toChart } from "../pwa/src/game/seed-chart.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

describe("what the start card remembers (free-ride.ts, settings.ts)", () => {
  it("defers every day row to the map on a first visit", () => {
    const ride = freshSettings().ride;
    expect(ride).toEqual({ seed: null, day: null, hour: null, depth: 1, spot: null });
  });

  it("reads an older blob with no ride in it as a fresh one", () => {
    expect(mergeSettings({ camera: "hood" }).ride).toEqual(freshRide());
  });

  it("checks every field of a stored ride on its own", () => {
    const ride = mergeRide({
      seed: 42,
      day: 400,
      hour: 30,
      depth: 1.6,
      spot: { seed: 42, x: 100, z: 200 },
    });
    expect(ride.seed).toBe(42);
    expect(ride.day).toBe(FREE_DAYS.max);
    expect(ride.hour).toBe(24);
    // Onto the dial's grid.
    expect(ride.depth).toBe(1.5);
    expect(ride.spot).toEqual({ seed: 42, x: 100, z: 200 });
    const junk = mergeRide({ seed: -3, day: "x", depth: 99, spot: { x: 1 } });
    expect(junk.seed).toBeNull();
    expect(junk.day).toBeNull();
    expect(junk.depth).toBe(SNOW_DIAL.max);
    expect(junk.spot).toBeNull();
    expect(mergeRide("nonsense")).toEqual(freshRide());
  });

  it("keeps a spot only on the seed it was picked on", () => {
    const ride = { ...freshRide(), spot: { seed: 7, x: 10, z: 20 } };
    expect(spotOn(ride, 7)).toEqual({ x: 10, z: 20 });
    expect(spotOn(ride, 8)).toBeNull();
  });

  it("stands a ride up as a free run on the card's answers", () => {
    const ride = { seed: 9, day: 40, hour: 11, depth: 1.5, spot: { seed: 9, x: 400, z: 200 } };
    const opts = freeGameOptions(ride, 9, SLED, { yaw: 1, air: 1 });
    expect(opts.mode).toBe("free");
    expect(opts.seed).toBe(9);
    expect(opts.snowDepth).toBe(1.5);
    expect(opts.day).toEqual({ hour: 11, dayOfYear: 40 });
    expect(opts.spawn).toEqual({ x: 400, z: 200 });
    const state = createGame({ ...opts, level: syntheticLevel(), quiet: true });
    expect(state.rules.course).toBe(false);
    expect(state.snowDepth).toBe(1.5);
    expect(state.level.sun.dayOfYear).toBe(40);
    expect(freeGameOptions(ride, 10, SLED, { yaw: 1, air: 1 }).spawn).toBeUndefined();
  });
});

describe("what the rows read", () => {
  it("reads a count of days as a date, through New Year", () => {
    expect(dateLabel(1)).toBe("1 JAN");
    expect(dateLabel(32)).toBe("1 FEB");
    expect(dateLabel(0)).toBe("31 DEC");
    expect(dateLabel(FREE_DAYS.min)).toBe("1 DEC");
    expect(dateLabel(FREE_DAYS.max)).toBe("15 APR");
  });

  it("puts a December day of the year on the row's travel", () => {
    expect(dayOnTravel(350)).toBe(-15);
    expect(dayOnTravel(40)).toBe(40);
  });

  it("reads a solar hour as a clock", () => {
    expect(hourLabel(10.75)).toBe("10:45");
    expect(hourLabel(9)).toBe("09:00");
    expect(hourLabel(23.999)).toBe("00:00");
  });
});

describe("the chart (seed-chart.ts)", () => {
  it("is north-up, and a point goes to the chart and back", () => {
    expect(toChart(1000, 0, 0)).toEqual([0, CHART_VIEW]);
    expect(toChart(1000, 1000, 1000)).toEqual([CHART_VIEW, 0]);
    const back = fromChart(1600, ...toChart(1600, 420, 1210));
    expect(back.x).toBeCloseTo(420);
    expect(back.z).toBeCloseTo(1210);
  });

  it("holds a point off the chart on the map", () => {
    expect(fromChart(1000, -10, 150)).toEqual({ x: 0, z: 0 });
  });

  it("marks every kicker and the grid of a generated map", () => {
    const level = generateLevel(38);
    const chart = seedSchematic(level);
    expect(chart.size).toBe(level.size);
    expect(chart.kickers).toHaveLength(level.kickers.length);
    expect(chart.kickers.some((k) => !k.onTrack)).toBe(level.kickers.some((k) => !k.onTrack));
    for (const k of chart.kickers) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.x).toBeLessThanOrEqual(CHART_VIEW);
      expect(k.y).toBeGreaterThanOrEqual(0);
      expect(k.y).toBeLessThanOrEqual(CHART_VIEW);
    }
    expect(chart.track.startsWith("M")).toBe(true);
    expect(chart.track.endsWith("Z")).toBe(true);
    const [gx, gy] = toChart(level.size, level.grid[0].x, level.grid[0].z);
    expect(chart.grid.x).toBeCloseTo(gx);
    expect(chart.grid.y).toBeCloseTo(gy);
  });
});

describe("the URL (url-params.ts)", () => {
  it("boots a free ride off ?start=free", () => {
    const p = readParams("?start=free&seed=12");
    expect(p.rides).toBe(true);
    expect(p.free).toBe(true);
    expect(p.seed).toBe(12);
    expect(readParams("?start=race").free).toBe(false);
  });

  it("opens the start card off ?menu=start", () => {
    const p = readParams("?menu=start");
    expect(p.menu).toBe(true);
    expect(p.page).toBe("start");
  });
});

describe("the HUD over a free ride (snapshot.ts, minimap-view.ts)", () => {
  it("reads the best air and the distance, and puts no checkpoint on the plate", () => {
    const state = createGame({ level: syntheticLevel(), mode: "free", quiet: true });
    for (let i = 0; i < 360; i++) step(state, { ...NEUTRAL_INPUT, throttle: 1 });
    const snap = takeSnapshot(state);
    expect(snap.free).toBe(true);
    expect(snap.distance).toBe(state.progress.distance);
    expect(snap.distance).toBeGreaterThan(0);
    expect(snap.bestAir).toBe(state.progress.bestAir);
    expect(snap.missed).toBeNull();
    expect(snap.split).toBeNull();
    expect(snap.minimap.checkpoints).toHaveLength(0);
    expect(snap.minimap.chevron).toBeNull();
  });

  it("a race still reads its course", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    const snap = takeSnapshot(state);
    expect(snap.free).toBe(false);
    expect(snap.minimap.checkpoints.length).toBe(state.level.checkpoints.length);
  });
});
