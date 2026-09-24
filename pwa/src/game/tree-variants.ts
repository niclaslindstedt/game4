// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, AS DATA — ten VARIANTS of every kind that grows (`TreeKind`,
// R14/R21), each a row of numbers the builder (`tree-shapes.ts`) turns into
// a mesh, and the SILHOUETTE every one of them has (`crownAt`), which the
// forest lab (`scripts/forest-lab.mjs`) reads to say how far a rider sees
// into a wood. Three-free, so the suite and the lab read every row.
//
// WHY TEN, AND WHY THESE. A wood drawn with one tree copied reads as one
// tree copied, however it is turned and tinted — the eye finds the repeat
// in a second. What makes a real northern wood read as grown is the SPREAD
// inside a kind, and each kind's ten are the shapes it actually takes:
//
//   SPRUCE (the northern spruce, the boreal's own): the dense spire down to the
//     snow, the narrow "pencil" of the far north that sheds its load, the
//     SNOW GHOST bowed under a winter's rime, the self-pruned stand tree
//     whose lower boughs died in the shade (the one you SEE UNDER), the
//     wind-flagged edge tree with its boughs on the lee side, the one whose
//     top broke off in a storm and left a dead spire, a young broad one, a
//     gap-toothed one missing whorls, a leaning one on a slope, and the
//     twin-topped.
//   FIR (subalpine and silver fir): the columnar candle the timberline
//     grows, heavier-laden and flatter-tiered than a spruce, the old silver
//     fir's flat "stork's nest" top, a krummholz skirt layered on the snow.
//   PINE (the northern pine): the tree a wood is SEEN THROUGH — a tall bare trunk,
//     orange up where the bark is thin, under a flat crown of separate pads
//     each with its own cap of snow; a young one still conical, a
//     lightning-kinked one, an umbrella, a lone windswept one.
//   LARCH: the conifer that drops its needles — in winter a grey-brown
//     skeleton of drooping whorls with a little snow in the crooks, nearly
//     transparent against the wood behind it.
//   BIRCH (downy and mountain birch): a pale banded trunk (or two, or three
//     off one root, the mountain birch's way) under a bare purple-brown
//     crown, teardrop or weeping.
//
// Which variant stands where is a hash of the trunk's place (`variantAt`),
// a different one from the hash that turns and tints it, so a variant is
// never tied to a heading.

import type { TreeKind } from "@engine";

/** How many variants every kind has. */
export const VARIANTS = 10;

/** A conifer as a stack of drooping skirts (spruce, fir). */
export type ConiferForm = {
  readonly form: "conifer";
  /** How many tiers of boughs, and how many boughs a tier. */
  readonly tiers: number;
  readonly sides: number;
  /** How the tiers narrow up the tree (1 a straight cone, over 1 a spire). */
  readonly taper: number;
  /** How much of a bough carries snow, 0..1, and how far the tiers droop
   * under it (1 the builder's own). */
  readonly snow: number;
  readonly droop: number;
  /** The boughs pushed to one side, 0 round … 1 all on the lee — a flagged
   * tree at a wood's edge. */
  readonly flag: number;
  /** Tiers left out (indices from the bottom) — whorls lost. */
  readonly missing: readonly number[];
  /** The top tiers FLATTENED, 0 a spire … 1 a flat top (the old fir's
   * stork's nest). */
  readonly flat: number;
  /** A second, smaller spire off the top (a twin-topped tree). */
  readonly twin: boolean;
  /** A dead spire above the top tier, as a share of the height (0: none). */
  readonly spire: number;
  /** The lowest tier's extra spread across the snow (a krummholz skirt). */
  readonly skirt: number;
};

/** A pine: a bare trunk under a flat crown of separate pads. */
export type PineForm = {
  readonly form: "pine";
  /** How many pads the crown is, and how far off the trunk they reach
   * (share of the crown radius). */
  readonly pads: number;
  readonly spread: number;
  /** A pad's thickness as a share of the height. */
  readonly thick: number;
  /** How much of a pad's top carries snow, 0..1. */
  readonly snow: number;
  /** A kink in the trunk at this share of the height, sideways by `kinkBy`
   * of the crown radius (0: straight). */
  readonly kink: number;
  readonly kinkBy: number;
  /** A young pine is still a cone of whorls; 0 old and flat … 1 young. */
  readonly young: number;
};

