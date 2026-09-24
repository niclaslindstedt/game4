// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — A REGION IS NAMED IN FIVE PLACES, and this is the test that holds
// them to one list: the engine's row (`mapgen/regions.ts`: what the country
// IS), the ground's and the trees' look (`region-look.ts`), the grade over
// the whole picture (`colour-grade.ts`), the start card's word for it
// (`strings.ts`), and the COUNTRY row that offers it. None can import the
// others' reason to exist, so a region added to one and not the rest is a
// map with no colour, or a card with no word.
//
// And it holds the three promises the regions were built on: the BOREAL is
// the map every seed always built (no digest moved for the table existing);
// every other region builds, clean, in its own character — the alpine high
// and bare, the tundra flat and crusted, the birch valley pale with a frozen
// river through it; and a region is a KIND of country, never a place.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_REGION,
  LEVEL_RULES as R,
  REGIONS,
  REGION_IDS,
  analyzeLevel,
  generateLevel,
  levelDigest,
  nearestTrackPoint,
  onIce,
  regionOf,
  SURFACE_CLEAR as CLEAR,
  withinBand,
  type GeneratedLevel,
  type Grip,
  type RegionId,
} from "@engine";
import { COLOUR_GRADES, gradeTone, isNeutral } from "../pwa/src/game/colour-grade.ts";
import { GRADE_FRAGMENT } from "../pwa/src/game/grade-pass.ts";
import { REGION_LOOKS } from "../pwa/src/game/region-look.ts";
import { freeGameOptions, freshRide, mergeRide } from "../pwa/src/game/free-ride.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { SLED, FULL_ASSIST } from "@engine";
import { levelFor } from "./support/levels.ts";

const ROOT = process.cwd();

/** Two seeds per region, built once and shared. */
const SEEDS = [5, 38];
const built = new Map<string, GeneratedLevel>();
function regionLevel(region: RegionId, seed: number): GeneratedLevel {
  const key = `${region}:${seed}`;
  let level = built.get(key);
  if (!level) {
    level = generateLevel(seed, { region });
    built.set(key, level);
  }
  return level;
}

/** How hard the basin's floor rolls: its mean slope, m per m, sampled
 * every 25 m — a rough country is steep everywhere, where a tilted one is
 * only high at one side. */
function relief(level: GeneratedLevel): number {
  const n = { x: 0, y: 0, z: 0 };
  let sum = 0;
  let count = 0;
  for (let z = 300; z <= 1300; z += 25) {
    for (let x = 300; x <= 1300; x += 25) {
      level.normalAt(x, z, n);
      sum += Math.sqrt(1 - n.y * n.y) / n.y;
      count++;
    }
  }
  return sum / count;
}

/** The mean share of a field over the grid. */
function share(field: { data: Float32Array } | undefined): number {
  if (!field) return 0;
  let s = 0;
  for (const v of field.data) s += v;
  return s / field.data.length;
}

describe("a region is named in five places, and all five agree", () => {
  it("the engine's rows, the looks, the grades and the card's words are one list", () => {
    const ids = [...REGION_IDS].sort();
    expect(Object.keys(REGIONS).sort()).toEqual(ids);
    expect(Object.keys(REGION_LOOKS).sort()).toEqual(ids);
    expect(Object.keys(COLOUR_GRADES).sort()).toEqual(ids);
    expect(Object.keys(STRINGS.regionNames).sort()).toEqual(ids);
    for (const id of REGION_IDS) expect(REGIONS[id].id).toBe(id);
    expect(DEFAULT_REGION).toBe("boreal");
  });

  it("the boreal row is all ones and lays nothing, and its grade is the identity", () => {
    const b = REGIONS.boreal;
    const ones = [
      b.relief.hills,
      b.relief.ridges,
      b.relief.mountain,
      b.relief.crests,
      b.relief.tilt,
      b.relief.bowls.count,
      b.relief.bowls.radius,
      b.relief.bowls.depth,
      b.forest.density,
      b.forest.meadow,
      b.forest.height,
      b.forest.treeLine,
      b.kickers,
    ];
    expect(ones.every((v) => v === 1)).toBe(true);
    expect(b.forest.lowland).toBeNull();
    // The roster is DRAWN only (a hash of where each trunk stands), so the
    // boreal's mix of kinds moves no trunk; spruce is still most of it.
    expect(b.forest.roster[0].kind).toBe("spruce");
    expect(b.forest.roster[0].share).toBeGreaterThan(0.3);
    expect(b.sun.latitude).toBe(R.sun.latitude);
    expect(b.sun.dayOfYear).toBe(R.sun.dayOfYear);
    expect(b.crust).toBeNull();
    expect(b.river).toBeNull();
    expect(isNeutral(COLOUR_GRADES.boreal)).toBe(true);
    for (const id of REGION_IDS) {
      if (id !== "boreal") expect(isNeutral(COLOUR_GRADES[id]), id).toBe(false);
    }
  });

  it("every roster's shares sum to one", () => {
    for (const id of REGION_IDS) {
      const sum = REGIONS[id].forest.roster.reduce((a, r) => a + r.share, 0);
      expect(sum, id).toBeCloseTo(1, 9);
    }
  });
});

