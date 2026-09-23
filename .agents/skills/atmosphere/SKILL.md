---
name: atmosphere
description: "Use when working on the SKY and the air under it — where the sun stands at the hour the race has reached on the map's day at its latitude (R15, `sunAtRun`), what colour it makes the dome, the two lights and the blue in the snow's shadows, the haze every far slope dissolves into (one sky function read along each surface's own direction), and the key light's one shadow map over a circle ahead of the lens that every shadow fades out at the rim of — and over that the WEATHER R19 deals (clear, fair, high cloud, overcast, falling snow, valley fog), its cloud, its falling snow and spindrift, its flat light, and the NIGHT an evening map rides into (the moon as the key, the stars, the sleds' lamps). Owns `pwa/src/game/sky.ts` (the colour model, three-free), `haze.ts`, `sky-dome.ts`, `environment.ts`, `snowfall.ts`, and on the engine side `engine/game/clock.ts` (the sun and the moon), `engine/game/wind.ts`, R15 in `mapgen/sun.ts` and R19 in `mapgen/weather.ts`; and `make sky`, the contact sheet that is the only honest way to judge any of it. Not the snow the light lands on (`snow-look`), not the trees (`nature`), not what the sled throws (`visual-effects`)."
---

# The atmosphere: the sun, the sky and the haze

Everything over the snow and in the air between the lens and the far rim. The
picture is set here before a single furrow is drawn: the sun's elevation
decides the palette, the sky's blue decides what colour a shadow on snow is,
the haze decides how far the mountains read. A change here moves every
picture in the game.