/** A larch in winter: a skeleton of drooping whorls. */
export type LarchForm = {
  readonly form: "larch";
  readonly whorls: number;
  /** Branches a whorl, and how far they droop at the tip, 0..1. */
  readonly arms: number;
  readonly droop: number;
  readonly snow: number;
};

/** A birch in winter: pale stems under a bare crown of twigs. */
export type BirchForm = {
  readonly form: "birch";
  /** How many stems off one root (the mountain birch grows two or three),
   * and how far they splay, rad. */
  readonly stems: number;
  readonly splay: number;
  /** Twig sprays the crown is made of, and how far their tips hang (0
   * reaching up … 1 weeping). */
  readonly fins: number;
  readonly weep: number;
  readonly snow: number;
};

export type TreeForm = ConiferForm | PineForm | LarchForm | BirchForm;

export type TreeVariant = {
  readonly kind: TreeKind;
  readonly index: number;
  /** What the sheet calls it. */
  readonly name: string;
  /** Where the foliage (or the bare crown) starts and ends, shares of the
   * height: under `base` a rider sees the trunk and nothing else. */
  readonly base: number;
  readonly top: number;
  /** The crown's widest, as a share of the tree's crown radius. */
  readonly width: number;
  /** How the crown's radius goes from `base` to `top`: 1 a cone, over 1 a
   * spire (the conifers); a pine's and a birch's are their own. */
  readonly taper: number;
  /** How much of what is behind the crown it hides, 0..1 — a spruce is a
   * wall of needles, a larch in winter a lattice. */
  readonly opacity: number;
  /** The whole tree leaned off plumb, rad. */
  readonly lean: number;
  readonly shape: TreeForm;
};

const conifer = (o: Partial<ConiferForm>): ConiferForm => ({
  form: "conifer",
  tiers: 8,
  sides: 9,
  taper: 1.1,
  snow: 0.45,
  droop: 1,
  flag: 0,
  missing: [],
  flat: 0,
  twin: false,
  spire: 0,
  skirt: 0,
  ...o,
});

type Row = Omit<TreeVariant, "kind" | "index">;

const SPRUCE: readonly Row[] = [
  {
    name: "dense spire",
    base: 0.08,
    top: 1,
    width: 1,
    taper: 1.1,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 9 }),
  },
  {
    name: "pencil",
    base: 0.1,
    top: 1,
    width: 0.62,
    taper: 1.35,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 12, sides: 8, taper: 1.35, snow: 0.3 }),
  },
  {
    name: "snow ghost",
    base: 0.06,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 7, snow: 0.95, droop: 1.8, taper: 1 }),
  },
  {
    name: "stand tree",
    base: 0.3,
    top: 1,
    width: 0.85,
    taper: 1.15,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 7, taper: 1.15 }),
  },
  {
    name: "flagged",
    base: 0.12,
    top: 1,
    width: 0.95,
    taper: 1.1,
    opacity: 0.9,
    lean: 0.02,
    shape: conifer({ tiers: 9, flag: 0.7, snow: 0.35 }),
  },
  {
    name: "storm-broken",
    base: 0.1,
    top: 0.86,
    width: 0.95,
    taper: 0.9,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 7, taper: 0.9, spire: 0.14 }),
  },
  {
    name: "young broad",
    base: 0.03,
    top: 1,
    width: 1,
    taper: 0.85,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 6, sides: 8, taper: 0.85, snow: 0.6 }),
  },
  {
    name: "gap-toothed",
    base: 0.14,
    top: 1,
    width: 0.9,
    taper: 1.1,
    opacity: 0.8,
    lean: 0,
    shape: conifer({ tiers: 10, missing: [2, 5, 6] }),
  },
  {
    name: "leaning",
    base: 0.12,
    top: 1,
    width: 0.9,
    taper: 1.2,
    opacity: 1,
    lean: 0.07,
    shape: conifer({ tiers: 9, taper: 1.2 }),
  },
  {
    name: "twin-topped",
    base: 0.2,
    top: 1,
    width: 0.9,
    taper: 1,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 8, taper: 1, twin: true, snow: 0.55 }),
  },
];

