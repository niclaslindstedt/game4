// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PICTURE COSTS — the dictionary between a row of OPTIONS ▸ PICTURE
// and the numbers the renderer builds with. DOM-free and three-free, so
// `tests/video_test.ts` reads the whole ladder without a browser, and
// `renderer.setVideo` is the one place a row becomes a draw call.
//
// EIGHT ROWS, BECAUSE THEY ARE EIGHT DIFFERENT BILLS. A phone can be short
// of pixels and rich in triangles, or the other way round, and one QUALITY
// knob would make it pay for the thing it can afford to save on the thing it
// cannot:
//
//   RESOLUTION  how many pixels: a share of the device's own pixel ratio.
//   DISTANCE    how far out the woods are still drawn as trees, and the haze
//               pulled in to close before them — the one row that changes
//               the WEATHER, which is how the cut-off stays out of sight.
//   TERRAIN     the ground's clipmap (`terrain.ts`): the near grid's pitch
//               and how many cells a level carries. Every stop still reaches
//               past the rim (`TERRAIN_REACH`), so a cheaper ground is a
//               coarser one and never a shorter one.
//   TRAILS      the trail maps (`trail-map.ts`): the fine window's texels and
//               span, the coarse map's texels — or OFF, which stamps nothing
//               and leaves the snow untouched.
//   FOREST      how close a tree is drawn whole (and casts), how far the
//               full-detail band runs, and how many of the far band's sketches
//               stand at all. Never WHICH trunks exist: the physics hits every
//               one of them, and a tree the rider can hit is always drawn.
//   SHADOWS     the key light's shadow map, or none.
//   SPRAY       the share of the roost, the ski spray and the puffs thrown.
//   ANTIALIAS   the canvas's multisampling. The one row that cannot be
//               changed under a running context: it is read when the canvas
//               is made, and the page says so.
//
// Every ladder runs CHEAPEST FIRST, so a rider hunting for frames always
// walks the same way. `VIDEO_PRESETS` are whole pictures a tier at a time —
// what the PRESET row presses and what the first-visit probe hands out
// (`video-probe.ts`) — and `presetOf` reads a picture back as the tier it
// is, or `custom` once any row has been moved off one.

/** A stop on a ladder of costs. */
export type Tier = "low" | "medium" | "high";
export const TIERS: readonly Tier[] = ["low", "medium", "high"];

export type ShadowLevel = "off" | "low" | "high";
export const SHADOW_LEVELS: readonly ShadowLevel[] = ["off", "low", "high"];

export type TrailLevel = "off" | Tier;
export const TRAIL_LEVELS: readonly TrailLevel[] = ["off", ...TIERS];

export type VideoSettings = {
  resolution: Tier;
  distance: Tier;
  terrain: Tier;
  trails: TrailLevel;
  forest: Tier;
  shadows: ShadowLevel;
  spray: Tier;
  antialias: boolean;
};

/* ── What each stop buys ─────────────────────────────────────────────── */

/** RESOLUTION: the share of the device's pixel ratio the canvas is drawn at.
 * The top is the screen's own; the bottom is still more than half of it on
 * each axis, below which the HUD's crisp type sits over a picture that reads
 * as out of focus rather than as cheaper. */
export const RESOLUTION_SHARE: Record<Tier, number> = { low: 0.6, medium: 0.8, high: 1 };

/** How far out every ground reaches, m, whatever its pitch: past the basin's
 * rim from any corner of it, so the mountains are always ground and never a
 * hole with the sky in it. */
export const TERRAIN_REACH = 2800;

export type TerrainLook = {
  /** Cells a side per level (a multiple of 4). */
  n: number;
  /** Level 0's vertex spacing, m. */
  spacing: number;
  /** Levels, each double the last — derived, so every stop reaches
   * `TERRAIN_REACH`. */
  levels: number;
};

const TERRAIN_GRID: Record<Tier, { n: number; spacing: number }> = {
  // A 0.4 m pitch still shows a furrow as a trough, just a blunter one.
  low: { n: 96, spacing: 0.4 },
  medium: { n: 128, spacing: 0.3 },
  // The ground as it was tuned: a quarter-metre under the lens.
  high: { n: 192, spacing: 0.25 },
};

/** The clipmap a TERRAIN stop builds. */
export function terrainLook(tier: Tier): TerrainLook {
  const { n, spacing } = TERRAIN_GRID[tier];
  let levels = 1;
  while ((n / 2) * spacing * 2 ** (levels - 1) < TERRAIN_REACH) levels++;
  return { n, spacing, levels };
}

/** How far out a clipmap's last level reaches, m. */
export function terrainReach(look: TerrainLook): number {
  return (look.n / 2) * look.spacing * 2 ** (look.levels - 1);
}

/** Roughly how many triangles a clipmap draws: level 0 whole, every level
 * after it a ring round the hole the finer one fills. */
export function terrainTriangles(look: TerrainLook): number {
  const full = 2 * look.n * look.n;
  const hole = look.n / 2 - 2;
  const ring = full - 2 * hole * hole;
  return full + (look.levels - 1) * ring;
}

export type TrailLook = {
  /** Whether a contact is stamped at all. */
  stamp: boolean;
  /** Fine window: texels a side, and metres a side. */
  fineSize: number;
  fineSpan: number;
  /** Coarse map texels a side (it spans the whole map). */
  coarseSize: number;
};

