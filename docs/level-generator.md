# The world generator

Every map in Powder Run is GENERATED from a seed: a basin of snowy hills
ringed by mountain flanks, forests and open powder meadows, kickers on the
hilltops, and one closed loop of packed snow laid over the country and
graded into it, with the riders' grid standing out in the powder beside it.
Nothing is authored and nothing is stored — the same seed builds the same
map on every machine, and a map is the seed's to share.

This page is the generator's contract in words. The code lives in
`engine/mapgen/`; its rule book is `engine/mapgen/rules.ts`, whose header
states every rule once and whose table carries every number, each with its
unit. The rules below are that header **verbatim** — `tests/docs_rules_test.ts`
holds the two copies together, word for word.

## What comes out: the `Level`

`generateLevel(seed, opts?)` returns a `Level` (`engine/mapgen/types.ts`):

| Field                      | What it is                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `size`, `cell`             | The map is `[0, size] × [0, size]` metres (1600), heights on a grid of `cell` (2 m) cells    |
| `ground`                   | The baked heightfield, the track's grading and every kicker included                         |
| `groundAt`, `normalAt`     | Bilinear height and unit normal off `ground`                                                 |
| `packedAt`                 | 0 = virgin powder … 1 = packed track, off the baked `packed` field                           |
| `track`                    | The closed loop: points every ~2 m with `x, z, y, s, heading, width`; `length`; `closed`     |
| `checkpoints`              | Gates every 120–200 m; index 0 is the start/finish line at arc length 0                      |
| `spawn`, `grid`            | The grid's anchor in the powder 25–90 m off the track, and four slots abreast (player first) |
| `trees`                    | Every trunk: position, ground height, height, trunk radius, crown radius                     |
| `kickers`                  | Every crest shaped to throw a sled: `K1…` on the track (with their arc length), `X1…` off it |
| `sun`                      | Solar hour, day of the year and latitude of a clear winter day                               |
| `laps`                     | 3                                                                                            |
| `basin`, `attempt`, `seed` | The basin's middle and rim radius; which sub-seed attempt was accepted; the seed             |

Two queries answer what every reader of a loop asks (`engine/mapgen/query.ts`):

- `nearestTrackPoint(level, x, z, out?)` → `{ index, s, distance, lateral, x, z }` — the nearest
  point of the centreline, its arc length, the plan distance to it and the signed lateral offset
  (positive to the RIGHT of the direction of travel). Off a spatial hash, so it is cheap at 120 Hz.
  `nearestWithin(level, x, z, within, out?)` is the same question bounded to a radius.
- `trackPointAt(level, s, out?)` → the centreline interpolated at arc length `s`, wrapped onto the
  loop. `arcAhead` and `arcBetween` measure arc distance round it.

Coordinates follow the engine's conventions: y up, heading 0 along +z, growing clockwise seen from
above, so `(sin h, cos h)` is forward and `(cos h, −sin h)` is right.

## How a map is built

`engine/mapgen/generate.ts` is the search. A map is a pure function of its seed: each ATTEMPT
draws everything from a sub-seed of the seed and the attempt number, compiles a level, and asks
the analysis (`engine/analysis/`) — the same rule book re-checked on the FINISHED map — whether it
is clean. A rejected attempt is followed by the next sub-seed; the order is fixed, so the result
is the same everywhere. Inside an attempt the order is the dependency order:

1. **The country** (`terrain.ts`, R2–R3) — the basin and its rim, the hills, the ridges, the tilt
   and the bowls — baked ONCE onto the grid.
2. **The loop** (`track.ts`, R5–R7) — a polar curve, `r(θ) = 1 + Σ aₖ sin(kθ + φₖ)`, stretched,
   turned and warped by slow noise, scaled to the length it aims at and resampled every 2 m.
   Drawn again until one fits: no turn too tight, no crossing, no two stretches too close, nothing
   up the rim.
3. **The grading** (`track.ts`, R8) — the line's profile is the mean of the highest grade-limited
   profile under the country and the lowest over it (two sweeps round the loop each), which bounds
   the grade by construction, cuts a hilltop halfway and fills a hollow halfway, and leaves gentle
   country where it was.
4. **The track's kickers** (`kickers.ts`, R9) — added to the graded profile on the straightest
   brows before a descent: a t² ramp steepest at its lip, a (1 − u)² landing falling away past it.
