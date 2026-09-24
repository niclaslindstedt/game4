---
name: sound-effects
description: "Use when adding or tuning a SOUND — the engine (a twin two-stroke through a CVT: the block, the firing note, the pipe's rasp, the intake, the belt's whine), the snow and the air (the hiss on the groomer, the powder's rush, the carve, the track's clatter, the wind — the continuous BEDS), or a one-shot: a landing soft or hard, a trunk, a rival leaned on, a checkpoint's chime, a lap, a miss, a reset, the lights, GO, the flag. Every sound is synthesized at runtime from authored parameters under `pwa/src/game/audio/`; the game ships no audio file. Owns the vocabulary (`lib/voice.ts`), the instrument (`lib/synth.ts`), the bank, the route, the beds and the listener, the mixing budget, and the audition page — `make audition`, and `--meter` for the levels — which is the only honest way to judge any of it. NOT for music: the game has none, by design — its sound is its effects alone."
---

# Designing sound effects

The game ships **no audio files**. Every sound is synthesized at runtime from
a handful of numbers, authored as TypeScript data in `pwa/src/game/audio/`,
which keeps the app tiny and offline and makes the sound design as diffable
as the sled's spec. `docs/audio.md` is the reference; this is the loop.

**The register is a modern arcade racer in the snow — not a chip, and not a
sample library.** A snowmobile is a small two-stroke with grit in it, a belt
that whines, a track that hisses and clatters, and the wind — and SNOW
SWALLOWS TRANSIENTS. Four things in the instrument exist to reach that:

