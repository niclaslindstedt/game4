---
name: add-region
description: "Use when a NEW KIND OF SNOW COUNTRY is asked for — a fifth region beside the boreal forest, the high alpine, the tundra plateau and the birch valley, 'add a region for …', or a change to what one of them IS. The whole of what a region is in this repo, as one checklist in order: the engine's row (relief, woods, kickers, the sun's bands, the crust, the river), the surface the physics reads, the app's two tables (the look and the grade) and the card's word, the suite that holds them to one list, every lab's REGION= help, the docs, the changelog — and the promise the whole scheme stands on: the boreal row stays all ones, so no seed and no pinned campaign map moves. Owns the order and the measurement each step owes; what each half is made of is `mapgen-improvement`'s, `nature`'s, `snow-look`'s and `atmosphere`'s. The sibling jet-ski game's `add-biome`, retyped for snow."
---

# Adding a region: a kind of snow country, never a place

A REGION (R21) is a KIND of country — a boreal forest, a high alpine basin, a
tundra plateau, a birch valley — never a range, a country or a valley that
exists, and it is named in five tables that cannot import each other's reason
to exist. This skill is the one list of them, in the order they have to be
filled, with the measurement each step owes before the next. It routes to the
skills that own the halves: **`mapgen-improvement`** (the row, the rules, the
surface), **`nature`** (the woods and the country as they read),
**`snow-look`** (the crust, the ice, the rock as drawn), **`atmosphere`** (the
grade, the sun's bands), **`sled-physics`** (anything a probe reads).
Load **`write-code`** beside all of them and **`skill-reflection`** at both
ends.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs add-region --list`.

## The one promise

**THE BOREAL ROW IS ALL ONES AND LAYS NOTHING.** Every multiplier in
`engine/mapgen/regions.ts` is a multiple of the rule book's own number, a band
is scaled through `scaleBand` / `scaleCount` (which hand back the SAME object
at one), and a region's own steps — the river, the crust — draw off streams
of their own and are skipped where the row lays none. That is what keeps every
seed's map byte-identical and every pinned campaign map on its digest
(`tests/generator_version_test.ts`, `tests/region_test.ts`'s "the boreal is
the map every seed always built"). A change that needs a new draw on the
attempt's own stream, or a number that is not a multiple of one in the boreal,
moves every map: that is a generator VERSION row (`versions.ts`), not a region
— stop and read `campaign`.

## The quality bar

A region is DONE when all of the following hold:

- **It is a different country at riding pace.** `make world REGION=<id>`'s
  `track`, `forest` and `vista`, and `make screenshots ARGS="--region <id>"`,
  read as this country and no other — the lie of the land, the trees, the
  snow's surface, the cast over the picture. A region told apart only by the
  card's word is a palette, not a region.
- **It builds.** Sixteen of sixteen through `make analyze COUNT=16
  REGION=<id>`; the retry count stays low (a region that needs half its
  attempts is a row fighting R8's grade or R6's radius — retune the row, never
  widen a rule).
- **It rides.** `make sim REGION=<id>`: every seed finishes. The table goes in
  the PR beside the boreal's, which must be UNCHANGED.
- **It names no place.** `tests/region_test.ts` sweeps the tree.

## The loop

### 1. The engine's row

- `engine/mapgen/regions.ts` — the id on `RegionId` and `REGION_IDS`, and the
  row: `relief` (R2, R3), `forest` (R14 — `density`, `meadow`, `height` as a
  share of the band so a tree never leaves it, `treeLine`, `lowland`, the
  `roster` of `TreeKind`s), `kickers` (R4's count), `sun` (R15's latitude and
  day bands — check `sunWindow` has hours in them, or R15 rejects every
  attempt), `crust` and `river` (or null). Say in a comment what each number
  is a fact about.
- A NEW TREE KIND is a `TreeKind` and a shape in `pwa/src/game/forest.ts`
  (built only where one grows, so a map without it pays no draw call).
- **Observe:** `make level SEED=38 REGION=<id>` and two more seeds — the
  crust as a blue wash, the ice a stronger blue, birch crowns tan, spruce
  green. Then `make analyze COUNT=16 REGION=<id>`.

### 2. The surface the physics reads

The crust and the river are `engine/mapgen/surface.ts`'s: laid off streams of
their own, folded into the packed field only past `CLEAR` of the centreline
(R10 holds), published as `Level.crust` / `Level.ice` / `iceAt`. The physics
reads the crust through `packedAt` like any packed snow and the ice through
`onIce` (`TUNING.grip.ice`) as well. A NEW kind of surface a probe must feel
is `sled-physics`'s first: read in `sled.ts` behind an optional `Level`
field, so a map without it runs the exact arithmetic it always ran (`x * 1`,
not a branch that re-orders a sum).

### 3. The app's tables

| Table | File | Judged by |
| --- | --- | --- |
| The look: the far woods' tint, the crust, the ice, the rock, the sastrugi, the needles, the bough load, the bark | `pwa/src/game/region-look.ts` | `make world REGION=<id> ARGS=--views=track,forest,vista` |
| The grade over the whole frame | `pwa/src/game/colour-grade.ts` (the model); `grade-pass.ts` restates it in GLSL | the same views, and `tests/region_test.ts`'s claims on greys; the boreal's stays NEUTRAL (no pass is drawn for it) |
| The card's word | `STRINGS.regionNames`, and the `startRegionHint` sentence, in `pwa/src/game/strings.ts` | `make screenshots ARGS="--surface start"` at all three viewports |

A grade is judged on the picture, never on its numbers: a split of a quarter
toward a deep blue turned a whole alpine frame lavender. Start timid.

### 4. The suite, the labs, the docs

- `tests/region_test.ts` — the new id is on every list by construction; add a
  "builds in its own character" case saying what this country IS, measured
  against the boreal on the same seeds.
- Every lab's `--region` help text (`scripts/level-map.mjs`,
  `analyze-level.mjs`, `simulate-run.mjs`, `world-preview.mjs`,
  `screenshot.mjs`, `profile-render.mjs`).
- `docs/level-generator.md`'s regions table (and R21's prose if a new kind of
  surface or a new rule lands — mirrored VERBATIM, `docs_rules_test`),
  `docs/getting-started.md`'s COUNTRY bullet, `docs/configuration.md`'s
  `region` row.
- **Run:** `npx vitest run tests/region_test.ts tests/generator_version_test.ts
  tests/determinism_test.ts tests/simulation_test.ts tests/mapgen_test.ts
  tests/analysis_test.ts tests/docs_rules_test.ts` — the digests must NOT move.

### 5. Look, then measure

`make build`, then with `CHROMIUM_PATH=/opt/pw-browsers/chromium`: `make
world SEED=38 REGION=<id>`, `make screenshots ARGS="--region <id>
--viewport desktop"`, and `make profile ARGS="--scene race --region <id>
--window 20"` beside the boreal's (the grade is one more full-screen pass and a
half-float target; the boreal pays neither).