describe("the boreal is the map every seed always built", () => {
  it("asking for it by name builds the very map asking for nothing does", () => {
    const plain = levelFor(38);
    const named = regionLevel("boreal", 38);
    expect(levelDigest(named)).toBe(levelDigest(plain));
    expect(plain.region).toBe("boreal");
    expect(plain.crust).toBeUndefined();
    expect(plain.ice).toBeUndefined();
    expect(plain.iceAt).toBeUndefined();
    plain.trees.forEach((t, i) => expect(named.trees[i].kind).toBe(t.kind));
  });

  it("a hand-built map without a region reads as the boreal", () => {
    expect(regionOf({}).id).toBe("boreal");
  });
});

describe("every region builds, clean, in its own character", () => {
  for (const id of REGION_IDS.filter((r) => r !== "boreal")) {
    for (const seed of SEEDS) {
      it(`${id} seed ${seed} builds clean, in its own band of latitude`, () => {
        const level = regionLevel(id, seed);
        expect(level.region).toBe(id);
        expect(analyzeLevel(level).ok).toBe(true);
        expect(withinBand(level.sun.latitude, REGIONS[id].sun.latitude)).toBe(true);
        expect(withinBand(level.sun.dayOfYear, REGIONS[id].sun.dayOfYear)).toBe(true);
        // A region's map is another map: its digest names it.
        expect(levelDigest(level)).not.toBe(levelDigest(levelFor(seed)));
      });
    }
  }

  it("the high alpine stands higher and rougher, and is bare of all but a few trees", () => {
    for (const seed of SEEDS) {
      const alpine = regionLevel("alpine", seed);
      const boreal = regionLevel("boreal", seed);
      expect(relief(alpine)).toBeGreaterThan(relief(boreal));
      expect(alpine.trees.length).toBeLessThan(boreal.trees.length * 0.5);
      expect(share(alpine.crust)).toBeGreaterThan(0.1);
    }
  });

  it("the tundra is flat and open, and crusted over most of it", () => {
    for (const seed of SEEDS) {
      const tundra = regionLevel("tundra", seed);
      const boreal = regionLevel("boreal", seed);
      expect(relief(tundra)).toBeLessThan(relief(boreal) * 0.6);
      expect(tundra.trees.length).toBeLessThan(boreal.trees.length * 0.1);
      expect(share(tundra.crust)).toBeGreaterThan(0.5);
    }
  });

  it("the birch valley grows birch, and a frozen river no tree or kicker stands on", () => {
    for (const seed of SEEDS) {
      const birch = regionLevel("birch", seed);
      const birches = birch.trees.filter((t) => t.kind === "birch").length;
      expect(birches / birch.trees.length).toBeGreaterThan(0.6);
      expect(birch.ice).toBeDefined();
      expect(birch.iceAt).toBeDefined();
      // Hundreds of metres of river: tens of thousands of square metres.
      const cells = birch.ice!.data.filter((v) => v > 0.5).length;
      expect(cells * birch.cell * birch.cell).toBeGreaterThan(10_000);
      for (const t of birch.trees) expect(birch.iceAt!(t.x, t.z)).toBe(0);
      for (const k of birch.kickers.filter((k) => !k.onTrack)) {
        expect(birch.iceAt!(k.x, k.z)).toBe(0);
      }
      // The ice is packed as hard as the groomer.
      const i = birch.ice!.data.findIndex((v) => v > 0.99);
      const x = (i % birch.ground.cols) * birch.cell;
      const z = Math.floor(i / birch.ground.cols) * birch.cell;
      expect(birch.packedAt(x, z)).toBeGreaterThan(0.95);
    }
  });

  it("the region's own snow keeps off the track (R10 holds)", () => {
    for (const id of ["alpine", "tundra", "birch"] as const) {
      const level = regionLevel(id, 38);
      const f = level.ground;
      for (let k = 0; k < f.data.length; k += 97) {
        const x = f.originX + (k % f.cols) * f.cell;
        const z = f.originZ + Math.floor(k / f.cols) * f.cell;
        const wild = Math.max(level.crust?.data[k] ?? 0, level.ice?.data[k] ?? 0);
        if (wild === 0) continue;
        expect(nearestTrackPoint(level, x, z).distance).toBeGreaterThanOrEqual(CLEAR - 0.5);
      }
    }
  });
});