const FIR: readonly Row[] = [
  {
    name: "candle",
    base: 0.06,
    top: 1,
    width: 0.55,
    taper: 1.6,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 11, sides: 8, taper: 1.6, snow: 0.7 }),
  },
  {
    name: "laden candle",
    base: 0.05,
    top: 1,
    width: 0.6,
    taper: 1.5,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 9, sides: 8, taper: 1.5, snow: 0.95, droop: 1.5 }),
  },
  {
    name: "silver fir",
    base: 0.15,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 7, taper: 1, snow: 0.75 }),
  },
  {
    name: "stork's nest",
    base: 0.32,
    top: 0.97,
    width: 0.9,
    taper: 0.55,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 6, taper: 0.55, flat: 0.8, snow: 0.85 }),
  },
  {
    name: "stand fir",
    base: 0.28,
    top: 1,
    width: 0.7,
    taper: 1.3,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 8, sides: 8, taper: 1.3, snow: 0.7 }),
  },
  {
    name: "young fir",
    base: 0.02,
    top: 1,
    width: 0.85,
    taper: 1,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 6, sides: 8, taper: 1, snow: 0.8 }),
  },
  {
    name: "wind-leaned",
    base: 0.08,
    top: 1,
    width: 0.65,
    taper: 1.4,
    opacity: 1,
    lean: 0.06,
    shape: conifer({ tiers: 9, sides: 8, taper: 1.4, flag: 0.45, snow: 0.6 }),
  },
  {
    name: "flagged fir",
    base: 0.1,
    top: 1,
    width: 0.7,
    taper: 1.3,
    opacity: 0.85,
    lean: 0,
    shape: conifer({ tiers: 9, sides: 8, taper: 1.3, flag: 0.85, snow: 0.5 }),
  },
  {
    name: "needle",
    base: 0.08,
    top: 1,
    width: 0.42,
    taper: 1.9,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 13, sides: 7, taper: 1.9, snow: 0.65 }),
  },
  {
    name: "krummholz skirt",
    base: 0.0,
    top: 1,
    width: 0.75,
    taper: 1.5,
    opacity: 1,
    lean: 0,
    shape: conifer({ tiers: 8, sides: 9, taper: 1.5, skirt: 0.45, snow: 0.8 }),
  },
];

const pine = (o: Partial<PineForm>): PineForm => ({
  form: "pine",
  pads: 5,
  spread: 0.8,
  thick: 0.1,
  snow: 0.6,
  kink: 0,
  kinkBy: 0,
  young: 0,
  ...o,
});

const PINE: readonly Row[] = [
  {
    name: "old pine",
    base: 0.62,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.8,
    lean: 0,
    shape: pine({ pads: 6 }),
  },
  {
    name: "umbrella",
    base: 0.72,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.8,
    lean: 0,
    shape: pine({ pads: 5, spread: 0.95, thick: 0.06 }),
  },
  {
    name: "tall stand pine",
    base: 0.7,
    top: 1,
    width: 0.7,
    taper: 1,
    opacity: 0.75,
    lean: 0,
    shape: pine({ pads: 4, spread: 0.6 }),
  },
  {
    name: "young pine",
    base: 0.2,
    top: 1,
    width: 0.8,
    taper: 1,
    opacity: 0.85,
    lean: 0,
    shape: pine({ pads: 7, spread: 0.7, young: 1, snow: 0.6 }),
  },
  {
    name: "half-grown",
    base: 0.42,
    top: 1,
    width: 0.85,
    taper: 1,
    opacity: 0.8,
    lean: 0,
    shape: pine({ pads: 6, spread: 0.75, young: 0.5 }),
  },
  {
    name: "kinked",
    base: 0.6,
    top: 1,
    width: 0.9,
    taper: 1,
    opacity: 0.8,
    lean: 0,
    shape: pine({ pads: 5, kink: 0.45, kinkBy: 0.35 }),
  },
  {
    name: "windswept",
    base: 0.55,
    top: 0.98,
    width: 1,
    taper: 1,
    opacity: 0.75,
    lean: 0.08,
    shape: pine({ pads: 4, spread: 1, thick: 0.05 }),
  },
  {
    name: "laden pine",
    base: 0.58,
    top: 1,
    width: 0.95,
    taper: 1,
    opacity: 0.85,
    lean: 0,
    shape: pine({ pads: 7, thick: 0.09, snow: 1 }),
  },
  {
    name: "sparse pine",
    base: 0.66,
    top: 1,
    width: 0.85,
    taper: 1,
    opacity: 0.6,
    lean: 0.02,
    shape: pine({ pads: 3, spread: 0.85, snow: 0.5 }),
  },
  {
    name: "twin-crowned",
    base: 0.55,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.8,
    lean: 0,
    shape: pine({ pads: 8, spread: 0.9, kink: 0.62, kinkBy: 0.15 }),
  },
];