## The traps

- **A band scaled by a literal one is not the same band.** `{min: a*1, max:
  b*1}` is equal but a new object; the scheme only promises the same draws, and
  it holds — but a test that says `toBe(R.sun.latitude)` wants the object.
  Scale through `scaleBand` / `scaleCount`.
- **A new draw on the attempt's stream.** Even in a branch only the new region
  takes, if it sits BEFORE a draw the boreal also makes it is harmless to the
  boreal — but if the boreal's path gains a draw anywhere, every map moves.
  Salt a stream of your own (`surface.ts`'s pattern).
- **The analyzer's bands.** R15 is read off `regionOf(level).sun`; a new
  region-scaled count R4 or R14 warns on must read the region's number too.
- **A river under a kicker.** Anything the generator stamps after the river is
  cut must ask the ice before it stands (`kickers.ts`'s `onIce`, the forest's
  refusal).
- **A place name.** Name the country for what it IS.
- **The campaign.** Every pinned map is boreal. A shelf per region is a
  deliberate curation (`campaign`), never a side effect.

## Checklist

- [ ] `RegionId`, `REGION_IDS`, the row (boreal untouched)
- [ ] 16/16 through `make analyze REGION=<id>`; `make level` looked at
- [ ] a new surface felt through an optional `Level` field, boreal arithmetic unchanged
- [ ] `region-look.ts`, `colour-grade.ts`, `STRINGS.regionNames` rows
- [ ] the wildlife rows name the new region (`regions` on every row of `bird-defs.ts` and `beast-defs.ts` that lives there — no tree bird where there is no wood); `tests/birds_test.ts` deals a few species in it; `make birds`
- [ ] `tests/region_test.ts` green; generator-version, determinism and sim digests unmoved
- [ ] `make world` / `make screenshots` looked at; `make profile` beside the boreal
- [ ] `make sim REGION=<id>` — every seed finishes; boreal table unchanged
- [ ] docs, the labs' help, the changelog fragment
- [ ] `skill-reflection` for every skill loaded

## Skill self-improvement

Record lessons under `.agents/skills/add-region/.lessons/` in the
`skill-reflection` format; that skill decides at session end what gets
promoted into this file. Never append lessons here directly.
