// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The world generator's RULE BOOK. Every constraint that keeps a generated
// map inside "snowy mountain country" — and every constraint that keeps the
// race loop rideable — lives here as data, separate from the search
// (generate.ts), the shaping (terrain.ts, track.ts, kickers.ts, forest.ts,
// spawn.ts), the compile (compile.ts) and the scoreboard (analysis/). The
// generator BUILDS to these numbers, the analysis HOLDS the finished map to
// the same numbers, and the tests assert directly against them; a number
// changed here changes all three at once, which is the point of stating it
// once.
//
// The rules, in prose (each is realized by the generator, re-checked by
// `analyzeLevel`, and asserted across seeds in tests/mapgen_test.ts;
// docs/level-generator.md carries them verbatim):
//
//   R1  THE WORLD IS A SQUARE. A map is `world.size` (1600 m) on a side,
//       x and z from 0 to that size, with its heights baked once on a grid
//       of `world.cell` (2 m) cells. Nothing is published outside it, and
//       the track, the spawn and the grid stand inside the basin (R2).
//   R2  A BASIN RINGED BY MOUNTAINS. The playable country is a basin round
//       the map's middle. Past `basin.rim.inner` (600 m) from the centre —
//       measured on a rounded square, warped by `basin.rim.warp` of noise so
//       the foot of the range wanders — the ground rises to mountain flanks
//       `basin.mountain` (140–220 m) high by `basin.rim.outer` (780 m), with
//       ridged crests on them. Nothing grows above `forest.treeLine` of the
//       way up the rim (R14): the high flanks are bare snow.
//   R3  ROLLING COUNTRY INSIDE. The basin floor is hills of
//       `hills.amplitude` metres over wavelengths of `hills.scale`, ridges of
//       `ridges.amplitude` metres, the whole floor tilted by up to
//       `tilt.grade` in a seeded direction so a lap climbs one side and
//       runs down the other, and `bowls.count` bowls — round hollows of
//       `bowls.radius` metres radius and `bowls.depth` metres deep.
//   R4  KICKERS OFF THE TRACK. The country carries `kickers.off.count`
//       crests shaped to throw a sled: each stands on a hilltop, rises
//       `kickers.off.height` metres over a ramp of `kickers.off.ramp` metres
//       that is steepest at its lip, and falls away over a landing of
//       `kickers.off.landing` metres. None stands within
//       `kickers.off.clearance` metres of the track's edge, so a kicker is
//       something a rider leaves the loop to find.
//   R5  THE TRACK IS ONE CLOSED LOOP. The race is ridden round a single
//       loop that never crosses itself — a star-shaped loop about a point
//       near the basin's middle, bent by `track.warp` metres of slow noise —
//       whose length lands in `track.length` (2.5–4.0 km), sampled every
//       `track.step` (2 m) along its length.
//       Any two parts of it more than `track.separation.along` metres apart
//       along the loop stand at least `track.separation.plan` metres apart
//       on the map, so no two stretches share a corridor or a bank.
//   R6  NO TURN TIGHTER THAN A SLED CAN CARRY SPEED THROUGH. The radius of
//       every turn, measured over `track.turnWindow` metres of the line, is
//       at least `track.minRadius` (24 m).
//   R7  A WIDE PACKED TRAIL. The track is `track.width` (10–14 m) wide,
//       the width wandering smoothly along the loop over wavelengths of
//       `track.widthScale` metres.
//   R8  THE TRACK IS GRADED INTO THE GROUND. Across its width, and
//       `track.shoulder.flat` metres beyond each edge, the ground is level
//       with the centreline; past that it blends back into the untouched
//       country over a bank at most `track.bank.slope` steep, between
//       `track.bank.min` and `track.bank.max` metres wide. Along the loop
//       the line is smoothed until no `track.gradeWindow` metres of it climb
//       or fall more steeply than `track.maxGrade` (0.22), and no point of
//       it is cut or filled more than `track.maxCut` metres — the
//       kickers of R9 are the only stretches allowed steeper.
//   R9  KICKERS ON THE TRACK. The loop carries `kickers.on.count` (1–3)
//       crests that make jumps: a ramp `kickers.on.ramp` times the lip's
//       height long rising `kickers.on.height` metres to a lip, steepest at
//       the lip, and a landing `kickers.on.landing` times the lip's height
//       long falling away past it. Each
//       stands on a stretch that turns no more than `kickers.on.straight`
//       radians from the foot of its ramp to the end of its landing, where
//       the line comes up to the lip no steeper downhill than
//       `kickers.on.approachGrade` and runs level or downhill past it — a
//       brow before a descent; two stand at least
//       `kickers.on.spacing` metres apart along the loop.
//   R10 PACKED SNOW ON THE TRACK ONLY. `packedAt` is 1 across the track's
//       width and fades to 0 over `track.shoulder.packed` metres beyond each
//       edge — except where R17 drifts it over; everywhere else the snow is
//       virgin powder.
//   R11 CHECKPOINTS EVERY 120–200 m. Checkpoint 0 — the start and finish
//       line — stands at the station R12 chooses, and the loop is
//       re-indexed to begin there, so its arc length is 0. The rest follow
//       in the direction of travel, evenly spaced as near
//       `checkpoint.spacing.target` (150 m) as divides the loop, and never
//       outside `checkpoint.spacing` (120–200 m). A checkpoint spans the
//       track's width plus `checkpoint.margin` metres either side.
//   R12 THE START LINE. The line stands at a seeded station of the loop at
//       least `spawn.kickerGap` metres along it from any kicker's lip, where
//       the loop turns no more than `spawn.straight` radians over the
//       `spawn.run` metres before the line — the stretch the grid stands on
//       — and climbs or falls no more steeply than `spawn.maxSlope` over it.
//   R13 THE GRID ON THE TRACK. The riders stand on the groomer behind the
//       start line, facing along the loop: `grid.slots` (4) of them in rows
//       of `grid.abreast` (2) straddling the centreline `grid.spacing`
//       (5 m) apart, the front row `grid.back` (10 m) behind the line and
//       each row `grid.row` (8 m) behind the one before, the player's slot
//       first in the list — the front row's left. The spawn is the front
//       row's point on the centreline.
//   R14 FORESTS AND MEADOWS. Conifers stand where a slow noise says forest
//       — at most one per `forest.spacing` metre cell, jittered — thinning to
//       `forest.meadow` of that density in the open meadows between, with
//       `forest.clearings.count` round clearings cut out of the woods. A
//       tree is `forest.height` (6–19 m) tall with a trunk of
//       `forest.trunk` and a crown `forest.crown` of its height across, never
//       wider than `forest.crownMax`. No two trunks stand closer than
//       `forest.gap` (9 m), so a sled can be ridden between any two trees.
//       No tree stands within `forest.corridor` metres of the track's edge,
//       on ground steeper than `forest.maxSlope`, above `forest.treeLine` of
//       the way up the rim, or on a kicker.
//   R15 A CLEAR WINTER DAY. The map lies at a seeded latitude in
//       `sun.latitude` (46–64°N) on a seeded day of the year in
//       `sun.dayOfYear` (mid-January to mid-March), and the race starts at a
//       seeded solar hour in `sun.hour` (9–16 h) at which the sun stands at
//       least `sun.minElevation` degrees over the horizon.
//   R16 THREE LAPS. A race is `race.laps` (3) laps of the loop.
//   R17 DRIFTS ACROSS THE TRACK. The wind lays fresh snow over stretches of
//       the groomer. A map is dealt a share of its loop in `drift.share`
//       (0–50 %) to lie drifted, laid as stretches `drift.length` (60–180 m)
//       long, at least `drift.gap` metres apart; across a stretch the
//       packed field — the track's width and its shoulders — falls to
//       `drift.packed` of its groomed value, easing in and out over
//       `drift.fade` metres at either end. No drift lies within
//       `drift.clear` metres of the start line, nor within `drift.fade`
//       metres of a kicker's ramp or landing (R9). The drifts are dealt off
//       a stream of their own, so a map's drifts move nothing else it
//       draws; `Level.drifts` publishes every stretch.