const larch = (o: Partial<LarchForm>): LarchForm => ({
  form: "larch",
  whorls: 9,
  arms: 5,
  droop: 0.5,
  snow: 0.35,
  ...o,
});

const LARCH: readonly Row[] = [
  {
    name: "larch",
    base: 0.12,
    top: 1,
    width: 0.9,
    taper: 1.1,
    opacity: 0.35,
    lean: 0,
    shape: larch({}),
  },
  {
    name: "weeping larch",
    base: 0.1,
    top: 1,
    width: 0.95,
    taper: 1,
    opacity: 0.4,
    lean: 0,
    shape: larch({ droop: 0.9, arms: 6 }),
  },
  {
    name: "slender larch",
    base: 0.2,
    top: 1,
    width: 0.6,
    taper: 1.3,
    opacity: 0.3,
    lean: 0,
    shape: larch({ whorls: 11, arms: 4 }),
  },
  {
    name: "old larch",
    base: 0.35,
    top: 1,
    width: 1,
    taper: 0.8,
    opacity: 0.35,
    lean: 0,
    shape: larch({ whorls: 7, arms: 6, droop: 0.7 }),
  },
  {
    name: "young larch",
    base: 0.05,
    top: 1,
    width: 0.75,
    taper: 1,
    opacity: 0.3,
    lean: 0,
    shape: larch({ whorls: 8, arms: 4, droop: 0.2 }),
  },
  {
    name: "rimed larch",
    base: 0.12,
    top: 1,
    width: 0.85,
    taper: 1.1,
    opacity: 0.45,
    lean: 0,
    shape: larch({ snow: 0.85 }),
  },
  {
    name: "leaning larch",
    base: 0.15,
    top: 1,
    width: 0.85,
    taper: 1.1,
    opacity: 0.35,
    lean: 0.07,
    shape: larch({ whorls: 9, arms: 5 }),
  },
  {
    name: "sparse larch",
    base: 0.25,
    top: 1,
    width: 0.9,
    taper: 1,
    opacity: 0.25,
    lean: 0,
    shape: larch({ whorls: 6, arms: 4, droop: 0.6 }),
  },
  {
    name: "dense larch",
    base: 0.08,
    top: 1,
    width: 0.85,
    taper: 1.2,
    opacity: 0.5,
    lean: 0,
    shape: larch({ whorls: 12, arms: 6, droop: 0.4 }),
  },
  {
    name: "stag-headed",
    base: 0.2,
    top: 0.9,
    width: 0.9,
    taper: 0.9,
    opacity: 0.35,
    lean: 0.02,
    shape: larch({ whorls: 8, arms: 5, droop: 0.3, snow: 0.2 }),
  },
];

const birch = (o: Partial<BirchForm>): BirchForm => ({
  form: "birch",
  stems: 1,
  splay: 0,
  fins: 52,
  weep: 0.2,
  snow: 0.6,
  ...o,
});

