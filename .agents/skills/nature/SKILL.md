---
name: nature
description: "Use when working on the NATURE the race runs through — the snow-loaded conifers (where the generator stands them under R14, their height and crown, the meadows and clearings between the woods, the tree line up the rim) and how `pwa/src/game/forest.ts` draws them (two shapes, the white-over-green banding, two bands of distance and a shadow-only caster set, the woods carried to the rim by the terrain's forest tint); the country as a LANDSCAPE (the mountain flanks as the horizon, the bare high snow, the hills and bowls as they read from the saddle); and the ground as a mesh (`terrain.ts`'s clipmap reaching past the rim); and the WILDLIFE — the birds over the woods (ravens, crossbills, the eagle, the ptarmigan and capercaillie a sled flushes, the skeins crossing in March) and the animals in the snow (hares, foxes, reindeer, a moose, a lynx) with their rarity ladder, their rounds, their fright and the prints they leave in the trail map, all presentation, all dealt off the map's seed on generators of their own. There are no biomes and no rocks in this game. Owns the look-first loop for all of it: `make world`'s forest, vista, herd, birds and prints views, `make birds`' roster sheet, `make level`'s plan, `make profile`."
---

# The nature: the woods, the country, the snow on both

The world IS half the game's look — the race loop is a packed line through
it. This skill owns what the country is COVERED in and how it reads: where the
trees stand and how they are drawn, the landscape the loop runs through as a
thing seen from the saddle, and the ground mesh that carries it to the
horizon. The snow's own light — the glitter, the blue shadows, the groomed
grain, the furrows — is `snow-look`'s; the rules that shape the country and
the loop are `mapgen-improvement`'s.

**FOUR KINDS OF COUNTRY (R21).** The boreal forest — snowy hills, mountain
flanks, snow-covered conifers, open powder meadows — is the country every
rule and every paint was written against; the high alpine, the tundra plateau
and the birch valley are rows over it (`engine/mapgen/regions.ts`: the woods'
density, height, tree line and roster; `pwa/src/game/region-look.ts`: the
needles, the bough load, the birch's bark and twigs, the far woods' tint). A
new one is `add-region`'s checklist. There is no water but a frozen river, and
no rocks as objects; the wildlife's rosters name the regions each row lives
in (`regions` on a row, filtered by `level.region`).