export const TRAIL_LOOK: Record<TrailLevel, TrailLook> = {
  // OFF still builds the smallest maps there are, so the ground's shader has
  // something to read — they are simply never written.
  off: { stamp: false, fineSize: 64, fineSpan: 64, coarseSize: 64 },
  low: { stamp: true, fineSize: 512, fineSpan: 64, coarseSize: 1024 },
  medium: { stamp: true, fineSize: 1024, fineSpan: 96, coarseSize: 1024 },
  high: { stamp: true, fineSize: 2048, fineSpan: 160, coarseSize: 2048 },
};

export type ForestLook = {
  /** Trees nearer than this are drawn whole and cast into the shadow map, m. */
  near: number;
  /** ...and the full-detail tree runs out to here, m. */
  mid: number;
  /** The share of the far band's sketches that stand, 0..1. */
  farShare: number;
};

export const FOREST_LOOK: Record<Tier, ForestLook> = {
  low: { near: 20, mid: 90, farShare: 0.5 },
  medium: { near: 30, mid: 130, farShare: 0.75 },
  high: { near: 45, mid: 160, farShare: 1 },
};

export type DistanceLook = {
  /** How far out a tree is drawn at all, m. Past it the ground's own forest
   * tint (`snow-glsl.ts`) carries the woods to the rim. */
  far: number;
  /** The least the haze may be, 1/m — the sky's own is used where it is
   * thicker. 0 leaves the sky's alone. */
  hazeFloor: number;
};

export const DISTANCE_LOOK: Record<Tier, DistanceLook> = {
  low: { far: 450, hazeFloor: 1 / 520 },
  medium: { far: 700, hazeFloor: 1 / 900 },
  high: { far: 1100, hazeFloor: 0 },
};

/** SHADOWS: the key light's map, texels a side; 0 is no shadow at all. */
export const SHADOW_SIZE: Record<ShadowLevel, number> = { off: 0, low: 1024, high: 2048 };

/** SPRAY: the share of every emission rate, and of the particle pool. */
export const SPRAY_SHARE: Record<Tier, number> = { low: 0.35, medium: 0.65, high: 1 };

/** The haze the renderer draws: the sky's own, or the row's floor, whichever
 * is the thicker. */
export function hazeFor(sky: number, distance: Tier): number {
  return Math.max(sky, DISTANCE_LOOK[distance].hazeFloor);
}

/* ── Whole pictures ──────────────────────────────────────────────────── */

/** A whole picture a tier at a time. ANTIALIAS is not in it: it is a fact
 * about the canvas rather than a cost the probe weighs, and a preset that
 * moved it would be a press that did nothing until the next visit. */
export const VIDEO_PRESETS: Record<Tier, Omit<VideoSettings, "antialias">> = {
  low: {
    resolution: "medium",
    distance: "low",
    terrain: "low",
    trails: "low",
    forest: "low",
    shadows: "off",
    spray: "low",
  },
  medium: {
    resolution: "high",
    distance: "medium",
    terrain: "medium",
    trails: "medium",
    forest: "medium",
    shadows: "low",
    spray: "medium",
  },
  high: {
    resolution: "high",
    distance: "high",
    terrain: "high",
    trails: "high",
    forest: "high",
    shadows: "high",
    spray: "high",
  },
};

/** The picture a first visit opens on: the design point, which the probe
 * then moves up or down once it has timed this machine drawing it. */
export const DEFAULT_VIDEO: VideoSettings = { ...VIDEO_PRESETS.medium, antialias: true };

export type PresetLevel = Tier | "custom";

/** Which preset a picture IS — or `custom` once any row is off every one. */
export function presetOf(video: VideoSettings): PresetLevel {
  for (const tier of TIERS) {
    const p = VIDEO_PRESETS[tier];
    if ((Object.keys(p) as (keyof typeof p)[]).every((k) => p[k] === video[k])) return tier;
  }
  return "custom";
}

/** A picture moved onto a preset, the canvas's antialiasing kept. */
export function withPreset(video: VideoSettings, tier: Tier): VideoSettings {
  return { ...video, ...VIDEO_PRESETS[tier] };
}

/** A stored blob — anything at all — made into a picture this build offers,
 * row by row: a value off a ladder is one no press can walk back from. */
export function mergeVideo(parsed: unknown): VideoSettings {
  const out = { ...DEFAULT_VIDEO };
  if (!parsed || typeof parsed !== "object") return out;
  const blob = parsed as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, ladder: readonly T[], fallback: T): T =>
    typeof value === "string" && ladder.includes(value as T) ? (value as T) : fallback;
  out.resolution = pick(blob.resolution, TIERS, out.resolution);
  out.distance = pick(blob.distance, TIERS, out.distance);
  out.terrain = pick(blob.terrain, TIERS, out.terrain);
  out.trails = pick(blob.trails, TRAIL_LEVELS, out.trails);
  out.forest = pick(blob.forest, TIERS, out.forest);
  out.shadows = pick(blob.shadows, SHADOW_LEVELS, out.shadows);
  out.spray = pick(blob.spray, TIERS, out.spray);
  if (typeof blob.antialias === "boolean") out.antialias = blob.antialias;
  return out;
}
