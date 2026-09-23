---
name: snow-look
description: "Use when working on how the SNOW LOOKS — the snow as DRAWN rather than as simulated: the terrain's shader (`snow-glsl.ts` grafted into a MeshStandardMaterial by `terrain.ts`), the ground read per pixel off the gradient texture, the wrap lighting and its blue terminator, the GLITTER (world-space crystal facets flaring when they line the sun up with the eye), the sheen at a grazing angle, the GROOMED TRACK (greyer, shinier, the comb's corduroy along it), the forest tint past the far band, and the DEFORMATION — the world-space trail map every rider's contacts are stamped into (`trail-stamp.ts` decides each capsule, `trail-map.ts` keeps the coarse and fine maps), lowering the snow in the vertex shader and bending the normal per pixel. Not what the snow DOES to the sled (`sled-physics` — `snow.ts` is the engine's), not the sky it is lit by (`atmosphere`), not the spray in the air (`visual-effects`)."
---

# The snow's look — the snow as drawn

The snow is the product's face: it fills most of every frame. `sled-physics`
owns what the snow DOES — how far it lets a probe sink, what it costs, how it
grips; this skill owns everything between the generator's heightfield and the
pixel: the light on it, the grain of the groomed track, the glitter, and the
furrows every rider leaves. The one rule under all of it: **nothing here
moves the ground the physics rides.** A vertex is the generator's own height,
lowered only by the trail map, and everything else this skill does happens to
the LIGHT.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
snow-look --list`. Load **`skill-reflection`** at both ends of the session
and **`write-code`** beside this one.

| Load beside this one | For |
| --- | --- |
| `sled-physics` | the sink the trail is floored at — a furrow that is too shallow in powder may be a physics question |
| `atmosphere` | the sun, the sky's blue and the haze every light here reads |
| `visual-effects` | the spray in the air over the trail |
| `nature` | the terrain mesh (the clipmap) and the trees the forest tint stands for |
| `game-feel` | whether the snow reads as speed at riding pace |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/terrain.ts` | The clipmap mesh (`nature`'s geometry) and the GRAFT: `snow-glsl.ts`'s chunks spliced into a `MeshStandardMaterial`, the three textures per level (the heights, the GROUND map — gradient, packed, wooded — and the track's direction), `TERRAIN_QUALITY` |
| `pwa/src/game/snow-glsl.ts` | HOW THE SNOW IS LIT, per pixel: the slope off the ground's gradient texture (never the mesh's normals — the clipmap's rings would show on every hill), fine noise over it, WRAP LIGHTING for the soft blue terminator (`SSS`), the GLITTER (world hashed into cells, a random facet each, a flare where it lines the sun up with the eye, faded before a cell is smaller than a pixel), the GROOMED TRACK (greyer, shinier, no glitter, the CORDUROY along the track direction, `LOOSE` powder standing over it), the forest tint, and `GLARE` — snow painted brighter than white so the tone mapper brings the lit side down to an unclipped white |
| `pwa/src/game/trail-stamp.ts` | WHAT A SLED LEAVES, as arithmetic, three-free: every contact (`SledState.contacts` — the skis, then the tread's stations) lays a CAPSULE from where it touched at the last stamp to where it touches now, so a trail is continuous at any speed and frame rate; `drawnDepth` (the physics' sink or the powder's own furrow, whichever is deeper, scaled by how much of the snow was powder); the berm beside it (`furrowProfile`); `TRAIL` — every number; a probe that jumped further than `TRAIL.jump` is a reset, not a trail |
| `pwa/src/game/trail-map.ts` | THE TRAIL MAP, on the GPU in world space: a COARSE map over the whole basin (every stamp of every rider, for the life of the run — a rival's trail on the far side is still there when the player comes round) and a FINE window round the player at a few centimetres a texel, moved when he rides off its centre (the old window copied, the new edge filled from the coarse map). Each stamp an instanced quad with MAX blending: a furrow ridden twice is as deep as the deeper, and a berm never fills a trough. `TRAIL_GLSL`'s `trailAt` is the one decoder |
| `pwa/src/game/renderer.ts` | Stamps every rider's contacts each frame (even with `present` off, so a fast-forward still cuts its trails) and hands the terrain the trail uniforms |
| `pwa/src/identity.ts` | `PALETTE.snow`, `snowShadow`, `track` — the colours the shader is keyed on |

## The three trails, and why

The skis stand a stance apart outside the tread and run a ski-width wide; the
tread's stations, left and right, together press a band its own width between
them. Laid over each other that is the snowmobile's signature — **a wide band
with two thin lines either side** — and it falls out of the probes rather than
being drawn as a decal. A change that makes the trail read as one wide smear or
as ten little lines has broken the one picture a player recognises.

## The judgement: LOOK, at the right moments

There is no bench for light. The lab is `make world` — one run ridden by the
bot, drawn through the game's own renderer — because a trail only exists after
somebody has ridden through the snow:

```sh
make world SEED=38 ARGS=--views=furrow,lookback,powder,powder-high   # the trails: close, behind, in powder, from above
make world SEED=38 ARGS=--views=track,hood                           # the groomed track and its corduroy
make world SEED=38 ARGS=--views=vista,forest                         # the snow at range, the forest tint
```

(`CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web session; it builds its own
bundle, so no `make build`.) Three habits:

- **Judge under a LOW sun as well as a high one.** The glitter, the wrap and
  the trough walls are all sun-angle effects; a seed dealt an early hour
  (`make level SEED=<n>` prints it) is where a change breaks.
- **Zoom.** Crop the furrows at full resolution — three trails read as three
  only up close, and at a quarter size you are judging the tone.
- **Paint the raw channel.** When a trail looks wrong, write `trailAt`'s depth
  straight into the colour in a diagnostic build before touching a number —
  one shot says "the map is empty" (a stamping bug) or "the map is right and
  the light is wrong" (a shader bug), where five tuning rounds guess.

Then the built app: `make build`, `make screenshots` at every viewport.
`make profile` before and after anything that adds a pass, a texture read or a
stamp — the trail map's stamping and the clipmap's fill are the dearest parts
of the frame.

## The rules

- **What is drawn IS what is simulated — with one deliberate exaggeration,
  stated once.** The ground is the generator's heightfield, sampled on the
  GPU. The furrow is `drawnDepth`: never SHALLOWER than the physics' sink (a
  sled must never ride above its own trail), deeper where the powder would
  honestly leave a hand-deep furrow at a speed the physics planes over.
- **The shading never sees the mesh.** The slope comes from the gradient
  texture, the furrows from the trail map's own finite differences. A snow
  lit by the clipmap's vertex normals shows its rings on every hillside.
- **Pressed snow is barely darker than fresh.** What makes a furrow read is
  its SHAPE — walls turned from the sun, a floor that sees less sky. A furrow
  painted dark reads as a dirt road.
- **The glitter is world-space and still.** Glints sit on the snow and
  twinkle as the LENS moves; a glitter hashed in screen space crawls with
  the camera. Fade it with distance before a cell is smaller than a pixel, or
  it aliases into grey noise.
- **The groomed track is packed snow, not a road.** Greyer and shinier by a
  touch, the corduroy along the track direction, no glitter (the crystals
  are crushed). `packedAt` is the one field that says where it is — the same
  one the physics reads for grip.
- **Snow is brighter than its paint.** `GLARE` pushes the tone past white so
  a low sun does not arrive grey; a change that clips the lit side to flat
  white has lost the sheen.
- **MAX blending, two maps, one decoder.** A new stamp source (a rival, a
  landing crater) goes through `stampsOf` and the same instanced quad; a
  second encoding of depth drifts from `trailAt`.
- **A stamp is continuous and a reset is not a trail.** Capsules from the last
  touch to this one, broken on a jump past `TRAIL.jump` — a reset that drew a
  furrow across the map is `world_render_test`'s case.
- **Every hand-written shader ends with `#include <colorspace_fragment>`**
  and reads the haze through `hazeMaterial`.

## What the change obliges elsewhere

- `make world` pictures (furrow, track, vista) before and after, under an
  early and a late sun, and `make profile`, in the PR.
- `npx vitest run tests/world_render_test.ts` (the trail's arithmetic).
- The renderer bullet in `docs/architecture.md`; a `.changes/unreleased/`
  fragment — the snow is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
trail that was a stamping bug and looked like a shader bug (or the other way
round), a term that only read right zoomed, a sun angle a change was never
judged at.
