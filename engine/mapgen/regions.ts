// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — THE REGIONS: which KIND OF SNOW COUNTRY a map is built in, as data.
//
// A region is everything about a map that is not the race: how high the
// country stands and how hard it rolls, how thick the woods grow and what
// grows in them, how many crests stand off the loop to be found, how far
// north the basin lies and when in the winter it is ridden, and what the
// wind and the cold have done to the snow — a crust scoured over the
// powder, a river frozen into a flat road of ice. The difference between
// the regions is stated here, once, as rows the rest of the generator reads
// through `regionOf`. Nothing else in `mapgen/` names a region: the
// terrain asks the row how big its hills are, the forest how thick to grow,
// the sun which latitudes to deal from, the surface whether to lay a crust.
//
// A REGION IS A KIND OF COUNTRY AND NEVER A PLACE. The rows are written
// from real winter country — the relief of a high cirque, the tree line of
// a plateau, the ice on a lowland river — but nothing here, or anywhere the
// rows are read, names a range, a country or a valley that exists
// (`tests/region_test.ts` sweeps the tree for it).
//
// EVERY NUMBER IS A MULTIPLE OF THE RULE BOOK'S OWN, so the BOREAL row —
// the country every rule in `rules.ts` was written against, and what a map
// nobody asked a region of is built in — is all ones and lays nothing, and
// no seed re-rolls for the table existing. A multiple of one is exact in
// floating point and a band scaled by one is the same band, so the boreal
// path through the generator draws the same numbers off the same stream in
// the same order as it did before there were regions; `levelDigest` and the
// campaign's pinned maps hold it to that.

import { LEVEL_RULES as R, type Band } from "./rules.ts";

/** The regions, in the order a card offers them. */
export type RegionId = "boreal" | "alpine" | "tundra" | "birch";

/** What a tree is (R14, R21): the drawn shape and nothing the physics reads —
 * a trunk is a trunk to the sled whatever grows on it. The trees of the
 * northern and the high snow countries in winter, twenty of them:
 *
 *   THE CONIFERS — the SPRUCE every wood is mostly made of; the FIR, narrower
 *   and heavier-laden; the PINE, a bare trunk under a flat crown; the LARCH,
 *   a conifer that drops its needles (a grey skeleton in winter); the BLACK
 *   SPRUCE of the bogs and the tundra's edge, a thin spire with a club of
 *   boughs at its top; the STONE PINE of the timberline, a dense rounded
 *   crown down to the snow; the WHITE PINE, its boughs in flat layers; the
 *   LODGEPOLE, a tall straight pole with a small crown; the HEMLOCK, whose
 *   leader nods over; the JUNIPER, a dark column; the DWARF PINE (mountain
 *   pine), sprawling on several stems; and the SNAG, a conifer long dead.
 *   THE BROADLEAVES, bare in winter — the BIRCH, pale and banded; the ASPEN,
 *   tall and grey-green; the ROWAN, its red berries still on it; the ALDER,
 *   dark, along the wet ground; the WILLOW, a thicket of orange twigs; the
 *   BEECH, which keeps its dead copper leaves through the winter; the MAPLE,
 *   a broad dome; and the ASH, grey and sparse-twigged with its keys. */
export type TreeKind =
  | "spruce"
  | "fir"
  | "pine"
  | "larch"
  | "blackspruce"
  | "stonepine"
  | "whitepine"
  | "lodgepole"
  | "hemlock"
  | "juniper"
  | "dwarfpine"
  | "snag"
  | "birch"
  | "aspen"
  | "rowan"
  | "alder"
  | "willow"
  | "beech"
  | "maple"
  | "ash";

/** Every kind, in the order a sheet shows them. */
export const TREE_KINDS: readonly TreeKind[] = [
  "spruce",
  "fir",
  "pine",
  "larch",
  "blackspruce",
  "stonepine",
  "whitepine",
  "lodgepole",
  "hemlock",
  "juniper",
  "dwarfpine",
  "snag",
  "birch",
  "aspen",
  "rowan",
  "alder",
  "willow",
  "beech",
  "maple",
  "ash",
];