5. **The corridor** (`track.ts`, R8, R10) — the finished line pressed into the ground: level across
   the width and a flat shoulder, a bank back into the country, and the packed field beside it.
6. **The kickers off the track** (`kickers.ts`, R4) — the same profile stamped on hilltops the
   search climbs to, well clear of the corridor.
7. **The start** (`spawn.ts`, R11–R13) — a spot in the powder beside the loop, the grid round it,
   the loop re-indexed to begin at the point nearest it, and the checkpoints from there.
8. **The forest** (`forest.ts`, R14) — a jittered candidate per cell, kept by a forest noise, and
   refused near the track, on steep ground, up the rim, on a kicker, or in the spawn's clearing and
   its lane.
9. **The drifts** (`drift.ts`, R17) — stretches of the finished loop dealt to lie under fresh
   snow, off a stream of their own (the attempt's sub-seed, salted), so they thin the packed
   field through the corridor's own nearest-segment index and move nothing else the map draws.
   `Level.drifts` publishes each stretch's core as arc lengths.
10. **The day** (`sun.ts`, R15), and the compile (`compile.ts`) that binds it all into a `Level`.

A map builds in about half a second on Node.

## Labs

- `npm run level -- --seed 38` — the map drawn from above (`previews/level-38.png`): hillshaded
  snow with contours every 5 and 25 m, the packed track and its orange centreline, every
  checkpoint numbered, every tree, every kicker (`K1…` on the track, `X1…` off it), the spawn and
  its grid — and a table of the same (`previews/level-38.txt`).
- `npm run analyze` — the scoreboard over a sweep of seeds (`--seed n` for one, `--from`/`--count`
  for a range): one row a map, every finding by rule, and the spread of the numbers at the foot.

## The rules

- **R1** THE WORLD IS A SQUARE. A map is `world.size` (1600 m) on a side, x and z from 0 to that size, with its heights baked once on a grid of `world.cell` (2 m) cells. Nothing is published outside it, and the track, the spawn and the grid stand inside the basin (R2).

- **R2** A BASIN RINGED BY MOUNTAINS. The playable country is a basin round the map's middle. Past `basin.rim.inner` (600 m) from the centre — measured on a rounded square, warped by `basin.rim.warp` of noise so the foot of the range wanders — the ground rises to mountain flanks `basin.mountain` (140–220 m) high by `basin.rim.outer` (780 m), with ridged crests on them. Nothing grows above `forest.treeLine` of the way up the rim (R14): the high flanks are bare snow.

- **R3** ROLLING COUNTRY INSIDE. The basin floor is hills of `hills.amplitude` metres over wavelengths of `hills.scale`, ridges of `ridges.amplitude` metres, the whole floor tilted by up to `tilt.grade` in a seeded direction so a lap climbs one side and runs down the other, and `bowls.count` bowls — round hollows of `bowls.radius` metres radius and `bowls.depth` metres deep.

- **R4** KICKERS OFF THE TRACK. The country carries `kickers.off.count` crests shaped to throw a sled: each stands on a hilltop, rises `kickers.off.height` metres over a ramp of `kickers.off.ramp` metres that is steepest at its lip, and falls away over a landing of `kickers.off.landing` metres. None stands within `kickers.off.clearance` metres of the track's edge, so a kicker is something a rider leaves the loop to find.

- **R5** THE TRACK IS ONE CLOSED LOOP. The race is ridden round a single loop that never crosses itself — a star-shaped loop about a point near the basin's middle, bent by `track.warp` metres of slow noise — whose length lands in `track.length` (2.5–4.0 km), sampled every `track.step` (2 m) along its length. Any two parts of it more than `track.separation.along` metres apart along the loop stand at least `track.separation.plan` metres apart on the map, so no two stretches share a corridor or a bank.

- **R6** NO TURN TIGHTER THAN A SLED CAN CARRY SPEED THROUGH. The radius of every turn, measured over `track.turnWindow` metres of the line, is at least `track.minRadius` (24 m).

- **R7** A WIDE PACKED TRAIL. The track is `track.width` (10–14 m) wide, the width wandering smoothly along the loop over wavelengths of `track.widthScale` metres.

- **R8** THE TRACK IS GRADED INTO THE GROUND. Across its width, and `track.shoulder.flat` metres beyond each edge, the ground is level with the centreline; past that it blends back into the untouched country over a bank at most `track.bank.slope` steep, between `track.bank.min` and `track.bank.max` metres wide. Along the loop the line is smoothed until no `track.gradeWindow` metres of it climb or fall more steeply than `track.maxGrade` (0.22), and no point of it is cut or filled more than `track.maxCut` metres — the kickers of R9 are the only stretches allowed steeper.

- **R9** KICKERS ON THE TRACK. The loop carries `kickers.on.count` (1–3) crests that make jumps: a ramp `kickers.on.ramp` times the lip's height long rising `kickers.on.height` metres to a lip, steepest at the lip, and a landing `kickers.on.landing` times the lip's height long falling away past it. Each stands on a stretch that turns no more than `kickers.on.straight` radians from the foot of its ramp to the end of its landing, where the line comes up to the lip no steeper downhill than `kickers.on.approachGrade` and runs level or downhill past it — a brow before a descent; two stand at least `kickers.on.spacing` metres apart along the loop.

- **R10** PACKED SNOW ON THE TRACK ONLY. `packedAt` is 1 across the track's width and fades to 0 over `track.shoulder.packed` metres beyond each edge — except where R17 drifts it over; everywhere else the snow is virgin powder, the spawn's run-in included.

- **R11** CHECKPOINTS EVERY 120–200 m. Checkpoint 0 — the start and finish line — is the track point nearest the spawn, and the loop is re-indexed to begin there, so its arc length is 0. The rest follow in the direction of travel, evenly spaced as near `checkpoint.spacing.target` (150 m) as divides the loop, and never outside `checkpoint.spacing` (120–200 m). A checkpoint spans the track's width plus `checkpoint.margin` metres either side.

- **R12** THE SPAWN IS IN POWDER BESIDE THE TRACK. The riders start at a seeded spot `spawn.distance` (25–90 m) from the nearest point of the track, on ground no steeper than `spawn.maxSlope`, in powder, with no tree within `spawn.clear` metres and a lane `spawn.lane` metres wide clear of trees to the track, facing that nearest point — so the race opens with a run through the powder onto the loop. The start line stands at least `spawn.kickerGap` metres along the loop from any kicker's lip, and the run-in never climbs or falls more steeply than `spawn.maxRunIn`.

- **R13** THE GRID. The riders stand `grid.slots` (4) abreast across the spawn's heading, `grid.spacing` (4.5 m) apart, the player's slot first in the list and nearest the middle.

- **R14** FORESTS AND MEADOWS. Conifers stand where a slow noise says forest — at most one per `forest.spacing` metre cell, jittered — thinning to `forest.meadow` of that density in the open meadows between, with `forest.clearings.count` round clearings cut out of the woods. A tree is `forest.height` (6–19 m) tall with a trunk of `forest.trunk` and a crown `forest.crown` of its height across. No tree stands within `forest.corridor` metres of the track's edge, on ground steeper than `forest.maxSlope`, above `forest.treeLine` of the way up the rim, on a kicker, or in the spawn's clearing or its lane.

- **R15** A CLEAR WINTER DAY. The map lies at a seeded latitude in `sun.latitude` (46–64°N) on a seeded day of the year in `sun.dayOfYear` (mid-January to mid-March), and the race starts at a seeded solar hour in `sun.hour` (9–16 h) at which the sun stands at least `sun.minElevation` degrees over the horizon.

- **R16** THREE LAPS. A race is `race.laps` (3) laps of the loop.

- **R17** DRIFTS ACROSS THE TRACK. The wind lays fresh snow over stretches of the groomer. A map is dealt a share of its loop in `drift.share` (0–50 %) to lie drifted, laid as stretches `drift.length` (60–180 m) long, at least `drift.gap` metres apart; across a stretch the packed field — the track's width and its shoulders — falls to `drift.packed` of its groomed value, easing in and out over `drift.fade` metres at either end. No drift lies within `drift.clear` metres of the start line, nor within `drift.fade` metres of a kicker's ramp or landing (R9). The drifts are dealt off a stream of their own, so a map's drifts move nothing else it draws; `Level.drifts` publishes every stretch.
