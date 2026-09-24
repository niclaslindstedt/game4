// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PICTURE COSTS (pwa/src/game/settings-video.ts) and the probe that
// picks a first visit's rung (video-probe.ts): the whole ladder, DOM-free.
// The renderer only ever reads these tables, so a promise the table breaks
// is a promise the game breaks.

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIDEO,
  DISTANCE_LOOK,
  FOREST_LOOK,
  RESOLUTION_SHARE,
  SHADOW_LEVELS,
  SHADOW_LOOK,
  SPRAY_SHARE,
  TERRAIN_REACH,
  TIERS,
  TRAIL_LEVELS,
  TRAIL_LOOK,
  VIDEO_PRESETS,
  hazeFor,
  mergeVideo,
  presetOf,
  terrainLook,
  terrainReach,
  terrainTriangles,
  withPreset,
} from "../pwa/src/game/settings-video.ts";
import {
  PROBE_HEADROOM,
  PROBE_SAMPLES,
  PROBE_STALLS,
  PROBE_WARMUP,
  applyVerdict,
  createVideoProbe,
  judgeTier,
  videoUntouched,
  type ProbeSample,
} from "../pwa/src/game/video-probe.ts";

describe("the picture's ladders (settings-video.ts)", () => {
  it("runs every ladder cheapest first", () => {
    const shares = TIERS.map((t) => RESOLUTION_SHARE[t]);
    expect(shares).toEqual([...shares].sort((a, b) => a - b));
    expect(RESOLUTION_SHARE.high).toBe(1);
    expect(RESOLUTION_SHARE.low).toBeGreaterThanOrEqual(0.5);

    const sprays = TIERS.map((t) => SPRAY_SHARE[t]);
    expect(sprays).toEqual([...sprays].sort((a, b) => a - b));
    expect(SPRAY_SHARE.high).toBe(1);

    const shadows = SHADOW_LEVELS.map((s) => SHADOW_LOOK[s].size);
    expect(shadows).toEqual([...shadows].sort((a, b) => a - b));
    const reaches = SHADOW_LEVELS.map((s) => SHADOW_LOOK[s].reach);
    expect(reaches).toEqual([...reaches].sort((a, b) => a - b));
    expect(SHADOW_LOOK.off.size).toBe(0);
    // Nothing, the machines alone, every tree's too, and that again with
    // every rider sharp in a map of his own — and only HIGH draws those.
    expect(SHADOW_LEVELS).toEqual(["off", "sleds", "medium", "high"]);
    expect(SHADOW_LOOK.sleds.trees).toBe(false);
    expect(SHADOW_LOOK.medium.trees).toBe(true);
    expect(SHADOW_LOOK.high.trees).toBe(true);
    expect(SHADOW_LEVELS.filter((s) => SHADOW_LOOK[s].hero > 0)).toEqual(["high"]);
    expect(VIDEO_PRESETS.medium.shadows).toBe("medium");
    expect(VIDEO_PRESETS.high.shadows).toBe("high");
    // What a tree casts follows how the FOREST row draws it.
    expect(FOREST_LOOK.low.casters).toBe("sketch");
    expect(FOREST_LOOK.high.casters).toBe("full");

    const fine = TRAIL_LEVELS.map((t) => TRAIL_LOOK[t].fineSize * TRAIL_LOOK[t].coarseSize);
    expect(fine).toEqual([...fine].sort((a, b) => a - b));
    expect(TRAIL_LOOK.off.stamp).toBe(false);
    for (const t of TIERS) expect(TRAIL_LOOK[t].stamp).toBe(true);
  });

  it("builds a ground that is coarser down the ladder and never shorter than the rim", () => {
    const tris = TIERS.map((t) => terrainTriangles(terrainLook(t)));
    // Each rung down draws strictly fewer triangles...
    expect(tris[0]).toBeLessThan(tris[1]);
    expect(tris[1]).toBeLessThan(tris[2]);
    // ...and the top is enough dearer than the design point that the probe's
    // headroom covers it.
    expect(tris[2] / tris[1]).toBeLessThan(PROBE_HEADROOM);
    for (const t of TIERS) {
      const look = terrainLook(t);
      expect(look.n % 4, t).toBe(0);
      expect(terrainReach(look), t).toBeGreaterThanOrEqual(TERRAIN_REACH);
      // ...and no level more than it needs to get there.
      expect(terrainReach({ ...look, levels: look.levels - 1 }), t).toBeLessThan(TERRAIN_REACH);
    }
    // The ground as it was tuned is the top rung: a quarter metre, 192 cells.
    expect(terrainLook("high")).toMatchObject({ n: 192, spacing: 0.25 });
  });

  it("draws fewer trees down the ladder, and never fewer of the ones a sled can hit", () => {
    for (let i = 1; i < TIERS.length; i++) {
      const lo = FOREST_LOOK[TIERS[i - 1]];
      const hi = FOREST_LOOK[TIERS[i]];
      expect(lo.full).toBeLessThanOrEqual(hi.full);
      expect(lo.farShare).toBeLessThanOrEqual(hi.farShare);
      expect(lo.shapes).toBeLessThanOrEqual(hi.shapes);
    }
    // The top rung's budget carries every variant of a map's main kinds.
    expect(FOREST_LOOK.high.shapes).toBeGreaterThanOrEqual(60);
    // The full band draws EVERY tree — the thinning is the far band's
    // sketches alone — so a trunk in reach of the sled is always drawn.
    for (const t of TIERS) expect(FOREST_LOOK[t].full).toBeLessThan(DISTANCE_LOOK.low.far);
    expect(FOREST_LOOK.high.farShare).toBe(1);
  });

  it("pulls the haze in as the distance comes in, and leaves the sky's alone at the top", () => {
    const sky = 1 / 1500;
    expect(hazeFor(sky, "high")).toBe(sky);
    expect(hazeFor(sky, "medium")).toBeGreaterThan(sky);
    expect(hazeFor(sky, "low")).toBeGreaterThan(hazeFor(sky, "medium"));
    // A sky already thicker than the floor keeps its own.
    expect(hazeFor(1 / 100, "low")).toBe(1 / 100);
    // The shorter a rung draws the woods, the more of the haze stands in
    // front of where they stop — the cut-off is hidden, not merely nearer.
    const at = (t: "low" | "medium" | "high") =>
      1 - Math.exp(-DISTANCE_LOOK[t].far * hazeFor(sky, t) * 0.55);
    expect(at("low")).toBeGreaterThanOrEqual(at("medium"));
    expect(at("medium")).toBeGreaterThanOrEqual(at("high"));
    const fars = TIERS.map((t) => DISTANCE_LOOK[t].far);
    expect(fars).toEqual([...fars].sort((a, b) => a - b));
  });

  it("reads a picture back as the preset it is, and CUSTOM once a row moves", () => {
    for (const t of TIERS) {
      expect(presetOf(withPreset(DEFAULT_VIDEO, t))).toBe(t);
      // The canvas's antialiasing is not the preset's.
      expect(presetOf({ ...withPreset(DEFAULT_VIDEO, t), antialias: false })).toBe(t);
    }
    expect(presetOf(DEFAULT_VIDEO)).toBe("medium");
    expect(presetOf({ ...DEFAULT_VIDEO, shadows: "off" })).toBe("custom");
    expect(withPreset({ ...DEFAULT_VIDEO, antialias: false }, "high").antialias).toBe(false);
    // Every preset is a stop on every ladder it names.
    for (const t of TIERS) expect(mergeVideo(VIDEO_PRESETS[t])).toMatchObject(VIDEO_PRESETS[t]);
  });

  it("merges a stored picture row by row", () => {
    expect(mergeVideo(null)).toEqual(DEFAULT_VIDEO);
    expect(mergeVideo({ terrain: "high", trails: "off", antialias: false })).toEqual({
      ...DEFAULT_VIDEO,
      terrain: "high",
      trails: "off",
      antialias: false,
    });
    expect(mergeVideo({ terrain: "ultra", shadows: "max", spray: 3 })).toEqual(DEFAULT_VIDEO);
    // The row's old stops: the quality ladder's LOW is MEDIUM now, and the
    // mode ladder's ALL is HIGH, its riders sharp.
    expect(mergeVideo({ shadows: "low" }).shadows).toBe("medium");
    expect(mergeVideo({ shadows: "all" }).shadows).toBe("high");
    expect(mergeVideo({ shadows: "high" }).shadows).toBe("high");
  });
});