export type Region = {
  readonly id: RegionId;
  /** R2, R3 — multipliers on the country's own bands: the hills'
   * amplitude, the ridges', the flanks' height and their crests, the
   * floor's tilt, and the bowls (how many, how wide, how deep). */
  readonly relief: {
    readonly hills: number;
    readonly ridges: number;
    readonly mountain: number;
    readonly crests: number;
    readonly tilt: number;
    readonly bowls: { readonly count: number; readonly radius: number; readonly depth: number };
  };
  /** R14 — the woods. `density` and `meadow` multiply the rule's (the
   * meadow share is held under one); `height` is how much of the rule's
   * height band the tallest trees reach (1 the whole of it, under one a
   * stunted wood — never out of the band); `treeLine` multiplies the share
   * of the way up the rim trees stop at. `lowland`, when set, is a SECOND
   * tree line in metres over the loop's mean height: the country above it
   * is bare — a high basin whose woods keep to the hollows. `roster` is
   * what grows, each kind with its share of the trees — DRAWN ONLY, dealt
   * off a hash of where each trunk stands (`treeKindAt`), so a roster moves
   * no trunk and no digest. */
  readonly forest: {
    readonly density: number;
    readonly meadow: number;
    readonly height: number;
    readonly treeLine: number;
    readonly lowland: number | null;
    readonly roster: readonly { readonly kind: TreeKind; readonly share: number }[];
  };
  /** R4 — a multiplier on the count of kickers off the track. */
  readonly kickers: number;
  /** R15 — the latitudes and the days of the year a map is dealt from. */
  readonly sun: { readonly latitude: Band; readonly dayOfYear: Band };
  /** WIND CRUST (R21): a packed share the wind has pressed into the powder,
   * laid over `cover` of the country in patches `scale` metres across and
   * over every exposed crest besides (`exposed`, 0..1 of the crust a crest
   * a few metres proud of its surroundings carries). `packed` is how much
   * the crust holds a sled up, as a share of the groomer. Null: the powder
   * is untouched. */
  readonly crust: {
    readonly cover: number;
    readonly packed: number;
    readonly scale: number;
    readonly exposed: number;
  } | null;
  /** A FROZEN RIVER (R21) across the basin: its width band, m, how deep its
   * bed is cut under the country along its line, m, and how far its line
   * swings either side of straight, m. Null: no river. */
  readonly river: {
    readonly width: Band;
    readonly depth: number;
    readonly swing: Band;
  } | null;
};

