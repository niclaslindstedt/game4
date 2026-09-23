---
name: mapgen-improvement
description: "Use when improving the WORLD GENERATOR (engine/mapgen/) — the rules engine that builds every map fresh from its seed: the basin and its mountain flanks, the hills, ridges, tilt and bowls, the kickers on the hilltops and on the track, the closed race loop graded into the country and the packed snow on it and the drifts across it, the start line and the grid on the track behind it, the checkpoints, the forest and its meadows, the day. Owns the module split (rules.ts data / generate.ts search / terrain, track, kickers, spawn, forest, sun / compile.ts geometry / query.ts the track asked), the R-rules and their verbatim mirror, the TRACK-AND-TERRAIN craft (sculpting slopes and kickers, the closed loop, the spawn), and above all the LOOP: write, generate, ANALYZE (`make analyze`), fix, reflect on whether the analyzer measured the right thing, LOOK with `make level`, iterate, then take another seed."
---

# Improving the World Generator

A change here lands on **every map on every seed at once** — every seed a
player shares, every map in every test sweep. That leverage cuts both ways: a
regression you cannot see on the seed you happened to draw is still shipping
on the other several thousand.

Which is why the centre of this skill is not the rules. It is the LOOP.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs mapgen-improvement --list`, then the ones
this task touches (`--scope=…`, `--concepts=…`). Load **`skill-reflection`**
at both ends of the session, and **`write-code`** beside this one.

---

## THE LOOP

```
   1. write code
   2. generate a map            make analyze SEED=7    (builds it and scores it)
   3. run the analytics         …read the FINDINGS, not the verdict
   4. improve the generator     fix the worst finding
   5. reflect on the ANALYSIS   was that a defect, or a check measuring wrong?
   6. LOOK                      make level SEED=7      (the plan, every checkpoint numbered)
   7. iterate on this seed      until it comes up clean
   8. take a different seed     and do it all again
   9. when several seeds hold   make analyze COUNT=24, make sim, then commit