**THE WILDLIFE NEVER MOVES A MAP.** Every flock and group is placed off
`level.seed` XOR a salt of its own (`BIRD_SALT`, `BEAST_SALT`) on a fresh
`createRng`, reading only what the `Level` publishes (`wild-ground.ts`) and
writing nothing back; poses are pure functions of the engine's clock. A
placement that drew from the generator's stream or wrote into the `Level`
would move a pinned campaign map's digest (`tests/generator_version_test.ts`)
— and `tests/birds_test.ts` holds that it does not.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs nature --list`. Load **`skill-reflection`**
at both ends of the session, and **`write-code`** beside this one for any
code change.

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `engine/mapgen/forest.ts` | WHERE EVERY TREE STANDS (R14): one candidate per `forest.spacing` cell, jittered; kept with the probability the forest noise gives its spot (woods inside the forest, `forest.meadow` of that density out in the meadows); `forest.clearings` cut out of the woods; refused by rule — near the track (`forest.corridor`), too steep (`maxSlope`), above `treeLine` of the way up the rim, on a kicker, in the spawn's clearing or its lane. Taller in the thick of a wood and down in the valleys, shorter at a wood's edge and up the slopes. Drawn off the attempt's stream in a fixed order |
| `engine/mapgen/rules.ts` (`forest`) | The numbers: spacing, the noise's scale, the meadow share, the clearings, height (6–19 m), trunk, crown, corridor, slope, tree line |
| `engine/mapgen/types.ts` (`TreeDef`) | `x, z, y, height, radius` (the TRUNK — what the sled meets), `crown` (drawn only) |
| `engine/game/collision.ts` | The trunk as a cylinder the sled meets — the `collision` skill's |
| `engine/mapgen/terrain.ts` | The country's shape (R2, R3) — the `mapgen-improvement` skill's, but every judgement about how it READS is this one's |
| `pwa/src/game/forest.ts` | THE WOODS AS DRAWN: two shapes (a narrow spruce, a broader heavier-laden fir), each a stack of drooping skirts white on the upper face and dark green under the lip, built into vertex colours; each tree scaled to its own height and crown, turned and tinted by a hash of where it stands; instanced in TWO bands of distance (FULL, then FAR — a three-tier sketch), binned into 64 m cells and frustum-tested per frame; and a THIRD SET that is drawn only into the shadow map — every tree whose shadow can reach the sun's circle (`shadow-box.ts`'s `castsInto`), whatever band draws it and whichever side of the lens it stands, under SHADOWS ALL only (SLEDS casts no tree), each its own crown on FOREST HIGH and the sketch drawn a touch inside it below that (`FOREST_LOOK[row].casters`). No band casts: a band decided by distance to the lens is a shadow that switches on as the rider comes nearer. `FOREST_LOOK`, `SHADOW_LOOK` |
| `pwa/src/game/terrain.ts` | THE GROUND AS A MESH: a camera-centred CLIPMAP of nested grids (a quarter metre a vertex at the lens, doubling per level, eight levels past the rim), nothing baked into the mesh — the vertex shader reads the heights from a float texture of the generator's own heightfield. Three textures per level: the heights, the GROUND map (gradient, packed, how wooded), the track direction. `TERRAIN_QUALITY` |
| `pwa/src/game/snow-glsl.ts` | The terrain's shader — `snow-look`'s — but its FOREST TINT (the woods past the far band, read off the ground map) is where this skill's trees end and the ground's paint begins; the two must agree on where a wood is |
| `pwa/src/identity.ts` | `PALETTE.pine`, `pineDark`, `snow`, `snowShadow` — the colours every piece of nature is drawn from |
| `pwa/src/game/rarity.ts`, `wild-ground.ts` | The RARITY LADDER (`perKm` → a word, and the drawn fraction that makes a count of it) and the questions both wildlife placers ask a map: the nearest trunk, the loop, the drawn snow's height, the slope |
| `pwa/src/game/bird-defs.ts`, `bird-roost.ts`, `bird-plan.ts` | THE BIRDS: the roster (a plain array), where every flock lives (a spruce crown, a burrow in a meadow, a crag on the rim) and its loop held over the canopy, and `birdPose` — the cycle, the loop, the wings, the FLUSH (`flushAt`, any sled) and the skeins going north from March (`crossingAt`, by the map's day) |
| `pwa/src/game/beast-defs.ts`, `beast-plan.ts`, `beast-tracks.ts` | THE ANIMALS IN THE SNOW: the roster, where every group lives (a wood's edge, a meadow — never on or beside the loop), `beastPose` — a round walked in a closed-form cycle of standing and moving — and the FRIGHT (`spookAt`); the PRINTS as trail-map stamps in the species' own pattern |
| `pwa/src/game/bird-shapes.ts`, `beast-shapes.ts`, `birds.ts`, `beasts.ts`, `wildlife.ts` | The wildlife as drawn: one instanced mesh a species (a draw call each, only while one is in reach), the wings and the legs and the head moved in the vertex shader, the haze through `hazeMaterial`; the renderer's two memories (the flushes, the frights) and the prints laid again whenever the fine trail window moves |

## How the country should read

- **The mountains are the horizon.** Every shot from the basin has the rim
  in it: bare high snow above the tree line, ridged crests, the flanks
  climbing out of the forest. A frame with no mountains in it reads as a
  field anywhere.
- **Woods and meadows, not an even stubble.** The forest noise is slow on
  purpose: a wood you ride past, a meadow you ride across, a clearing cut
  into the wood. A density that is the same everywhere reads as a lawn of
  trees at range and as a wall up close.
- **Trees thin with height and exposure.** Shorter at a wood's edge and up
  the slopes, gone above the tree line — the same ladder any real mountain
  has, and the one thing that makes the rim read as high.
- **A loaded conifer is its banding.** White over dark green, tier over
  tier. A tree that is all green reads as summer; all white reads as a cone.
  The two shapes and the per-tree tint are what stop a wood reading as one
  tree copied.
- **The track is cut through the woods, never planted over.** `forest.corridor`
  keeps trunks clear of the track's edge; a trunk inside it is a generator
  bug (`analysis` reports `treesOnCorridor`).

## The rules

- **The engine stands every tree; the renderer draws exactly those.** The
  trunk drawn is `TreeDef.x/z/radius` — a tree drawn somewhere else is a
  tree the sled passes through or hits in thin air. Decorative scatter the
  sled cannot hit (a bush, a sapling) would be the renderer's own, placed
  deterministically off the level, and must never stand on the track.
- **Placement is deterministic and in a fixed order.** A tree added to the
  middle of the draw order moves every tree after it on every seed.
- **Instanced, banded, culled.** Tens of thousands of trees, so every change
  is judged in `make profile`: a new shape is a new instanced mesh per band;
  a per-tree allocation per frame is a stutter.
- **Past the far band the terrain carries the woods.** The ground map's
  wooded channel is what tints the snow dark where the far forest is; a
  change to where trees stand that does not move that channel leaves a
  painted wood with no trees in it, or trees on white snow at range.
- **The ground mesh is the generator's heightfield, sampled.** Nothing in
  `terrain.ts` invents a height; a ridge that is not in `Level.ground` is not
  in the picture either.

## The loop

1. **Plan**: `make level SEED=<n>` — where the woods, meadows and clearings
   fall, and where the trees stand against the track.
2. **Look**: `make world SEED=<n> ARGS=--views=forest,vista,track,spawn`
   (its own bundle; `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web
   session). `forest` is in the woods, `vista` the country from above, `track`
   the loop through it, `spawn` the grid in the powder. Judge with the Read
   tool at full size AND at a quarter — the woods have to read at range.
3. **Cost**: `make profile` before and after — draw calls and triangles per
   band.
4. **More than one seed.** A country that reads well on one seed has read
   badly on the next; look at three.
5. **The built app**: `make build`, `make screenshots` for the game's own
   framing at the reference viewports.
6. If a rule moved: `mapgen-improvement`'s loop (`make analyze`, the
   verbatim mirror in `docs/level-generator.md`, `make sim`).
7. **The wildlife**: `make birds` for the roster side by side (the
   silhouettes, the paint, three poses each over a metre rule), then
   `make world ARGS=--views=herd,birds,prints` for them in the country, and
   `tests/birds_test.ts` for the claims (no digest moved, nothing on the
   loop, the flush and the fright as rules). A cry is `sound-effects`'
   (`audio/bird-voice.ts`, `bird-bank.ts`) and owes `make audition`.

## What the change obliges elsewhere

- `make world` pictures and `make profile` before and after, in the PR.
- A placement change is a generator change: `make analyze` tally,
  `make sim` both tables, `tests/mapgen_test.ts`.
- A `.changes/unreleased/` fragment when a player would see it.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
density or a shape that read wrong at range and right up close, a band
distance that popped, a tint that did not match the trees it stood for.