/** Every region's row. */
export const REGIONS: Readonly<Record<RegionId, Region>> = {
  // THE BOREAL FOREST: the rules as written. Rolling hills in a basin of
  // mountains, dense spruce, open powder meadows. All ones, nothing laid.
  boreal: {
    id: "boreal",
    relief: {
      hills: 1,
      ridges: 1,
      mountain: 1,
      crests: 1,
      tilt: 1,
      bowls: { count: 1, radius: 1, depth: 1 },
    },
    forest: {
      density: 1,
      meadow: 1,
      height: 1,
      treeLine: 1,
      lowland: null,
      // A northern forest: mostly spruce, pine on the drier ground, a
      // birch or a larch among them, the odd fir.
      roster: [
        { kind: "spruce", share: 0.36 },
        { kind: "pine", share: 0.14 },
        { kind: "birch", share: 0.08 },
        { kind: "blackspruce", share: 0.07 },
        { kind: "aspen", share: 0.05 },
        { kind: "lodgepole", share: 0.04 },
        { kind: "larch", share: 0.04 },
        { kind: "fir", share: 0.04 },
        { kind: "rowan", share: 0.03 },
        { kind: "alder", share: 0.03 },
        { kind: "juniper", share: 0.03 },
        { kind: "snag", share: 0.03 },
        { kind: "willow", share: 0.02 },
        { kind: "whitepine", share: 0.02 },
        { kind: "hemlock", share: 0.02 },
      ],
    },
    kickers: 1,
    sun: { latitude: R.sun.latitude, dayOfYear: R.sun.dayOfYear },
    crust: null,
    river: null,
  },
  // THE HIGH ALPINE: above the tree line. A basin at the head of a range —
  // the flanks half as high again and sharper, the floor heaved into
  // steeper hills and ridges, bigger and deeper bowls (a cirque's floor is
  // a bowl), and the woods only in the hollows, stunted. Wind-scoured crust
  // on every exposed crest and in broad patches between, powder in the
  // lee. Lower latitudes than the boreal, where the snow is high country's
  // rather than the north's, and later in the winter.
  alpine: {
    id: "alpine",
    relief: {
      hills: 1.45,
      ridges: 1.9,
      mountain: 1.7,
      crests: 2,
      tilt: 1.3,
      bowls: { count: 1.4, radius: 1.25, depth: 2 },
    },
    forest: {
      density: 0.45,
      meadow: 0.4,
      height: 0.55,
      treeLine: 0.5,
      lowland: -4,
      // The timberline's own: fir and spruce, the larch that turns gold
      // and drops, a stone pine on the ridges.
      roster: [
        { kind: "fir", share: 0.22 },
        { kind: "spruce", share: 0.18 },
        { kind: "larch", share: 0.16 },
        { kind: "stonepine", share: 0.14 },
        { kind: "dwarfpine", share: 0.1 },
        { kind: "beech", share: 0.05 },
        { kind: "maple", share: 0.05 },
        { kind: "pine", share: 0.04 },
        { kind: "rowan", share: 0.03 },
        { kind: "snag", share: 0.03 },
      ],
    },
    kickers: 1.5,
    sun: { latitude: { min: 42, max: 48 }, dayOfYear: { min: 30, max: 90 } },
    crust: { cover: 0.3, packed: 0.55, scale: 110, exposed: 0.9 },
    river: null,
  },
  // THE TUNDRA PLATEAU: flat, open and fast. The floor barely rolls, the
  // rim is a low line of hills on the horizon, and nothing grows but the
  // odd stunted spruce in a hollow — a sightline across the whole basin.
  // The wind owns it: a crust over most of the country, carved into
  // sastrugi (the look is `region-look.ts`'s), fast to ride. Far north, so
  // ridden in the late winter when the sun is back.
  tundra: {
    id: "tundra",
    relief: {
      hills: 0.32,
      ridges: 0.35,
      mountain: 0.45,
      crests: 0.45,
      tilt: 0.45,
      bowls: { count: 0.6, radius: 1.2, depth: 0.45 },
    },
    forest: {
      density: 0.035,
      meadow: 0.3,
      height: 0.12,
      treeLine: 0.6,
      lowland: 1,
      // The forest-tundra's last trees: stunted spruce and mountain birch.
      roster: [
        { kind: "spruce", share: 0.35 },
        { kind: "birch", share: 0.25 },
        { kind: "blackspruce", share: 0.15 },
        { kind: "willow", share: 0.1 },
        { kind: "juniper", share: 0.08 },
        { kind: "dwarfpine", share: 0.04 },
        { kind: "snag", share: 0.03 },
      ],
    },
    kickers: 0.8,
    sun: { latitude: { min: 66, max: 71 }, dayOfYear: { min: 72, max: 105 } },
    crust: { cover: 0.65, packed: 0.6, scale: 160, exposed: 1 },
    river: null,
  },
  // THE BIRCH VALLEY: a softer, lower country of pale birch — thinner woods
  // than the boreal's with a spruce standing dark among them here and
  // there — and a RIVER frozen across the basin, its bed a flat road of
  // ice between low banks: a natural track, and a fast, slippery one. A
  // light crust in the open.
  birch: {
    id: "birch",
    relief: {
      hills: 0.8,
      ridges: 0.7,
      mountain: 0.85,
      crests: 0.8,
      tilt: 0.8,
      bowls: { count: 1, radius: 1, depth: 0.8 },
    },
    forest: {
      density: 0.55,
      meadow: 2.5,
      height: 0.85,
      treeLine: 1.1,
      lowland: null,
      roster: [
        { kind: "birch", share: 0.66 },
        { kind: "aspen", share: 0.08 },
        { kind: "alder", share: 0.05 },
        { kind: "spruce", share: 0.05 },
        { kind: "willow", share: 0.05 },
        { kind: "rowan", share: 0.04 },
        { kind: "pine", share: 0.04 },
        { kind: "ash", share: 0.03 },
      ],
    },
    kickers: 1,
    sun: { latitude: { min: 58, max: 67 }, dayOfYear: { min: 40, max: 85 } },
    crust: { cover: 0.18, packed: 0.4, scale: 90, exposed: 0.3 },
    river: { width: { min: 16, max: 26 }, depth: 3, swing: { min: 60, max: 130 } },
  },
};

/** The regions in the order a card offers them. */
export const REGION_IDS: readonly RegionId[] = ["boreal", "alpine", "tundra", "birch"];

/** The region a map nobody asked a region of is built in. */
export const DEFAULT_REGION: RegionId = "boreal";

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}

/** The row for a region id; the boreal's for anything else. */
export function regionRow(id: RegionId | undefined): Region {
  return (id !== undefined && REGIONS[id]) || REGIONS[DEFAULT_REGION];
}

/** The region a map was built in — the boreal for a hand-built map without
 * one. Ask this, never `Level.region`. */
export function regionOf(level: { region?: RegionId }): Region {
  return regionRow(level.region);
}

/** A band scaled by `k`, the SAME object when `k` is one. */
export function scaleBand(band: Band, k: number): Band {
  return k === 1 ? band : { min: band.min * k, max: band.max * k };
}

/** A whole-number band scaled by `k` and rounded, the same object at one. */
export function scaleCount(band: Band, k: number): Band {
  return k === 1
    ? band
    : { min: Math.max(0, Math.round(band.min * k)), max: Math.max(0, Math.round(band.max * k)) };
}

/** WHICH TREE STANDS HERE, off a hash of where it stands — no draw off any
 * stream, so the roster moves nothing the forest draws. */
export function treeKindAt(region: Region, x: number, z: number): TreeKind {
  const roster = region.forest.roster;
  if (roster.length === 1) return roster[0].kind;
  let h = (Math.round(x * 8) * 374761393 + Math.round(z * 8) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  let acc = 0;
  for (const row of roster) {
    acc += row.share;
    if (u < acc) return row.kind;
  }
  return roster[roster.length - 1].kind;
}