| Reach for | When |
| --- | --- |
| `color: "brown" \| "pink"` on a noise | ALWAYS decide this before the filter. Brown is mass and depth (a landing's weight, the powder's rush), pink is hiss and wind and every puff of snow, white is grit and the crack of wood. |
| `filter.to` — a moving cutoff | Any sound that is a GESTURE rather than a hit: a puff of powder opening, the whoosh past a flag. |
| `drive` — the waveshaper | Anything with combustion or a body in it. A clean triangle is a flute; a driven one is an engine. A SOFT curve at every setting — never a clip, which aliases and which a Bluetooth codec turns into a swirl. |
| `attackMs` + `holdMs` on a NOISE | Every landing in snow. Powder SWELLS: a brown thump that opens over a few milliseconds with a pink puff over it. Never on the things that are not snow — a trunk cracking, the chassis bottoming, two machines meeting, the chimes. A bed is a LAYER and has no envelope at all. |

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs sound-effects --list`. Load
**`skill-reflection`** at both ends, **`write-code`** beside this one, and
**`game-feel`** whenever the acceptance test is "does it sound like riding".

## Files

| File | Role |
| --- | --- |
| `pwa/src/lib/voice.ts` | **The vocabulary.** Every parameter a sound may be written in, the `Synth` interface, the `LayerSpec` / `LayerTarget` / `Layer` a bed is made of, and the arithmetic worth testing without a browser. DOM-free on purpose. |
| `pwa/src/lib/synth.ts` | The instrument: `tone()` and `noise()` for one-shots, `layer()` for the beds, the echo bus, the master limiter, the context lifecycle (unlock, iOS interruption, zombie-context recovery). The ONLY module that touches WebAudio. |
| `pwa/src/game/audio/bank.ts` | **THE RACE'S SOUND DESIGN** (`RUN_BANK`): every discrete sound as data — a description and a list of voices. `land_soft`, `land_hard`, `hit_tree`, `bump`, `checkpoint`, `lap`, `missed`, `reset`, `count`, `go`, `finish`. |
| `pwa/src/game/audio/route.ts` | **WHICH sound an event makes** and how big (`PlayShape`) — pure functions from `GameEvent` (`soundForEvent`, `soundsForStep`, `heardFrom`). |
| `pwa/src/game/audio/engine-voice.ts` | The engine and the drive as SEVEN LAYERS (motor, hum, octave, rasp, bass, intake, belt): `engineTargets` is a pure function of the state. The note's pitch is arithmetic — `rpm / 60 × FIRINGS_PER_REV` (a twin two-stroke fires twice a revolution) — and the belt's is the TRACK's speed over `LUG_PITCH_M`. |
| `pwa/src/game/audio/snow-voice.ts` | The sled on the snow and the air as FIVE LAYERS (hiss, powder, carve, tread, wind): `snowTargets`, a pure function crossfading on ONE number — `SledState.packed`. |
| `pwa/src/game/audio/listener.ts` | **WHERE THE EAR IS.** `LISTENERS`, one row per camera rung: what each seat does to the engine, the snow, the wind and the one-shots. The beds and the router both read it. |
| `pwa/src/game/audio/ride-bed.ts` | The scheduler: reads the player's `SledState` once a frame and turns it into every layer's target, through the seat's listener row. The field has no bed of its own yet. |
| `pwa/src/game/audio/bird-voice.ts`, `bird-bank.ts`, `bird-bed.ts` | **THE WOOD'S VOICES.** Who cries and how often (`BIRD_CALLS`, plan-free), the cries themselves (`BIRD_BANK`, spread into `RUN_BANK`), and the scheduler that raises them off the birds' own plan (`birdPlanFor`) — a CUE drawn off each flock's scatter (`criesIn`), never an event and never `state.rng`. The grouse's whirr is the one cry a sled causes (`flushAt`). `tests/birds_test.ts` holds every call to a bank id. |
| `pwa/src/game/audio/rack.ts` | The plumbing every bed shares: build a layer, rebuild one whose context died, steer it on its glide. |
| `pwa/src/game/audio/play.ts`, `types.ts` | Firing one def through a shape; what a def and a shape ARE. |
| `pwa/src/game/audio/bus.ts` | One synth, the volume-scaled view the SOUND switch moves, and the unlock. |
| `pwa/src/game/audio/index.ts` | The front door (`createRunAudio`): events in, the beds fed per frame, `silence()`. `App.tsx` is its one caller. |
| `pwa/src/game/settings.ts` | The switch the player keeps (`sound`). |
| `scripts/audition.mjs` | **THE REVIEW SURFACE** (`make audition`) and the meter (`ARGS=--meter`, `--seat`). |
| `tests/audio_test.ts` | The guards: every event answered, the mix ceiling, the beds' shapes, the silence said, every cutoff under the headset's Nyquist — against a recording synth, no DOM. |

## An event, a cue, or a bed — the first decision

| It is… | When | Where it goes |
| --- | --- | --- |
| **An EVENT sound** | The simulation reported a moment: `step()` pushed a `GameEvent` | A def in `bank.ts` + a rung in `route.ts` |
| **A CUE** | The APP can work it out from the state and the engine never said so | Raised by the bed's own reading of the state (`ride-bed.ts`) |
| **A BED** | It has no beginning and no end: the engine, the belt, the hiss, the powder, the wind | A LAYER in `engine-voice.ts` / `snow-voice.ts`, steered per frame |

**Never add a `GameEvent` for presentation**: if the app can work it out from
the state it already has, it must. **A field left out of a route rung answers
every value of it** — add a `case` only when the event picks a DIFFERENT
sound (a landing the suspension took and one it could not); a different SIZE
is a `PlayShape` on the sound already there.

## A BED is a LAYER; an EVENT is a one-shot

A one-shot is attack-then-decay; a `holdMs` turns it into a swell. A bed is
never written out of one-shots: it is a `Layer` built ONCE — an oscillator or
a looping window onto the noise pool, a filter, a saturation curve, a gain —
and STEERED every frame with a `LayerTarget` (level, pitch, cutoff, grit, pan)
and a glide. The rules:

1. **What a layer IS goes in the `LayerSpec`; what MOVES goes in the target.**
   A different colour of rush is a second layer, not a colour switch.
2. **A bed is a PURE FUNCTION from the state to a table of targets**
   (`engineTargets`, `snowTargets`) — testable, driveable from the audition
   page's sliders. Add a layer by adding a key to the spec table, the glide
   table and the target function; the tests read targets by NAME.
3. **The glide is the character of the change**, in seconds.
4. **A driven layer has ONE curve and moves the gain in front of it**
   (`grit`); swapping a curve under a running signal is a step.
5. **Nothing is booked ahead.** A late frame leaves every layer holding its
   last target; a bed fed on a cadence stutters when starved, which a player
   reports as CRACKLE.
6. **…so SILENCE HAS TO BE SAID.** Every frame that is not hearing the race —
   the pause card, a hidden tab, a held screenshot — calls
   `RunAudio.silence()`. A path that skips `frame()` without hushing is the
   engine playing on under the pause card.
7. **A silent layer costs nothing to keep.** Level 0, left built.

## What the snow taught the vocabulary

- **A CVT is why it sounds like a sled and not a car.** The clutch holds the
  engine near its power peak while the belt walks up the sheaves, so under
  full throttle the NOTE barely moves from rest to ninety — all the
  acceleration is in the belt's whine climbing under it. A layer set that tied
  everything to the revs would drone.
- **Packed or powder is the whole story of the snow**, and it is one number
  (`SledState.packed`): riding off the loop is heard as the hiss giving way to
  the rush before anything else changes. The powder's rush is loudest SLOW,
  where the sled is sunk and shoving snow, and thins as it planes.
- **The air is part of the engine's voice.** Off a kicker the tread unloads
  and the crank runs free — the physics does that; the bed only hears it: the
  note climbs, the belt screams with nothing to push, the snow layers go, and
  only the WIND keeps going. Never fake it with a take-off one-shot.
- **The pitches are arithmetic; the levels are taste.** Nothing about the
  note or the belt's whine is chosen by ear.

## Mixing rules, enforced by test

- A hard landing and a trunk are the ceiling; nothing in the bank passes the
  test's cap. Ordinary contacts sit under them; the course's chimes (a
  checkpoint, a lap) are quieter than the snow — heard OVER a race, never
  instead of one.
- **A bed's level is heard THROUGH THE LISTENER.** Every target is multiplied
  by the seat's row in `listener.ts`. Retune at the CHASE seat, then check it
  from the hood and the high boom. A camera-dependent sound is a COLUMN in the
  listener table, never a branch in a bed or a def.
- **Under a card the whole bed is ducked** (`CARD_DUCK` in `App.tsx`), and the
  race's EVENTS make no noise at all without the player's hands on the sled
  (`soundsLive` in `shell.ts`): a checkpoint the bot takes under the front
  door is not news.
- Keep every sound's `description` current; a def without one fails the test.

## Iteration cycle — a SOUND

1. Edit the def in `bank.ts` (or the bed's target function). A new sound needs
   a rung in `route.ts` or a cue that raises it, or it can never play.
2. `make audition` and **listen in a browser**, next to the sounds it will be
   heard beside.
3. **A session that cannot listen METERS**:
   `CHROMIUM_PATH=/opt/pw-browsers/chromium make audition ARGS=--meter` drives
   the page headlessly and prints a level (dBFS) for every bed preset and every
   sound in the bank (`--seat` picks the camera it listens from). Read it as a
   SHAPE: idle under cruise under flat out; the air under flat out with the
   snow gone; the landings at the top of the bank and the chimes at the
   bottom; nothing within a few dB of the limiter. Keep the table before and
   after, in the PR. A mix that meters wrong IS wrong.
4. `npx vitest run tests/audio_test.ts`.
5. For a BED, move the sliders through the whole range; the faults are at the
   ends — a buzz at idle, a hiss that arrives all at once.
6. **Then hear it in the game** (`npm run dev`) — a landing lands over an
   engine, a hiss and the wind.

**The audition page is part of the deliverable.** A PR that changes what the
game sounds like and gives its reviewer no way to hear it is unreviewable:
say `make audition` in the PR body and paste the meter's table.

## When a sound is allowed to START

A browser makes no sound before the player has touched something, and a
context built outside a real gesture is one iOS Safari will never resume.
`unlockAudio()` hangs off document-wide `pointerdown` and `keydown` in the
capture phase (`App.tsx`) — never off a cue a hover could raise.

## What the change obliges elsewhere

- `make audition` before and after, the meter's table in the PR;
  `npx vitest run tests/audio_test.ts`.
- `docs/audio.md`: a new layer, a new column in the listener, a new cue or a
  new def is a line there.
- A `.changes/unreleased/` fragment — a sound is heard for the whole race.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. The lessons here are
a **palette of parameter recipes that worked** — read them back before
designing a sound, and add to them after.
