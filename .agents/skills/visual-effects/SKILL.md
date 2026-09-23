---
name: visual-effects
description: "Use when creating or tuning what the SLED THROWS OFF, what it LEAVES and what the rider FEELS — the spray (the roost off the tread, the ski spray off a carving edge in powder, the landing puff), the trails' STAMPING (every contact laid as a capsule into the trail map, the drawn depth, the berm, the break on a reset), and the vibration table under the player's hands (the track's chatter, a landing, a trunk, rolling over, the checkpoint's tick). Covers the event → effect flow (the engine emits events and writes `SledState`; the renderer turns them into transient visuals and pulses), the two surfaces (the three.js scene for the air, the trail map for the snow), the low-poly art direction the effects sit inside, and the loop that judges them — zoomed. Not the snow's own light (`snow-look`) and not the sky (`atmosphere`)."
---

# Visual effects — what the sled throws off

Transient FX are **presentation only**: the engine knows nothing of them. It
emits an EVENT or writes a `SledState` reading, and the app turns that into a
short-lived drawn thing, a furrow in the snow or a pulse in the hands. An
effect never changes what happens, only how it reads. The renderer reads
`GameState`; it never mutates state and never steps physics.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
visual-effects --list`. Load **`skill-reflection`** at both ends of the
session and **`write-code`** beside this one. For the snow the trail is drawn
in, `snow-look`; for the sound the same moment makes, `sound-effects` — the
pulse and the sound read the same event, and where they disagree it is on
purpose.

## The two surfaces

Pick by what the effect is anchored to:

| Surface | Use for | Lives in |
| --- | --- | --- |
| **The three.js scene** | Anything IN THE AIR: the roost, the ski spray, the landing puff — one pool of sprites, lit as the snow is and faded into the same haze | `pwa/src/game/spray.ts` |
| **The trail map** | Anything IN THE SNOW: every furrow a ski or the tread presses, the berm beside it — stamped as capsules into a world-space map the terrain shader lowers the snow by and shades | `pwa/src/game/trail-stamp.ts` decides each stamp (three-free), `trail-map.ts` keeps the maps (`snow-look`'s), `renderer.ts` stamps every rider every frame |

There is no third surface: a decal or a second mesh laid over the snow is lit
differently from the ground under it and reads as paint. The LENS's reaction
(the flown hand-over, a landing's kick) is the camera's — `camera.ts` under
`game-feel`.

## The modules

| Effect | Where |
| --- | --- |
| THE ROOST: snow flung up and back off the tunnel, harder with power and `slip`, much harder in powder than on the groomer | `spray.ts` |
| THE SKI SPRAY: a sheet off a carving ski's outside edge in powder, sized by the turn and the speed | `spray.ts` |
| THE LANDING PUFF: a ring of powder from under a sled coming down, sized by how hard — read off the airborne → grounded TRANSITION rather than the `land` event, so a frame that ran two steps cannot swallow it and a rival's landing throws the same puff | `spray.ts` |
| THE TRAILS: a capsule per contact from its last touch to this one; `drawnDepth` (the sink or the powder's furrow, whichever is deeper); `furrowProfile` for the berm; `TRAIL.jump` breaks the line on a reset | `trail-stamp.ts`; `tests/world_render_test.ts` |
| WHAT IS FELT: the track's CHATTER read off `skiCompression` every step, a landing, a trunk, rolling over (read off the state — there is no event), a checkpoint's light tick; what does NOT rumble and why | `pwa/src/game/rumble.ts` (DOM-free; `tests/rumble_test.ts`) |
| The motor: the browser's Vibration API or the store shell's tap, the player's switch | `pwa/src/game/haptics.ts` — the only `navigator.vibrate`; the phone's half is `platform-shells`' |

## The flow: reading → effect → draw

1. **The engine says what happened.** A moment is a `GameEvent` (`land`,
   `hit`, `checkpoint`…); a condition is a `SledState` field the engine
   wrote (`throttle`, `slip`, `packed`, `skiAngle`, `airborne`, `contacts`,
   `skiCompression`). Event-driven for "at the moment of", state-driven for
   "while". The renderer never re-derives intent from physics deltas.
2. **Observe every STEP where a reading spikes, draw every frame.** A
   reading that spikes for two steps is a random sample of itself if read
   once per frame. `rumble.ts` reads the chatter per step and pays it out no
   oftener than its gap; the puff reads a transition, not a frame's state.
3. **The trail is stamped every frame, drawn or not.** `renderer.draw` with
   `present` off still stamps — which is how a fast-forward (the world lab,
   a pre-rolled screenshot) arrives with the trails that run actually cut.
4. **The effect animates by its own progress** off the sim clock, so a
   pre-rolled still carries the same spray the player would see.

## The art direction — effects must sit inside it

The world is faceted low-poly under a sun and a sky light, every texture made
in code. Snow in the air is:

- **A cloud of fine powder, not droplets.** Soft sprites that grow a little
  as the cloud disperses, lit the sun's colour on the lit side and the sky's
  blue in shade, fading into the same haze as the hills. A spray lit flat
  white reads as foam; one lit grey reads as smoke.
- **Motion carries it.** Speed reads through spawn rate, inherited velocity
  and lifetime; a roost that streams back sells 90 km/h better than any
  texture. On the groomer there is little loose snow — a thin spray; in
  powder, a plume.
- **The trail is the signature.** A wide band with a thin line either side
  (the tread between the skis). It is what a player sees behind every rival,
  and it persists for the whole race.

## Craft rules

- **Presentation-only, structurally.** No effect writes `GameState`, draws
  from `state.rng` or feeds anything back into `step()`. Renderer-side
  randomness uses its own source, deterministic per run.
- **Budget per frequency.** The spray and the stamping run continuously for
  four riders: pre-allocated pools, no per-frame allocation, one geometry
  and one material per system, one draw for the whole spray.
- **A trail never lies about the physics.** Drawn no shallower than the
  support the sled rides on; broken on a reset rather than swept across the
  map.
- **A pulse is sized against the RIDE, not a held key.** Size a rumble
  threshold from the bot riding the course at pace (`botInput`), never from a
  probe holding the throttle on the grid; and a phone has ONE motor and no
  mixer, so every buzz spent on news is a buzz taken off the next landing.
- **Events for sound too.** If the moment would also want audio, the EVENT
  carries what audio needs, designed once and read by `audio/route.ts` and
  `rumble.ts` alike.
- **Reduced motion.** Anything screen-filling or flashing needs a
  `prefers-reduced-motion` fallback that keeps the information.

## The iterate loop — LOOK at it, ZOOMED

1. **`make world SEED=38`** reaches the moments in one ridden run:
   `powder` and `powder-high` for the roost and the ski spray, `jump` and
   `landing` for the puff, `furrow` and `lookback` for the trails, `track`
   for the thin spray on the groomer. It builds its own bundle; no
   `make build`.
2. **Zoom** — crop the sled at full resolution; at a quarter size you are
   judging a smudge.
3. **Bench the numbers** when the question is WHEN rather than HOW:
   `make ride SCENARIO=kicker` says when the sled leaves and lands, so the
   puff's frame is known before it is looked for.
4. **Ride it** for anything that moves — a spray's timing and a pulse show in
   no still: `npm run dev`, or `make screenshots` at two offsets
   (`ARGS="--t 12"`, `--t 13`).
5. Judge, refine the worst beat, re-shoot. `make profile` before and after.

## Ship checklist

- [ ] Presentation-only — no simulation state touched, no `state.rng` draws.
- [ ] Right surface: the scene for the air, the trail map for the snow, the
      camera module for the lens.
- [ ] Sits inside the art direction: lit as the snow is, fading into the
      haze, no foreign fidelity.
- [ ] Pooled allocations; observed per step where the reading spikes.
- [ ] You LOOKED at it zoomed, at two moments.
- [ ] `npx vitest run tests/world_render_test.ts tests/rumble_test.ts`;
      `make profile` both tables in the PR.
- [ ] A `.changes/unreleased/` fragment — effects are player-visible.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
beat that only read zoomed, a reading that turned out to be sampled rather
than seen, a pulse sized off the wrong ride.