/** A closed band of numbers, inclusive. */
export type Band = { readonly min: number; readonly max: number };

export const LEVEL_RULES = {
  /** R1 — the square. */
  world: {
    /** Side of the map, m. */
    size: 1600,
    /** Heightfield cell, m. */
    cell: 2,
  },
  /** R2 — the basin and its mountains. */
  basin: {
    rim: {
      /** Where the ground starts climbing toward the range, m from centre. */
      inner: 600,
      /** Where the flank reaches its full height, m from centre. */
      outer: 780,
      /** How far noise moves the foot of the range in and out, m. */
      warp: 45,
      /** Exponent of the rounded square the rim is measured on (2 = circle). */
      squareness: 4,
    },
    /** Height of the flanks over the basin floor, m. */
    mountain: { min: 140, max: 220 } as Band,
    /** Ridged crests on the flanks, m at full height. */
    crests: 55,
  },
  /** R3 — the hills. */
  hills: {
    /** Peak-to-trough of the rolling hills, m. */
    amplitude: { min: 30, max: 48 } as Band,
    /** Wavelength of the biggest hills, m. */
    scale: 320,
  },
  /** R3 — the ridges. */
  ridges: {
    amplitude: { min: 6, max: 14 } as Band,
    /** Wavelength, m. */
    scale: 260,
  },
  /** R3 — the floor's tilt, m of fall per m. */
  tilt: { grade: 0.045 },
  /** R3 — the bowls. */
  bowls: {
    count: { min: 2, max: 5 } as Band,
    /** Radius, m. */
    radius: { min: 60, max: 130 } as Band,
    /** Depth at the middle, m. */
    depth: { min: 5, max: 12 } as Band,
  },
  /** R4, R9 — the kickers. */
  kickers: {
    off: {
      count: { min: 5, max: 10 } as Band,
      /** Lip over the surrounding ground, m. */
      height: { min: 2.2, max: 4.5 } as Band,
      /** Ramp length, foot to lip, m. */
      ramp: { min: 16, max: 26 } as Band,
      /** Landing length, lip to foot, m. */
      landing: { min: 28, max: 45 } as Band,
      /** Full-height width across the kicker, m. */
      width: { min: 14, max: 26 } as Band,
      /** Clear ground between the kicker's footprint and the track's edge, m. */
      clearance: 30,
    },
    on: {
      count: { min: 1, max: 3 } as Band,
      /** Lip over the graded line, m. */
      height: { min: 1.4, max: 2.6 } as Band,
      /** Ramp length as a multiple of the lip's height: 2/ratio is the
       * ramp's slope at the lip. */
      ramp: { min: 8, max: 11 } as Band,
      /** Landing length as a multiple of the lip's height: 2/ratio is how
       * steeply it falls away from the lip. */
      landing: { min: 14, max: 20 } as Band,
      /** Most the line may turn from ramp foot to landing foot, rad. */
      straight: 0.3,
      /** Least arc length between two lips, m. */
      spacing: 450,
      /** The line past the lip must run no steeper UP than this … */
      landingGrade: 0.02,
      /** … and the line up to it no steeper DOWN than this. */
      approachGrade: -0.04,
    },
    /** Width over which a kicker's sides blend into the ground, m. */
    edge: 8,
  },
  /** R5–R8, R10 — the loop. */
  track: {
    /** Loop length, m. */
    length: { min: 2500, max: 4000 } as Band,
    /** The band the search AIMS at — inside the rule's, so a draw that
     * lands a little long or short of its aim still passes. */
    aim: { min: 2600, max: 3600 } as Band,
    /** Resampled point spacing, m. */
    step: 2,
    /** The slow noise that bends the harmonic loop: displacement, m, and
     * wavelength, m. */
    warp: {
      amount: { min: 40, max: 110 } as Band,
      scale: { min: 140, max: 240 } as Band,
    },
    separation: {
      /** Least map distance between two parts of the loop, m … */
      plan: 60,
      /** … that are more than this far apart ALONG it, m. */
      along: 160,
    },
    /** Least turn radius, m. */
    minRadius: 24,
    /** Baseline the radius is measured over, m. */
    turnWindow: 10,
    /** Track width, m. */
    width: { min: 10, max: 14 } as Band,
    /** Wavelength of the width's wander, m. */
    widthScale: 220,
    shoulder: {
      /** Level ground beyond each edge, m. */
      flat: 2,
      /** Packed-to-powder fade beyond each edge, m. */
      packed: 5,
    },
    bank: {
      /** Steepest the blend back into the country may be, m per m. */
      slope: 0.45,
      /** Narrowest and widest bank, m. */
      min: 8,
      max: 20,
    },
    /** Steepest the line may climb or fall outside a kicker. */
    maxGrade: 0.22,
    /** Baseline the grade is measured over, m. */
    gradeWindow: 10,
    /** Most the line may sit above or below the untouched country, m. */
    maxCut: 9,
  },
  /** R11 — the checkpoints. */
  checkpoint: {
    spacing: { min: 120, max: 200, target: 150 },
    /** Extra width beyond each track edge, m. */
    margin: 3,
  },
  /** R12 — the start line. */
  spawn: {
    /** Least arc length between the start line and a kicker lip, m. */
    kickerGap: 120,
    /** The stretch before the line the grid stands on, m, the most it may
     * turn over it, rad, and the steepest it may climb or fall. */
    run: 40,
    straight: 0.35,
    maxSlope: 0.12,
  },
  /** R13 — the grid. */
  grid: { slots: 4, abreast: 2, spacing: 5, back: 10, row: 8 },
  /** R14 — the forest. */
  forest: {
    /** Candidate cell, m: at most one tree per cell. */
    spacing: 6,
    /** Wavelength of the forest/meadow noise, m. */
    scale: 240,
    /** Density inside the woods (share of cells with a tree). */
    density: 0.72,
    /** Share of that density out in the meadows. */
    meadow: 0.03,
    clearings: {
      count: { min: 4, max: 9 } as Band,
      /** Radius, m. */
      radius: { min: 25, max: 70 } as Band,
    },
    /** Tree height, m. */
    height: { min: 6, max: 19 } as Band,
    /** Trunk collision radius as a share of height (plus a floor, m). */
    trunk: { share: 0.018, floor: 0.14 },
    /** Crown radius as a share of height, and the most it may spread, m. */
    crown: 0.24,
    crownMax: 3.2,
    /** The least distance between two trunks, m: with two crowns at their
     * widest that leaves a lane of 2.6 m under the boughs, twice a sled's
     * width. */
    gap: 9,
    /** Clear ground between the track's edge and any trunk, m. */
    corridor: 5,
    /** Steepest ground a tree stands on. */
    maxSlope: 0.75,
    /** Share of the way up the rim above which nothing grows. */
    treeLine: 0.6,
  },
  /** R15 — the sun. */
  sun: {
    latitude: { min: 46, max: 64 } as Band,
    /** Day of year (1 = Jan 1). */
    dayOfYear: { min: 15, max: 75 } as Band,
    /** Solar hour. */
    hour: { min: 9, max: 16 } as Band,
    /** Degrees over the horizon at the start. */
    minElevation: 5,
  },
  /** R16 — the race. */
  race: { laps: 3 },
  /** R17 — the drifts. */
  drift: {
    /** Share of the loop dealt to lie drifted. */
    share: { min: 0, max: 0.5 } as Band,
    /** One stretch's length, its easing in and out not counted, m. */
    length: { min: 60, max: 180 } as Band,
    /** The least groomer between two stretches, m. */
    gap: 40,
    /** The packed share left under a drift, as a share of the groomed. */
    packed: 0.05,
    /** The ease in and out at either end of a stretch, m. */
    fade: 12,
    /** No drift this near the start line, either way along the loop, m. */
    clear: 60,
  },
} as const;

/** Uniform draw inside a band. */
export function inBand(rng: { range(min: number, max: number): number }, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Whether a value lies inside a band (inclusive, with a hair of slack for
 * floating-point arithmetic). */
export function withinBand(value: number, band: Band, slack = 1e-6): boolean {
  return value >= band.min - slack && value <= band.max + slack;
}