const BIRCH: readonly Row[] = [
  {
    name: "downy birch",
    base: 0.35,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.3,
    lean: 0,
    shape: birch({}),
  },
  {
    name: "weeping birch",
    base: 0.3,
    top: 1,
    width: 0.95,
    taper: 1,
    opacity: 0.35,
    lean: 0,
    shape: birch({ weep: 0.85, fins: 60 }),
  },
  {
    name: "twin-stemmed",
    base: 0.35,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.3,
    lean: 0,
    shape: birch({ stems: 2, splay: 0.14, fins: 56 }),
  },
  {
    name: "mountain birch",
    base: 0.22,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.35,
    lean: 0,
    shape: birch({ stems: 3, splay: 0.28, fins: 60, weep: 0.35 }),
  },
  {
    name: "slender birch",
    base: 0.45,
    top: 1,
    width: 0.6,
    taper: 1,
    opacity: 0.25,
    lean: 0,
    shape: birch({ fins: 40 }),
  },
  {
    name: "broad birch",
    base: 0.3,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.35,
    lean: 0,
    shape: birch({ fins: 64, weep: 0.45 }),
  },
  {
    name: "leaning birch",
    base: 0.35,
    top: 1,
    width: 0.9,
    taper: 1,
    opacity: 0.3,
    lean: 0.09,
    shape: birch({ fins: 48 }),
  },
  {
    name: "rimed birch",
    base: 0.35,
    top: 1,
    width: 0.95,
    taper: 1,
    opacity: 0.4,
    lean: 0,
    shape: birch({ fins: 56, snow: 1 }),
  },
  {
    name: "young birch",
    base: 0.2,
    top: 1,
    width: 0.7,
    taper: 1,
    opacity: 0.25,
    lean: 0,
    shape: birch({ fins: 34, weep: 0.1 }),
  },
  {
    name: "splayed clump",
    base: 0.25,
    top: 1,
    width: 1,
    taper: 1,
    opacity: 0.35,
    lean: 0,
    shape: birch({ stems: 3, splay: 0.4, fins: 58, weep: 0.6 }),
  },
];

const table = (kind: TreeKind, rows: readonly Row[]): readonly TreeVariant[] =>
  rows.map((row, index) => ({ ...row, kind, index }));

/** Every kind's ten. */
export const TREE_VARIANTS: Readonly<Record<TreeKind, readonly TreeVariant[]>> = {
  spruce: table("spruce", SPRUCE),
  fir: table("fir", FIR),
  pine: table("pine", PINE),
  larch: table("larch", LARCH),
  birch: table("birch", BIRCH),
};

/** WHICH VARIANTS SURVIVE A CHEAPER PICTURE: each kind's ten, the most
 * telling first — the FOREST row draws the first `variants` of them
 * (`FOREST_LOOK`), so the lowest rung keeps the spire and the stand tree a
 * rider sees under, and the next the snow ghost and the pencil besides. */
export const VARIANT_ORDER: Readonly<Record<TreeKind, readonly number[]>> = {
  spruce: [0, 3, 2, 1, 6, 8, 4, 9, 5, 7],
  fir: [0, 2, 4, 3, 1, 5, 9, 6, 7, 8],
  pine: [0, 2, 3, 1, 4, 7, 5, 6, 8, 9],
  larch: [0, 1, 3, 2, 4, 5, 6, 7, 8, 9],
  birch: [0, 3, 1, 2, 5, 4, 6, 7, 8, 9],
};

/** A hash of the trunk's place, 0..1 — a different one from the hash that
 * turns and tints the tree. */
export function variantAt(x: number, z: number): number {
  let h = (Math.round(x * 16) * 2654435761 + Math.round(z * 16) * 40503) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The variant a tree of `kind` (a spruce when unsaid) at (x, z) is, when
 * `variants` of each kind are drawn. */
export function treeVariant(
  kind: TreeKind | undefined,
  x: number,
  z: number,
  variants = VARIANTS,
): TreeVariant {
  const k = kind ?? "spruce";
  const n = Math.max(1, Math.min(VARIANTS, Math.round(variants)));
  return TREE_VARIANTS[k][VARIANT_ORDER[k][Math.floor(variantAt(x, z) * n)]];
}

/**
 * THE SILHOUETTE: how wide the crown is at a share `f` of the tree's
 * height, as a share of its crown radius — 0 under the lowest bough (where
 * a rider sees nothing but the trunk) and over the top. What the builder
 * builds, stated once for the lab to ride its eye through.
 */
export function crownAt(v: TreeVariant, f: number): number {
  if (f < v.base || f > v.top) return 0;
  const u = (f - v.base) / Math.max(1e-6, v.top - v.base);
  switch (v.shape.form) {
    case "pine": {
      // A flat crown: widest a third of the way up it, rounded off above
      // and below — or a cone, the younger the pine.
      const flat = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12)), 0.6);
      const cone = 1 - u * 0.95;
      const y = v.shape.young;
      return v.width * (flat * (1 - y) + cone * y);
    }
    case "birch":
      // A teardrop: widest under the middle of the crown.
      return v.width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.8);
    default:
      return v.width * Math.pow(Math.max(0, 1 - u * 0.95), v.taper);
  }
}
