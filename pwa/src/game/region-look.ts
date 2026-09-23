// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REGION'S COUNTRY LOOKS LIKE (R21) — the ground's tones and the
// trees', one row per kind of snow country. Three-free, so the suite reads
// every row (`tests/region_test.ts` holds this table, the grade's and the
// engine's to one list of ids).
//
// The engine says what a region IS — how it stands, what grows, where the
// wind has crusted the snow and where a river froze (`mapgen/regions.ts`,
// `Level.crust`, `Level.ice`); nothing in the engine has an opinion about
// colour. This is the other half: what the snow shader (`snow-glsl.ts`)
// paints the crust and the ice with, whether rock shows through on the
// steep faces, how hard the wind has carved the crust into sastrugi, what
// colour a wood is from far off, and what the trees (`forest.ts`) are
// painted. The whole-frame cast over all of it is `colour-grade.ts`'s.
//
// THE BOREAL ROW IS THE PICTURE AS IT WAS AUTHORED: no rock, no sastrugi,
// the woods' far tint and the needles the palette's own — the shader and
// the forest read it and draw what they always drew.

import type { RegionId } from "@engine";

import { PALETTE } from "../identity.ts";

/** Linear-ish 0..1 RGB, the way `snow-glsl.ts` authors its albedos. */
export type Tone = readonly [number, number, number];

export type RegionLook = {
  /** A wood seen from afar: the ground colour the trees past the draw
   * distance are carried in. */
  readonly forestTint: Tone;
  /** What the wind crust multiplies the snow's albedo by: a wind slab is a
   * touch greyer and bluer than fresh snow, and glossier. */
  readonly crust: Tone;
  /** The river's ice: its colour where it is bare (the snow shader mixes it
   * in by `Level.ice`). */
  readonly ice: Tone;
  /** How hard the wind has carved the crust into SASTRUGI — ridges a hand
   * high running along the prevailing wind — 0 none … 1 all of it. */
  readonly sastrugi: number;
  /** ROCK THROUGH THE SNOW on the steep faces: its tone and the slopes
   * (m per m) it starts showing at and is whole at; null — the snow holds
   * on every face this country has. */
  readonly rock: { readonly tone: Tone; readonly from: number; readonly to: number } | null;
  /** The conifers' needles, lit and in shade. */
  readonly needle: string;
  readonly needleDark: string;
  /** How much snow the boughs carry, 0..1 of the drawn shapes' own. */
  readonly load: number;
  /** A birch's bark and the colour of its bare crown of twigs. */
  readonly bark: string;
  readonly twigs: string;
};

const BOREAL_WOOD: Tone = [0.32, 0.4, 0.38];

export const REGION_LOOKS: Readonly<Record<RegionId, RegionLook>> = {
  boreal: {
    forestTint: BOREAL_WOOD,
    crust: [1, 1, 1],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 0,
    rock: null,
    needle: PALETTE.pine,
    needleDark: PALETTE.pineDark,
    load: 1,
    bark: "#e8e4dc",
    twigs: "#6e5a4c",
  },
  // THE HIGH ALPINE: the crust scoured bright and blue-grey on the crests,
  // and dark rock breaking through the snow on every face too steep to
  // hold it — the cirque walls, the bowls' rims. The few stunted spruce
  // are darker and carry less snow: the wind strips them.
  alpine: {
    forestTint: [0.3, 0.36, 0.36],
    crust: [0.9, 0.94, 1.0],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 0.35,
    rock: { tone: [0.2, 0.2, 0.22], from: 0.55, to: 0.95 },
    needle: "#1e3a2e",
    needleDark: "#10241c",
    load: 0.6,
    bark: "#e8e4dc",
    twigs: "#6e5a4c",
  },
  // THE TUNDRA PLATEAU: nearly all crust, carved hard into sastrugi along
  // the wind, a flat blue-grey where the slab is bare; the odd stunted
  // spruce carries almost no snow.
  tundra: {
    forestTint: [0.36, 0.4, 0.42],
    crust: [0.86, 0.9, 0.97],
    ice: [0.62, 0.78, 0.9],
    sastrugi: 1,
    rock: { tone: [0.3, 0.3, 0.32], from: 0.7, to: 1.2 },
    needle: "#2a4034",
    needleDark: "#16261e",
    load: 0.4,
    bark: "#e8e4dc",
    twigs: "#6e5a4c",
  },
  // THE BIRCH VALLEY: a lighter, browner wood from afar (the bare birch
  // crowns are a purple-brown haze, not a green), the river's ice a clear
  // green-blue swept of snow, and the spruce among the birches the boreal's.
  birch: {
    forestTint: [0.46, 0.42, 0.42],
    crust: [0.94, 0.96, 1.0],
    ice: [0.5, 0.72, 0.8],
    sastrugi: 0,
    rock: null,
    needle: PALETTE.pine,
    needleDark: PALETTE.pineDark,
    load: 0.85,
    bark: "#ebe7df",
    twigs: "#5a4440",
  },
};

export function regionLookOf(region: RegionId): RegionLook {
  return REGION_LOOKS[region] ?? REGION_LOOKS.boreal;
}
