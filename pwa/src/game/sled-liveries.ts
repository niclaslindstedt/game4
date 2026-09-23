// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIVERIES — how a machine is dressed: its paint, the trim its graphics
// are cut in, the dark of its lower panels, its seat, the springs of its
// coil-overs, and the PATTERN the graphics make on the cowl's flanks and
// down the tunnel. A sled is sold in a handful of these per model year, and
// a class has its look: a trail sled's bold two-colour slash, a race sled's
// white plates and numbers, a touring machine's pinstripe on deep paint, a
// work sled's hi-vis. Every machine carries four; the first is its own, the
// one the card shows it in before a rider has picked.
//
// A PATTERN is a set of decals stated in the cowl's own flank, u from its
// tail (0) to its nose (1), v from the line the paint starts at (0) to the
// crown (1) — so one pattern fits every traced cowl — plus whether a band
// runs down the tunnel's flank and whether it carries race plates.
//
// Three-free and DOM-free: the builder (`sled-body.ts`) lays the decals, the
// sled card (`menu-sled.tsx`) shows the swatches, and `settings.ts` keeps
// the pick; `tests/livery_test.ts` holds the table.

import type { SledId } from "@engine";

export type PatternId = "stripe" | "twin" | "swoosh" | "split" | "chevron" | "race";

export type Livery = {
  /** The name on the swatch. */
  name: string;
  /** The paint, the graphics' trim, the lower panels' dark, the seat and
   * the springs — colours as hex. */
  body: number;
  trim: number;
  panel: number;
  seat: number;
  spring: number;
  pattern: PatternId;
};

type UV = [number, number];

export type Pattern = {
  /** Decals on the cowl's flank, each a closed outline in (u, v). */
  cowl: UV[][];
  /** A TWO-TONE cut: the painted cowl forward of the line from the first
   * point to the second is laid in the trim, cut to the cowl's own outline. */
  split?: [UV, UV];
  /** A band down the tunnel's flank, under its top edge. */
  tunnel: boolean;
  /** Race plates on the cowl's flanks and nose. */
  plates: boolean;
};

export const PATTERNS: Record<PatternId, Pattern> = {
  // One band along the flank, rising a little to the nose.
  stripe: {
    cowl: [
      [
        [0.06, 0.34],
        [0.9, 0.5],
        [0.9, 0.62],
        [0.06, 0.46],
      ],
    ],
    tunnel: true,
    plates: false,
  },
  // Twin race stripes.
  twin: {
    cowl: [
      [
        [0.06, 0.3],
        [0.9, 0.44],
        [0.9, 0.52],
        [0.06, 0.38],
      ],
      [
        [0.06, 0.46],
        [0.9, 0.6],
        [0.9, 0.68],
        [0.06, 0.54],
      ],
    ],
    tunnel: true,
    plates: false,
  },
  // The slash: an angular blade up the flank to the nose.
  swoosh: {
    cowl: [
      [
        [0.02, 0.08],
        [0.5, 0.18],
        [0.94, 0.72],
        [0.78, 0.74],
        [0.42, 0.38],
        [0.02, 0.3],
      ],
    ],
    tunnel: true,
    plates: false,
  },
  // Two-tone: the nose in the trim, cut on a rake.
  split: {
    cowl: [],
    split: [
      [0.5, 0.0],
      [0.74, 1.0],
    ],
    tunnel: false,
    plates: false,
  },
  // Chevrons pointing forward.
  chevron: {
    cowl: [0.3, 0.52, 0.74].map((u): UV[] => [
      [u, 0.18],
      [u + 0.12, 0.45],
      [u, 0.72],
      [u - 0.07, 0.72],
      [u + 0.05, 0.45],
      [u - 0.07, 0.18],
    ]),
    tunnel: false,
    plates: false,
  },
  // A race scheme: a wide band and the plates.
  race: {
    cowl: [
      [
        [0.04, 0.05],
        [0.96, 0.18],
        [0.96, 0.34],
        [0.04, 0.22],
      ],
    ],
    tunnel: true,
    plates: true,
  },
};

const BLACK = 0x17191c;
const SEAT = 0x26292e;

