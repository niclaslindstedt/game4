# game4 — build brief (temporary; deleted before merge)

This is the contract every agent building game4 works to. game4 is a NEW game built by
porting the non-water parts of the sibling repo `/home/user/game3` (a jet-ski racer,
"Sea Haven") and adapting them to a SNOWMOBILE racer. `/home/user/game2` (the rally
game) is a second reference for anything land-based (terrain, trees, car-on-ground
physics, snow tracks — it has a `tracks` lab for tyre tracks in snow).

## Identity

- Name: **Powder Run** (`APP_NAME`), short name `PowderRun`, publisher "Agilator Games".
- Site: `https://game4.niclaslindstedt.se` (pwa/public/CNAME), repo `https://github.com/niclaslindstedt/game4`.
- License: PolyForm-Noncommercial-1.0.0, same as game3; the Required Notice names game4.
- Palette (identity.ts `PALETTE`): snow `#f4f8fb`, snowShadow `#b9cde0`, sky `#cfe6f7`,
  skyHigh `#6fa8dc`, pine `#1f4a36`, pineDark `#143326`, track `#dfe7ee`, flag `#e8412c`
  (the brand accent / checkpoint flags), hudInk `#ffffff`, hudShadow `#0d2233`, hudBad `#ff5a4e`.
  Brand + boot background: `#6fa8dc` (skyHigh).
- The app mark: a snowmobile track's two parallel trails curving over a hill (two paths), same
  "mark as data" pattern as game3's `app-mark.ts` / `icon.svg` / `generate-icons.mjs`.