**A MAP IS DEALT ONE SKY AT ONE HOUR** (R15, R19): a seeded day at a seeded
latitude, one of six weathers off a stream of its own, and on a quarter of
the maps an evening start that rides from the last of the sun into the dark.
What changes over a race is the sun's (and the moon's) height alone. A
season's cast is NOT BUILT — `game3`'s `SEASON_LOOKS` is where it starts.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
atmosphere --list`. Load **`skill-reflection`** at both ends and
**`write-code`** beside this one for any code change.

## The engine's half, and the app's

The engine decides the FACTS and the app decides the PICTURE; nothing in the
engine has an opinion about colour.

| Fact | Where |
| --- | --- |
| The map's day: a latitude (46–64°N), a day of the year (mid-January to mid-March) and a starting solar hour (9–16 h) at which the sun is at least `sun.minElevation` up (R15) | `engine/mapgen/sun.ts` (`dealSun`, `declinationOf`), `LEVEL_RULES.sun` |
| The hour the race has REACHED — TEN MINUTES OF RIDING IS ONE HOUR OF SUN, so the shadows visibly swing over a race | `sunHourAt(level, t)`, `sunAtRun(level, t)`, `SUN_SECONDS_PER_HOUR` in `engine/game/clock.ts` |
| The moon: its place and its phase off the map's day (a nominal year, so R15's two months carry two lunations) | `moonAtRun(level, t)`, `moonAgeOn` in `clock.ts` over `lib/solar.ts`'s `moonAt` |
| THE WEATHER (R19): the sky, the fall, the fog, the mean wind and its bearing, the evening — dealt last off its own stream so it moves nothing the map builds | `engine/mapgen/weather.ts` (`dealWeather`, `weatherOf`, `weatherFor`, `withSky`), `LEVEL_RULES.weather` |
| The wind at a moment: the mean breathing in gusts, veering — a PURE function of (level, t), drawing nothing from `state.rng`, read by nothing in the physics | `windAt` in `engine/game/wind.ts` |
| The astronomy: the sun's elevation and bearing at an hour, a latitude and a declination | `engine/lib/solar.ts` (`sunAt`) — the generic pool |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/sky.ts` | WHAT COLOUR THE AIR IS: `skyLookAt(level, t)` → a `SkyLook` — the dome's zenith and horizon, the sun's own colour through the air it crossed (per-channel transmittance `exp(−k · airmass)` over the Kasten–Young air mass, `airMass`, `sunTint`), the two halves of the hemisphere light, the haze. Linear RGB throughout. THREE-FREE, so `tests/world_render_test.ts` reads the whole model |
| `pwa/src/game/haze.ts` | ONE SKY FUNCTION IN GLSL (`SKY_GLSL`, `skyColour(dir)`) and the haze every world material fades into, drawn from it along that surface's own direction (`HAZE_FRAGMENT`, `hazeMaterial`) — replacing three's one-colour fog; the uniforms ONE object shared by reference (`createHazeUniforms`, `writeHaze`) |
| `pwa/src/game/sky-dome.ts` | The dome: `skyColour` painted on a sphere round the lens with the sun's disc on it, through the same tone mapping and output conversion as every lit surface, so the haze meets it with no seam |
| `pwa/src/game/snowfall.ts` | THE SNOW IN THE AIR: a wrapped box of flakes round the lens moved by one vector a frame (how hard it snows is the draw range; the SPRAY row caps the pool; a flake in the player's beam lights up), and the spindrift lifted off the crests on the CPU when the wind can lift dry snow |
| `pwa/src/game/environment.ts` | Hangs it in the scene: the key light and the hemisphere light, the dome, the haze, re-read EVERY FRAME off the run's own clock; the key light's shadow box, aimed at a circle `SHADOW_LOOK[row].reach` (SLEDS: tight and sharp, the machines alone; ALL: every tree's too) round a point ahead of the lens and snapped to whole texels so a tree's shadow edge does not crawl, its normal bias scaled with the texel |
| `pwa/src/game/shadow-box.ts` | WHERE THE SHADOW STANDS, three-free: the circle ahead of the lens (`aimShadow`), its fade (`shadowFade`), how long a tree's shadow is at this sun (`shadowLength`) and whether it reaches the circle (`castsInto` — what `forest.ts` picks its casters by). The fade itself is a graft on three's `lights_fragment_begin` inside `hazeMaterial`, so every world material fades the same shadow at the same rim |

## The rules

- **The sun is the single input, and it is asked every frame.** Anything
  that needs to know how bright, how warm or where the light is reads the
  `SkyLook` — the snow's glitter and sheen, the haze, the shadows. Nothing
  restates an elevation or picks its own sun colour, and nothing caches a
  look across a frame: the sun moves an hour every ten minutes.
- **THE SHADOWS ARE BLUE, AND THAT IS THE SKY'S JOB.** What fills a shadow on
  snow is the sky, so the hemisphere's upper colour is a real blue and the
  bounce under it near-white. Shade that reads grey is a hemisphere light
  that lost its blue, not a snow shader that needs a tint.
- **The sky over snow is bright.** Fresh snow sends most of the light back
  up; a winter horizon is a pale, almost white blue. A saturated horizon
  reads as summer.
- **The sun's colour is the air it crossed**, not a table of hand-picked
  oranges: a low February sun at 62°N is gold because of the air mass, and
  the model says so.
- **The haze is the sky in that direction.** A ridge two kilometres off
  dissolves into exactly the sky behind it — warmer toward the sun, bluer
  away. A flat fog colour stands in the picture as a grey band; never
  reintroduce three's own fog in a world material, use `hazeMaterial`.
- **Linear light, and every hand-written shader closes the loop.** `sky.ts`
  authors linear RGB; a `ShaderMaterial` that writes straight to
  `gl_FragColor` skips the output conversion and hands out a picture half as
  bright as authored — which reads as a far slope glowing brighter than the
  sky, never as "too dark". Every custom one ends with
  `#include <colorspace_fragment>` (and the tone mapping the dome shares).
- **The shadow stands ahead of the lens, not round the sled**, and FADES at
  its rim. A chase camera puts the sled at the bottom of the frame, so a
  box round the sled spends half its texels behind the lens; and a map that
  simply stops is a straight line across the snow that shadows pop over as
  it travels. Past the circle the haze and the terrain's forest tint carry
  the woods. Widening it to shadow the whole basin is a blurred shadow for
  every tree.
- **What casts is decided by where the shadow falls**, never by how near
  its tree is to the lens (`castsInto`). A caster set cut by distance to the
  lens, or by the view frustum, is a shadow that appears as the rider
  closes on a wood, and one that vanishes when the lens turns away from the
  tree standing behind it. The casters are their own shadow-only set —
  three picks its shadow pass off the MAIN camera's layers, so a layer
  cannot hide them from the picture; their material clips every vertex
  instead.

## The loop

**`make sky` FIRST** — every weather (with a light fall and a blizzard) against
every three hours on one seed from one place, as one sheet
(`previews/sky-<seed>.png`; `ARGS="--hours=10,17,22 --weathers=fair,blizzard
--width=640 --height=360"` to zoom a few cells). A map is dealt one sky at one
hour, so a race's screenshot can only say whether that one is wrong; the
ladder is judged side by side. Then:

1. `make world SEED=<n> ARGS=--views=vista,powder,forest` at seeds with an
   EARLY and a LATE hour (`make level SEED=<n>` prints the day; a low sun is
   where a palette change breaks) — the dome, the haze on the rim, the blue
   in the shadows.
2. Sample a column of pixels through the skyline when a picture is "somehow
   flat" rather than arguing about it — the step at the horizon is a number.
3. `npx vitest run tests/world_render_test.ts` — the colour model.
4. `make build`, `make screenshots` — the game's framing at every viewport;
   `make profile` if the shadow or a pass changed.

## What the change obliges elsewhere

- `make world` pictures at an early and a late hour, before and after, in the
  PR; `make profile` for a shadow or pass change.
- A change to R15's bands → `docs/level-generator.md` (verbatim), `make
  analyze`, `tests/mapgen_test.ts`.
- The renderer bullet in `docs/architecture.md`.
- A `.changes/unreleased/` fragment — the sky is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
colour that only read right in linear light, an hour at which the palette
broke while the rest held, a shadow artefact and its cause.
