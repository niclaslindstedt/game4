---
name: atmosphere
description: "Use when working on the SKY and the air under it — where the sun stands at the hour the race has reached on the map's day at its latitude (R15, `sunAtRun`), what colour it makes the dome, the two lights and the blue in the snow's shadows, the haze every far slope dissolves into (one sky function read along each surface's own direction), and the key light's tight shadow box that follows the lens. This slice's sky is ALWAYS CLEAR: no weather, no cloud, no night, no season's cast. Owns `pwa/src/game/sky.ts` (the colour model, three-free), `haze.ts`, `sky-dome.ts`, `environment.ts`, and on the engine side `engine/game/clock.ts` and R15 in `mapgen/sun.ts`. Not the snow the light lands on (`snow-look`), not the trees (`nature`), not what the sled throws (`visual-effects`)."
---

# The atmosphere: the sun, the sky and the haze

Everything over the snow and in the air between the lens and the far rim. The
picture is set here before a single furrow is drawn: the sun's elevation
decides the palette, the sky's blue decides what colour a shadow on snow is,
the haze decides how far the mountains read. A change here moves every
picture in the game.

**THIS SLICE HAS ONE WEATHER.** A seeded hour on a seeded winter's day at a
seeded latitude, always clear. What changes over a race is the sun's height
alone. Weather, cloud, night, stars and a season's cast are NOT BUILT — a
session asked for one starts with `engine-system` (R15 grows a weather) and
the sibling repos' skies (`game3`'s ladder of looks and `make sky` sheet,
`game2`'s storms), retyped for snow.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
atmosphere --list`. Load **`skill-reflection`** at both ends and
**`write-code`** beside this one for any code change.

## The engine's half, and the app's

The engine decides the FACTS and the app decides the PICTURE; nothing in the
engine has an opinion about colour.

| Fact | Where |
| --- | --- |
| The map's day: a latitude (46–64°N), a day of the year (mid-January to mid-March) and a starting solar hour (9–16 h) at which the sun is at least `sun.minElevation` up (R15) | `engine/mapgen/sun.ts` (`dealSun`, `declinationOf`), `LEVEL_RULES.sun` |
| The hour the race has REACHED — TEN MINUTES OF RIDING IS ONE HOUR OF SUN, so the shadows visibly swing over a race and no race rides into the dark | `sunHourAt(level, t)`, `sunAtRun(level, t)`, `SUN_SECONDS_PER_HOUR` in `engine/game/clock.ts` |
| The astronomy: the sun's elevation and bearing at an hour, a latitude and a declination | `engine/lib/solar.ts` (`sunAt`) — the generic pool |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/sky.ts` | WHAT COLOUR THE AIR IS: `skyLookAt(level, t)` → a `SkyLook` — the dome's zenith and horizon, the sun's own colour through the air it crossed (per-channel transmittance `exp(−k · airmass)` over the Kasten–Young air mass, `airMass`, `sunTint`), the two halves of the hemisphere light, the haze. Linear RGB throughout. THREE-FREE, so `tests/world_render_test.ts` reads the whole model |
| `pwa/src/game/haze.ts` | ONE SKY FUNCTION IN GLSL (`SKY_GLSL`, `skyColour(dir)`) and the haze every world material fades into, drawn from it along that surface's own direction (`HAZE_FRAGMENT`, `hazeMaterial`) — replacing three's one-colour fog; the uniforms ONE object shared by reference (`createHazeUniforms`, `writeHaze`) |
| `pwa/src/game/sky-dome.ts` | The dome: `skyColour` painted on a sphere round the lens with the sun's disc on it, through the same tone mapping and output conversion as every lit surface, so the haze meets it with no seam |
| `pwa/src/game/environment.ts` | Hangs it in the scene: the key light and the hemisphere light, the dome, the haze, re-read EVERY FRAME off the run's own clock; the key light's shadow box a few dozen metres across that FOLLOWS the lens's aim point, snapped to whole texels so a tree's shadow edge does not crawl |

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
- **The shadow box follows the lens, not the sled.** Far trees cast nothing;
  the haze and the terrain's forest tint carry the woods out there. Widening
  the box to shadow the whole basin is a blurred shadow for every tree.

## The loop

There is no sky contact sheet yet (the sibling's `make sky` is the model when
weather arrives). The review is:

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