```

The two halves of every pass, and neither is optional:

```sh
make analyze SEED=7          # MEASURE: every finding, named by its R-rule
make level SEED=7            # LOOK: the hills, the forest, the loop, the kickers, the spawn, the grid
```

`make level` (`scripts/level-map.mjs`, drawn by `scripts/lib/level-draw.mjs`)
draws the map from above — the country shaded by height, the forest, the
track and its packed shoulders, every checkpoint NUMBERED, every kicker
labelled (`K1…` on the track in riding order, `X1…` off it), the spawn and
the grid — and prints a table of the checkpoints beside it (`ARGS=--json`
for the listing as data). A claim about "the third checkpoint on seed 38" is
a claim about a row there. Engine only: no build, no browser, a couple of
seconds.

`make analyze` (`scripts/analyze-level.mjs` over `engine/analysis/`) re-checks
the FINISHED map against the rule book and names each finding by its rule
(`R5 error: loop is 2410 m (band 2500–4000 m)`), with the stats worth reading
even when nothing is wrong (length, the tightest radius, the steepest grade,
the relief, the kickers, the trees on the corridor, the sun). It exits
non-zero on an error; `COUNT=24` sweeps seeds 1–24.

**Step 5 is the one that is easy to skip and the one that makes the rest
worth doing.** An analyzer is only as honest as its checks. Every time a
finding comes up, ask which of three things it is:

| The finding is… | Do |
| --- | --- |
| A real defect | Fix the GENERATOR. The normal case. |
| A check measuring the wrong thing | Fix the CHECK in `engine/analysis/`, and say why in the comment. |
| A real property of the game, scored as a fault | Move the number in `rules.ts` — **only with a MEASUREMENT behind it** (the sim clearing it, the ride lab landing it), written into the comment. |

Instruments agreeing on a LOCATION is evidence; a finding that appears on
every seed at the same VALUE is the measurement bug (a check reading a clamp).

**Never widen a rule to make the exit code green.** The generator REJECTS on
the analyzer's verdict, so a widened band ships the map it was meant to
refuse.

### If it can be measured, the ask comes with a CHECK

When somebody asks for something here and no existing check can tell whether
it is right, writing that check is part of the job, in the same pass. A map
is built fresh from its seed every time, so a quality nobody measures
survives exactly until the next tuning pass moves a number under it.

1. **Name the property in one sentence** — "every kicker on the track has a
   run-up that is not a corner".
2. **Extend an existing check if one nearly covers it.**
3. **Decide the SHAPE before the threshold** — a floor, a ceiling, or a BAND
   (checkpoint spacing, loop length, the number of kickers: too few is as
   wrong as too many, and only a band says so).
4. **State the threshold in `rules.ts`** (the generator builds to it and the
   analysis holds the map to the same number), or, for a pure measurement
   tolerance, as a named constant in `analysis/index.ts` with its reason.
5. **Then build the thing.**

A property that cannot be measured — "does this read as mountain country" —
is what `make level` and `make world` are for. Say so out loud rather than
inventing a proxy nobody believes.

---

## The modules, and their jobs

| File | Job |
| --- | --- |
| `types.ts` | **The map as everyone else sees it.** `Level`, `TrackPoint`, `Checkpoint`, `Spawn`, `TreeDef`, `Kicker`, `GenerateOptions`, `TrackHit`. Read by the sled, the course, the bot, the renderer and every lab — extend it; never rename a field without moving every reader. The optional fields (`packed`, `kickers`, `basin`, `attempt`) are what a hand-built synthetic level need not invent; `GeneratedLevel` has them all. |
| `rules.ts` | **The rule book.** R1–R16 in prose in the header, every number in `LEVEL_RULES`, each with its unit. Tuning the generator means editing this file — and the prose is mirrored VERBATIM in `docs/level-generator.md` (`tests/docs_rules_test.ts`). |
| `terrain.ts` | **The country (R2, R3):** the basin and its rim on a warped rounded square, the hills, ridges, tilt and bowls — a pure function of a PLAN drawn once, baked ONCE onto the grid (`planTerrain`, `bakeCountry`). |
| `track.ts` | **The loop (R5–R8, R10):** drawn polar (`r(θ) = 1 + Σ aₖ sin(kθ + φₖ)`, star-shaped so the harmonics cannot cross), warped, scaled, resampled every 2 m; refused on a crossing, a tight corner or a reach up the rim; graded into the country; the corridor pressed into the ground and the packed field stamped (`drawLoop`, `gradeLoop`, `stampCorridor`). |
| `kickers.ts` | **The kickers (R4, R9):** the ramp-and-landing profile, added to the graded line on the track, stamped into the ground in plan off it. |
| `spawn.ts` | **Where the race starts (R11–R13):** the start line searched for on the loop, the loop re-indexed so checkpoint 0 is arc 0, the grid on the track behind it, the checkpoints down it. |
| `forest.ts` | **The forest (R14):** one candidate per cell, jittered, kept by the forest noise, refused by rule — never within `forest.gap` of another trunk, so a sled rides between any two — and sized by where it stands. |
| `drift.ts` | **The drifts (R17):** stretches of the finished loop dealt off their own stream and stamped into the packed field. |
| `sun.ts` | **The day (R15):** latitude, day of the year, a solar hour with the sun over its floor — the arithmetic is `lib/solar.ts`'s. |
| `compile.ts` | **The geometry:** the baked grids bound into the `Level` and its three queries (`groundAt`, `normalAt`, `packedAt`) as bilinear samples. Nothing downstream regenerates any of it. |
| `query.ts` | **The track, asked:** `nearestTrackPoint` (off a lazily built spatial hash), `trackPointAt`, `arcAhead`, `arcBetween` — for the generator, the analysis, the physics, the bot and the renderer alike. |
| `generate.ts` | **The search:** `generateLevel(seed, opts?)`. Each ATTEMPT draws everything from `subSeed(seed, attempt)`, in dependency order, compiles, and asks `analyzeLevel` whether it is clean; a refused attempt re-rolls the next sub-seed, bounded. |
| `index.ts` | The block `engine/index.ts` re-exports. |

And the scoreboard, NOT in `mapgen/` on purpose: `engine/analysis/index.ts`
(`analyzeLevel` → `{ findings, stats, ok }`, each finding naming its rule) and
`crossings.ts` (R5's self-intersection test off a spatial hash). It reads only
what the `Level` publishes — never the plan — because the plan is not what the
rider rides.

**The generator's budget and the analyzer's are OPPOSITE.** The generator
runs in the game, on a phone, behind the loading card every time a race is
stood up, and its grids are then read thousands of times a second — it has to
stay fast (`run-loader.ts` budgets a frame around it). The analyzer runs inside
the generator's reject loop, so it may be dearer than what it measures, but a
seed must stay well under a second.

---

## Track and terrain — the craft of the country

The generator's job is not just legality, it is PLAUSIBILITY: a map has to
read as mountain country somebody groomed a race loop through. Each of these
is also a CHECK.

### Sculpting slopes

- **The basin is the stage; the mountains are the backdrop.** The rim climbs
  from `basin.rim.inner` to `outer` into flanks 140–220 m high, measured on a
  rounded square so the corners are mountain, with the foot warped so it does
  not read as drawn with a compass. The track never reaches up the rim (R2),
  and nothing grows above the tree line on it (R14) — bare high snow is the
  horizon every shot has.
- **Rolling, not lumpy.** The hills (`hills.scale` 320 m) set the rhythm of a
  lap; the ridges add the crests; the tilt makes a lap climb one side and run
  down the other; the bowls are where speed pools. A new term in the country
  goes in `terrain.ts`'s plan and is a pure function of the plan point — the
  search asks "how high is the untouched ground here?" of the same arithmetic
  the bake writes.
- **Grade into the country, never on top of it.** R8 levels the track across
  its width and its flat shoulders, blends it back over a bank no steeper
  than `track.bank.slope`, and smooths the line along the loop until no
  window is steeper than `maxGrade` and no point is cut or filled more than
  `maxCut`. A loop whose grading needs a bigger cut is a loop in the wrong
  place — refuse it, do not deepen the cut.

### Sculpting kickers

- **A kicker is a profile, steepest at the lip.** The ramp rises as t² and
  the landing falls as (1 − u)², so the lip is a kink no suspension can
  follow — that is what throws a sled. A ramp that flattens at its top (a
  smoothstep) hands the sled no upward speed at the one moment it matters: a
  jump that does not jump. `analysis` checks the break in grade across each
  track kicker's lip (`KICK`).
- **On the track (R9) the profile is added to the graded LINE by arc
  length**, before the corridor is pressed in, so the kicker is as wide as
  the track, its banks are the corridor's, and it follows the line through a
  gentle bend. It stands only on a stretch that barely turns (`on.straight`),
  where the approach is not a descent into a compression, and where the line
  past the lip runs level or downhill — a brow before a descent, the natural
  crest. Two stand `on.spacing` apart.
- **Off the track (R4) the same profile is stamped into the ground in plan**,
  on a hilltop, blending into the snow either side, at least
  `off.clearance` from the track's edge — something a rider leaves the loop
  to find.
- **A kicker is judged by the flight it gives**, not by its height: `make
  ride SCENARIO=kicker` on the stadium's, and `make sim`'s air column over a
  sweep. A kicker that throws the bot into the trees or onto a flat landing
  every lap is a kicker in the wrong place.

### The closed loop

- **Closed by construction, never by search.** The polar draw closes exactly
  and is smooth at θ = 0; a loop drawn as a walk asked to find its way home
  arrives at whatever heading it arrives at, and the join is a kink.
- **Never crossing.** Star-shaped harmonics cannot cross, but the warp can
  fold the loop over itself, so every draw is checked (R5, `crossings.ts`),
  and any two parts far apart along the loop must stand `separation.plan`
  apart on the map so no two stretches share a bank.
- **Corners a sled can carry speed through** (R6: radius ≥ `minRadius` over
  `turnWindow`). The bot's braking and the corner's radius are a coupled
  pair; a tighter rule is a slower lap and more resets in `make sim`.
- **The packed field is R10's alone** — 1 on the track, fading over the
  shoulders, 0 everywhere else. The physics reads it for sink and grip, the
  renderer for the groomed look; a second definition of "on the track" is a
  bug.

### The spawn

- **The race opens ON the groomer** (R12, R13): the start line is a seeded
  station of the loop, and the loop is re-indexed to begin there — every arc
  length a reader meets is measured from the line the race is timed on. The
  grid stands behind it in rows straddling the centreline, facing along the
  loop, the player's slot first (front row, left). A start in the powder is
  the roam mode's, the day it is built.
- **Searched for, not solved for.** A station is refused on anything unfair
  or unrideable: a kicker's lip within `spawn.kickerGap`, a bend or a slope
  in the stretch behind the line the grid stands on. A field bigger than the
  grid stands its extras further back (`rivals.ts`).

When something looks wrong on the plan, ask which rule of the country it
breaks before reaching for a number.

---

## Extending the vocabulary

A new map ingredient follows the settled pattern, in order:

1. Its type in `types.ts` (optional on `Level` if a synthetic map need not
   carry it), and its numbers in `rules.ts` — data first.
2. Placement in the module that owns its subject, in the dependency order
   `generate.ts` states (country → loop → track kickers → corridor → off
   kickers → spawn → checkpoints → forest → sun).
3. Geometry in `compile.ts` — the `Level` is the ONLY channel.
4. An R-rule in prose in `rules.ts`'s header AND verbatim in
   `docs/level-generator.md`.
5. An invariant test across seeds in `tests/mapgen_test.ts`, over the shared
   corpus in `tests/support/levels.ts`.
6. **A CHECK in `engine/analysis/`** naming the rule — the generator rejects
   on it, which is what makes the feature part of the loop.
7. Physics (`collision` for anything the sled can touch), the bot (it has to
   be able to TAKE the thing — `bot-improvement`), and rendering
   (`terrain.ts`, `forest.ts`, `gates.ts` — `nature`, `snow-look`).
8. A mark on `make level`'s plan and a row in its table.

Skip 4, 5 or 6 and the rule exists only as behaviour — the next tuning pass
undoes it without knowing it was ever a rule.

---

## Invariants — load-bearing, and easy to undo by accident

- **`generateLevel(seed)` is a pure function of the seed.** Every draw comes
  from the attempt's PRNG, in a fixed order. Shareable seeds, the sim digests
  and the test corpus all hang off it. Insert a draw in the middle and every
  later draw moves: every seed re-rolls.
- **Reject, never repair.** A refused attempt re-rolls `subSeed(seed,
  attempt)`, bounded (`attempts`, default 16), and the whole attempt is
  thrown away. The sub-seed derivation is part of the contract.
- **The analyzer is the generator's gate.** A check that fires on every seed
  is a generator that never succeeds — the bound turns it into a loud thrown
  error, and `tests/mapgen_test.ts` is where it shows first.
- **Baked once, sampled bilinearly.** `ground` and `packed` share one 2 m
  grid; the three queries are two lerps. Nothing downstream evaluates the
  noise again; anything that has to land ON a cell searches the field.
- **Published heights are the ground's.** Track points and kickers carry the
  height the ground actually has there, so a reader of a track point and a
  reader of `groundAt` under it read the same number.
- **One question, one answer: `query.ts`.** "Where on the loop is this point
  nearest?" is `nearestTrackPoint` for the spawn, the forest, the analysis,
  the physics, the bot and the renderer; a second implementation drifts.
- **Vocabulary numbers are a coupled system.** Checkpoint spacing, the bot's
  lookahead, the sled's top speed, the corner radius and the kicker profile
  agree with each other. That is what the sim sweep is for.
- **Maps must stay finishable.** `tests/simulation_test.ts` is the contract:
  the bot finishes what the generator builds.

---

## Shipping

- **`make analyze COUNT=24` before and after**, and the finding tally in the
  PR. **Compare TALLIES, never seeds** — any rules change re-rolls the search,
  so seed 7 after is a different map from seed 7 before.
- **Both `make sim` tables** (before/after) — finishes, pace, resets and hits
  over a sweep, read off the closing line, never a row.
- **`make level` at more than one seed** and the pictures in front of the
  user. **`make world SEED=<n>`** for how the country reads through the
  renderer.
- `docs/level-generator.md` updated if any rule moved (the verbatim list —
  `npx vitest run tests/docs_rules_test.ts` — and the Level table).
- `npx vitest run tests/mapgen_test.ts tests/analysis_test.ts
  tests/docs_rules_test.ts tests/simulation_test.ts tests/determinism_test.ts`.
- A `.changes/unreleased/` fragment: generator changes are player-visible by
  definition.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
tell on the plan, a lever that reliably fixes a look problem, a coupling
between a rule number and the sled — and, specifically for the analyzer, any
check that turned out to be measuring the wrong thing.