describe("bare ice takes the grip away and nothing else", () => {
  it("full ice leaves the region's shares of each coefficient; none leaves it alone", () => {
    const grip: Grip = { tread: 1, treadSide: 1, ski: 1 };
    onIce(grip, 0);
    expect(grip).toEqual({ tread: 1, treadSide: 1, ski: 1 });
    onIce(grip, 1);
    expect(grip.tread).toBeLessThan(0.6);
    expect(grip.treadSide).toBeLessThan(0.6);
    expect(grip.ski).toBeLessThan(0.6);
  });
});

describe("the grade: the model and its shader", () => {
  it("the shader reads every dial the model has, and ends in the output's colour space", () => {
    for (const u of ["uContrast", "uLift", "uSaturation", "uTint", "uShade", "uGlow", "uSplit"]) {
      expect(GRADE_FRAGMENT).toContain(`uniform`);
      expect(GRADE_FRAGMENT.split(u).length, u).toBeGreaterThan(2);
    }
    expect(GRADE_FRAGMENT).toContain("0.42426407");
    const order = [
      "tonemapping_fragment",
      "* uContrast",
      "* uSaturation",
      "c *= uTint",
      "uSplit.x",
    ];
    const at = order.map((s) => GRADE_FRAGMENT.indexOf(s));
    expect(at.every((v) => v >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(GRADE_FRAGMENT.trim().endsWith("#include <colorspace_fragment>\n}")).toBe(true);
  });

  const rgb = (hex: number): [number, number, number] => [
    (hex >> 16) & 0xff,
    (hex >> 8) & 0xff,
    hex & 0xff,
  ];

  it("the neutral grade changes nothing", () => {
    for (const hex of [0x000000, 0x404040, 0x808080, 0xdde6f2, 0xffffff]) {
      expect(gradeTone(COLOUR_GRADES.boreal, hex)).toBe(hex);
    }
  });

  it("the alpine blues its shadows, the tundra drains, the birch valley warms its lights", () => {
    const [ar, , ab] = rgb(gradeTone(COLOUR_GRADES.alpine, 0x404040));
    expect(ab).toBeGreaterThan(ar);
    const sat = (hex: number): number => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
    expect(sat(gradeTone(COLOUR_GRADES.tundra, 0xc04030))).toBeLessThan(sat(0xc04030));
    const [br, , bb] = rgb(gradeTone(COLOUR_GRADES.birch, 0xe0e0e0));
    expect(br).toBeGreaterThan(bb);
  });
});

describe("the start card's COUNTRY row and the link", () => {
  it("a ride keeps its region, reads it back, and stands its run up in it", () => {
    expect(freshRide().region).toBe("boreal");
    expect(mergeRide({ region: "tundra" }).region).toBe("tundra");
    expect(mergeRide({ region: "somewhere" }).region).toBe("boreal");
    const ride = { ...freshRide(), region: "birch" as const };
    expect(freeGameOptions(ride, 7, SLED, FULL_ASSIST).region).toBe("birch");
  });

  it("?region= names a region, and nothing else", () => {
    expect(readParams("?region=alpine").region).toBe("alpine");
    expect(readParams("?region=elsewhere").region).toBeNull();
    expect(readParams("").region).toBeNull();
  });
});

describe("a region is a kind of country, never a place", () => {
  /** The source and the docs, minus what may name a place: the spec (a copy
   * of the sibling's), the changelog, the licence, and this file. */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (["previews", "tauri", "native"].includes(name)) continue;
        sources(path, out);
      } else if (
        /\.(ts|tsx|mjs|md)$/.test(name) &&
        // …nor the identity test, which names a real wordmark to forbid it.
        !/CHANGELOG|OSS_GAME_SPEC|LICENSE|region_test|identity_test/.test(name)
      ) {
        out.push(path);
      }
    }
    return out;
  }

  it("names no range, country or valley anywhere in the tree", () => {
    const places =
      /\b(Alps|Rockies|Rocky Mountains|Himalaya\w*|Andes|Pyrenee\w*|Dolomit\w+|Carpathian\w*|Tatra|Caucasus|Urals?\b|Lapland|Sápmi|Siberia\w*|Yukon|Alaska\w*|Canad\w+|Scandinavi\w+|Sweden|Swedish|Finland|Finnish|Norway|Norwegian|Iceland\w*|Greenland|Svalbard|Kamchatka|Hokkaido|Patagonia\w*|Tyrol\w*|Chamonix|Zermatt|Whistler|Colorado|Utah|Montana|Wyoming|Quebec|Ontario)\b/;
    const hits: string[] = [];
    for (const path of sources(ROOT)) {
      const text = readFileSync(path, "utf8");
      const m = places.exec(text);
      if (m) hits.push(`${path.slice(ROOT.length + 1)}: "${m[0]}"`);
    }
    expect(hits).toEqual([]);
  });
});