export const LIVERIES: Record<SledId, readonly Livery[]> = {
  fox: [
    {
      name: "Ember",
      body: 0xd5361f,
      trim: 0xf2f2f2,
      panel: BLACK,
      seat: SEAT,
      spring: 0xd5361f,
      pattern: "swoosh",
    },
    {
      name: "Frost",
      body: 0xeef1f4,
      trim: 0xd5361f,
      panel: 0x2b2f35,
      seat: SEAT,
      spring: 0xd5361f,
      pattern: "split",
    },
    {
      name: "Slate",
      body: 0x3b4149,
      trim: 0xb6e02a,
      panel: BLACK,
      seat: SEAT,
      spring: 0xb6e02a,
      pattern: "stripe",
    },
    {
      name: "Lake",
      body: 0x2a67c8,
      trim: 0xf2f2f2,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf2f2f2,
      pattern: "twin",
    },
  ],
  hare: [
    {
      name: "Pollen",
      body: 0xf2c21b,
      trim: 0x17191c,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf2c21b,
      pattern: "twin",
    },
    {
      name: "Blaze",
      body: 0xf0661a,
      trim: 0x17191c,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf0661a,
      pattern: "swoosh",
    },
    {
      name: "Ghost",
      body: 0xe9ecef,
      trim: 0x17191c,
      panel: 0x30343a,
      seat: SEAT,
      spring: 0x17191c,
      pattern: "stripe",
    },
    {
      name: "Moss",
      body: 0x3f8f3a,
      trim: 0xe9ecef,
      panel: BLACK,
      seat: SEAT,
      spring: 0x3f8f3a,
      pattern: "chevron",
    },
  ],
  ibex: [
    {
      name: "Ridge",
      body: 0xf07a1a,
      trim: 0x565d66,
      panel: 0x2b2f35,
      seat: SEAT,
      spring: 0xf07a1a,
      pattern: "split",
    },
    {
      name: "Glacier",
      body: 0x1ea5a8,
      trim: 0xf2f2f2,
      panel: BLACK,
      seat: SEAT,
      spring: 0x1ea5a8,
      pattern: "swoosh",
    },
    {
      name: "Lichen",
      body: 0x9fce2a,
      trim: 0x17191c,
      panel: BLACK,
      seat: SEAT,
      spring: 0x9fce2a,
      pattern: "chevron",
    },
    {
      name: "Dusk",
      body: 0x6a3fb0,
      trim: 0xc8ccd2,
      panel: BLACK,
      seat: SEAT,
      spring: 0xc8ccd2,
      pattern: "stripe",
    },
  ],
  stoat: [
    {
      name: "Holeshot",
      body: 0xf2f3f5,
      trim: 0xd5361f,
      panel: BLACK,
      seat: 0xd5361f,
      spring: 0xd5361f,
      pattern: "race",
    },
    {
      name: "Podium",
      body: 0x1d2024,
      trim: 0xf2c21b,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf2c21b,
      pattern: "race",
    },
    {
      name: "Factory",
      body: 0xd5361f,
      trim: 0xf2f3f5,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf2f3f5,
      pattern: "race",
    },
    {
      name: "Neon",
      body: 0x39d353,
      trim: 0x17191c,
      panel: BLACK,
      seat: SEAT,
      spring: 0x17191c,
      pattern: "swoosh",
    },
  ],
  bison: [
    {
      name: "Midnight",
      body: 0x1c2f5a,
      trim: 0xc7ccd3,
      panel: BLACK,
      seat: SEAT,
      spring: 0xc7ccd3,
      pattern: "stripe",
    },
    {
      name: "Wine",
      body: 0x6b1a24,
      trim: 0xc7ccd3,
      panel: BLACK,
      seat: SEAT,
      spring: 0xc7ccd3,
      pattern: "twin",
    },
    {
      name: "Graphite",
      body: 0x4a4f57,
      trim: 0xd8a931,
      panel: BLACK,
      seat: SEAT,
      spring: 0xd8a931,
      pattern: "split",
    },
    {
      name: "Pearl",
      body: 0xe7e5df,
      trim: 0x2a67c8,
      panel: 0x2b2f35,
      seat: SEAT,
      spring: 0x2a67c8,
      pattern: "swoosh",
    },
  ],
  beaver: [
    {
      name: "Spruce",
      body: 0x2d5a34,
      trim: 0xe9ecef,
      panel: BLACK,
      seat: SEAT,
      spring: 0xe9ecef,
      pattern: "stripe",
    },
    {
      name: "Signal",
      body: 0xf2d21b,
      trim: 0x3b4149,
      panel: 0x2b2f35,
      seat: SEAT,
      spring: 0x3b4149,
      pattern: "chevron",
    },
    {
      name: "Peat",
      body: 0x8a6a45,
      trim: 0x2a241e,
      panel: 0x2a241e,
      seat: 0x3a2f25,
      spring: 0xd8a931,
      pattern: "split",
    },
    {
      name: "Rescue",
      body: 0xd5361f,
      trim: 0xf2f2f2,
      panel: BLACK,
      seat: SEAT,
      spring: 0xf2f2f2,
      pattern: "twin",
    },
  ],
};

/** The livery at `index` for a machine, or its own for one out of range. */
export function liveryOf(id: SledId, index: number | undefined): Livery {
  const list = LIVERIES[id];
  return list[index !== undefined && index >= 0 && index < list.length ? Math.floor(index) : 0];
}