- Deploy slots `/`, `/preview/`, `/branch/` exactly like game3's `pages.yml`.
- Nothing may name a real product/brand/game/manufacturer (game3's rule carries over).
  "snowmobile", "sled", "snow machine" are generic words and fine.

## Scope of the vertical slice

IN: one generated seeded map (no biomes — ONE nature: snowy hills, mountains, forests of
snow-covered conifers, open powder fields), a closed-loop packed-snow race track laid over it,
one snowmobile (with rider), RACE mode only (player + 3 bot rivals, 3 laps), clear skies only
(sun placed by a seeded hour, no weather/clouds/rain/night required), the HUD copied from game3
(speed dial, lap/checkpoint counter, race clock, position, last split, touch handlebar + throttle
lever, keyboard) WITHOUT the minimap, a snow shader (sun glints/sparkle, blue shadowed
subsurface look, specular), snow that DEFORMS under the sled (visible trails in powder), snow
spray, synthesized audio (engine, track/snow hiss, wind), shell: splash/attract card, main menu
(one tile: RACE, plus maybe "seed" shown), loading card, pause card, finish plate.
Desktop (tauri/) and store (native/) shells ported with the new identity.

OUT (do not port): water/waves/wash/sea/ocean/tornado/ice/fauna/birds/rocks/grass/flowers,
biomes, campaign, level rating, generator versions/digests of campaign levels, options page,
developer page, benchmark, screenshots/gallery/shutter, replay/ghost/records, minimap,
weather/clouds/rain/night/stars, colour grading per coast, cloud-save, store listing/metadata.

## Architecture (same three layers as game3; `tests/imports_test.ts` holds them)

- `engine/` — framework-free, imports nothing outside itself. Fixed 120 Hz `step(state, input)`,
  deterministic per seed, randomness only through `state.rng` (engine/lib/prng.ts). Prints only
  via `engine/output.ts`. `engine/index.ts` is the one public surface (`@engine` alias).
  - `engine/lib/` — already copied from game3 (heightfield, math, noise, polyline, prng, quat, solar).
  - `engine/mapgen/` — THE WORLD GENERATOR (owned by the mapgen agent).
  - `engine/game/` — the sled, the snow, the course, collisions, the race, the step (physics agent).
  - `engine/sim/` — bot rider + headless simulator (physics agent).
  - `engine/analysis/` — dev-time level checks (mapgen agent), optional/minimal.
- `pwa/` — Preact + three.js app; renders `GameState`, never mutates it.
- `tests/` root vitest `<topic>_test.ts`; `scripts/` Node tooling via `scripts/lib/cli.mjs`.
- Files under 1000 lines each (`tests/file_size_test.ts`).
- Coordinates: y up, heading 0 = +z, clockwise from above; pitch nose-up positive; roll
  right-side-down positive (game3's conventions, `engine/lib/quat.ts`).

## The Level contract (mapgen → everything else)

`generateLevel(seed: number, opts?: GenerateOptions): Level` from `engine/mapgen/index.ts`.
The physics agent codes against THIS shape; the mapgen agent implements it exactly
(extra fields allowed, none of these may be renamed):

```ts
export interface TreeDef { x: number; z: number; y: number; height: number; radius: number /* trunk collision radius, m */; crown: number /* crown radius, m */; }
export interface Checkpoint { x: number; z: number; y: number; heading: number; width: number; s: number /* arc length along the track, m */; }
export interface TrackPoint { x: number; z: number; y: number; s: number; heading: number; width: number; }
export interface Spawn { x: number; z: number; heading: number; }
export interface Level {
  seed: number;
  size: number;              // world is [0,size]x[0,size] metres (≈1600)
  cell: number;              // heightfield cell size, m (≈2)
  ground: Heightfield;       // engine/lib/heightfield.ts — terrain height incl. the track's grading
  groundAt(x: number, z: number): number;          // bilinear height
  normalAt(x: number, z: number, out: {x:number;y:number;z:number}): void;
  packedAt(x: number, z: number): number;          // 0 = virgin powder … 1 = fully packed track
  track: { points: TrackPoint[]; length: number; closed: true };   // closed loop, ~2.5–4 km, points every ~2 m
  checkpoints: Checkpoint[];  // gates every ~120–200 m along the loop, index 0 is the START/FINISH line
  spawn: Spawn;               // the grid anchor: a random seeded spot in powder 25–90 m off the track
  grid: Spawn[];              // 4 riders side by side around `spawn` (player is index 0)
  trees: TreeDef[];           // trunks the sled collides with; none on the track corridor
  sun: { hour: number; dayOfYear: number; latitude: number };   // clear sky, seeded
  laps: number;               // 3
}
```

Terrain design goals (the mapgen agent's craft): a big playable basin surrounded by mountain
flanks at the map edge; rolling hills and ridges inside it; hilltop crests shaped so they KICK
(natural jumps), long descents, bowls, open powder meadows between forests; forest density by
noise with clearings; no water at all. The track is a smooth closed loop (never self-crossing
unless a deliberate over/under is impossible — keep it simple: non-self-intersecting), graded
into the terrain (cross-slope flattened, longitudinal grade limited but with some crests that
make jumps ON the track), width 10–14 m, packed. `packedAt` fades from 1 on the corridor to 0
over a few metres of shoulder. Spawn: random seeded location near the track in open powder,
heading toward the nearest track point; the race start line (checkpoint 0) is the track point
nearest the spawn, so riders first ride through powder onto the track.

## Race rules (physics agent)

`createGame({ seed?, level?, rivals = 3, laps = level.laps })` → `GameState`. Phases:
`countdown` (3 s lights) → `racing` → `finished`. Each rider must pass the checkpoints in order
starting at 0; a lap ends on crossing 0 again after all others; after `laps` laps they finish.
Missing a checkpoint does not DQ — the next one simply isn't credited until the missed one is
taken (show the arrow). Reset (key R / button): stand the sled on the track at the last passed
checkpoint (also automatic after being upside-down/stuck ~3 s). Position = laps done, checkpoints
done, then distance to next checkpoint. Rivals are whole rider states stepped by the same
function (game3 `rivals.ts` pattern) ridden by `engine/sim/bot.ts`.

## Snowmobile physics (physics agent — `craft-physics`/`game-feel` adapted)

Rigid body with quaternion orientation, 120 Hz. Contact model: two SKIS (front, steerable,
spring-damper suspension) and the TRACK/TREAD (rear, several probes along its length, spring-
damper) against `groundAt` MINUS SNOW SINK: in powder (packed 0) the sled sinks deeper at low
speed and "planes" up on top at speed (flotation rises with speed² — the planing-hull analogy
from game3 carries straight over), with higher drag; on packed track sink is small, drag low,
grip high. Tread thrust limited by traction (power → engine rpm → clutch → track speed; slip
when too much). Steering = ski lateral grip (dominant on packed), plus rider LEAN shifting weight
(roll) which carves in powder (counter-steer feel). Brake. Air: rider pitch control in the air
(throttle spins the track → gyroscopic nose-up; brake → nose-down; lean keys pitch), landings
absorbed by suspension, harsh landings cost speed. Trees: trunk cylinders; hit = impulse + speed
loss + `hit` event. Steep slopes: the sled can climb powder slopes with momentum but stalls on
too steep; can roll over (reset rule). Emits events: `land`, `air`, `hit`, `checkpoint`, `lap`,
`finish`, `reset`. `CraftState` exposes what the renderer needs: position, orientation quat,
velocity, speed (|v|), rpm, throttle, steer, lean, airborne/airTime, per-ski and tread contact
points with their sink depth (so the renderer can stamp TRAILS), suspension compression per ski.
Units in SI; every tuning number in `engine/game/defs/tuning.ts` carries its unit.
One sled in `engine/game/defs/sled.ts` (a trail/cross sled: ~230 kg dry, ~110 kW, top speed ~120
km/h on packed, ski stance ~1.05 m, track 3.2–3.5 m long × 0.38 m wide).

## Rendering goals (pwa agent)

Terrain mesh from the heightfield (LOD'd chunks or a camera-centred grid), snow shader: soft
white diffuse with blue ambient/shadow tint, subsurface-looking falloff, view-dependent sparkle
(glitter) with sun, sun specular sheen, micro-normal noise. Packed track: flatter, slightly
darker/greyer with a fine corduroy/grain. TRAILS: a render-target "trail map" in world space
(e.g. a sliding window around the player, or map-wide at modest resolution) into which each
rider's ski/tread contacts stamp depth; the terrain vertex shader lowers the snow there and the
fragment shader shades the trough walls — so trails persist and are visible. Snow-covered
conifers (instanced, low-poly, white loaded branches). Snow spray particles from the tread and
skis, a big puff on landings. Sky: gradient dome + sun, clear, fog/haze. Camera ladder from game3
(chase variants, hood/bars, far). HUD copied from game3 minus the minimap and replays.

## Delivery rules for all agents

- Work ONLY in `/home/user/game4`, only in the paths your task owns. Do NOT git commit/push —
  the coordinator commits.
- game3 is the template: copy files and ADAPT them (retype water→snow vocabulary: a craft is a
  sled, a shore is a map, a gate is a checkpoint), keep its comment style and density, and the
  spirit of its CLAUDE.md rules. Never import from game3/game2.
- SPDX header `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0` on every source file.
- Run `npx tsc --noEmit` (root) and the tests you wrote (`npx vitest run tests/<x>_test.ts`)
  before reporting. Report back concisely: files created, public API, what works, what is
  stubbed, test results. Keep the final report under ~60 lines.