describe("the first-visit probe (video-probe.ts)", () => {
  const steady = (elapsedMs: number, drawMs: number): ProbeSample[] =>
    Array.from({ length: PROBE_SAMPLES }, () => ({ elapsedMs, drawMs }));

  it("promotes a machine with headroom at the display's own rate", () => {
    expect(judgeTier(steady(16.7, 4))).toBe("high");
    // At a hundred and twenty the same frame no longer fits twice and a half.
    expect(judgeTier(steady(8.3, 4))).toBe("medium");
  });

  it("keeps a machine that fits but has no headroom where it is", () => {
    expect(judgeTier(steady(16.7, 12))).toBe("medium");
  });

  it("demotes a machine that cannot hold the design point", () => {
    expect(judgeTier(steady(33.3, 20))).toBe("low");
    const stutter = steady(16.7, 4);
    for (let i = 0; i < stutter.length; i += 5) stutter[i] = { elapsedMs: 50, drawMs: 30 };
    expect(judgeTier(stutter)).toBe("low");
  });

  it("warms up, measures, and says its verdict once", () => {
    const probe = createVideoProbe();
    let verdict = null;
    let frames = 0;
    while (verdict === null && frames < 1000) {
      verdict = probe.frame(16.7, 3);
      frames++;
    }
    expect(verdict).toBe("high");
    expect(frames).toBe(PROBE_WARMUP + PROBE_SAMPLES);
    expect(probe.done()).toBe(true);
    expect(probe.frame(16.7, 3)).toBe(null);
  });

  it("gives up on a machine that only ever stalls, and moves nothing", () => {
    const probe = createVideoProbe();
    let verdict = null;
    for (let i = 0; i < PROBE_STALLS && verdict === null; i++) verdict = probe.frame(900, 10);
    expect(verdict).toBe("medium");
  });

  it("moves only a picture nobody has touched", () => {
    expect(videoUntouched(DEFAULT_VIDEO)).toBe(true);
    expect(applyVerdict(DEFAULT_VIDEO, "high")).toMatchObject(VIDEO_PRESETS.high);
    expect(applyVerdict(DEFAULT_VIDEO, "low")).toMatchObject(VIDEO_PRESETS.low);
    const mine = { ...DEFAULT_VIDEO, spray: "low" as const };
    expect(videoUntouched(mine)).toBe(false);
    expect(applyVerdict(mine, "high")).toBe(mine);
  });
});
