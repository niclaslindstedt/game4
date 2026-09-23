# Audio

Powder Run ships no audio files. Every sound is synthesized at runtime from a handful of authored numbers — TypeScript data under `pwa/src/game/audio/` — played on one small WebAudio instrument. That keeps the app tiny and offline and makes the sound design as diffable as the sled's own spec. The `sound-effects` skill is the working loop; this page is the shape of it.

## The register

A modern arcade racer in the snow — not a chip, and not a sample library. A snowmobile is a small two-stroke with grit in it, a belt that whines, a track that hisses and clatters, and the wind; and snow swallows transients, so a landing in powder is a brown thump that swells open under a pink puff rather than a click. The only sharp edges in the bank belong to the things that are not snow: a trunk cracking, the chassis bottoming, two machines meeting, the chimes.

## The layers of the code

| Module                                   | Role                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pwa/src/lib/voice.ts`                   | The vocabulary: every parameter a sound may be written in (`ToneOptions`, `NoiseOptions`), the `Synth` interface, and the `LayerSpec` / `LayerTarget` / `Layer` a continuous sound is made of. DOM-free, so the bank, the router, the beds and the tests describe sounds without ever making one. |
| `pwa/src/lib/synth.ts`                   | The instrument and the only module that touches WebAudio: `tone()` and `noise()` for one-shots, `layer()` for the beds, an echo bus, the master limiter, and the context's lifecycle (the unlock on a gesture, iOS interruptions, a context that died and is rebuilt).                            |
| `pwa/src/game/audio/bus.ts`              | ONE synth for the whole app, and the volume-scaled view the SOUND switch turns on and off. One context, because a browser gives a page one usable context's worth of goodwill and the limiter only works if everything goes through it.                                                           |
| `pwa/src/game/audio/bank.ts`             | `RUN_BANK`: every discrete sound as data — a description and a list of voices.                                                                                                                                                                                                                    |
| `pwa/src/game/audio/route.ts`            | Which sound an event makes, and how big: a pure function from a `GameEvent` to a bank id and a `PlayShape` (gain, pitch, stretch, pan).                                                                                                                                                           |
| `pwa/src/game/audio/engine-voice.ts`     | The engine and the drive as seven steered layers, and `engineTargets` — where each should be, as a pure function of the state.                                                                                                                                                                    |
| `pwa/src/game/audio/snow-voice.ts`       | The sled on the snow and the air as five steered layers, and `snowTargets`.                                                                                                                                                                                                                       |
| `pwa/src/game/audio/listener.ts`         | Where the ear is: one row per camera rung, a multiplier on each part of the mix.                                                                                                                                                                                                                  |
| `pwa/src/game/audio/ride-bed.ts`         | The scheduler: reads the live state once a frame and steers every layer toward its target.                                                                                                                                                                                                        |
| `pwa/src/game/audio/bird-voice.ts`       | What the birds say: which cry each species makes (`BIRD_CALLS`), how often in the air and at rest, how far off it is heard, and `criesIn` — the draw off a flock's own scatter that decides whether it cried in a quarter second. DOM-free and plan-free.                                         |
| `pwa/src/game/audio/bird-bank.ts`        | The cries themselves (`BIRD_BANK`, spread into `RUN_BANK`): the raven's croak, the ptarmigan's rattle and the grouse's whirr, the capercaillie's knock, the crossbills' chip, the swan's whoop and the goose's honk.                                                                              |
| `pwa/src/game/audio/bird-bed.ts`         | The birds' scheduler: once a frame, every cry the wood owes since the last one, off the same plan the renderer draws (`birdPlanFor`), panned to where the flock is — and the one sound a sled CAUSES, the whirr of a covey it flushed (`flushAt`, the rule the renderer keeps too).               |
| `pwa/src/game/audio/rack.ts`             | The plumbing every bed shares: build a layer, rebuild one whose context died, steer it on its glide.                                                                                                                                                                                              |
| `pwa/src/game/audio/play.ts`, `types.ts` | Firing one def through a shape; what a def and a shape are.                                                                                                                                                                                                                                       |
| `pwa/src/game/audio/index.ts`            | The front door (`createRunAudio`): the step's events in, the beds fed each frame, `silence()`. `App.tsx` is its one caller.                                                                                                                                                                       |

## The one-shots (`bank.ts`, `route.ts`)

| Event         | Sound                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `land`        | `land_soft`, or `land_hard` when the suspension could not take it all (`harsh`), scaled by the impact |
| `hit`         | `hit_tree` — the one crack in the bank, scaled by the closing speed                                   |
| `bump`        | `bump` — two machines shouldering                                                                     |
| `checkpoint`  | `checkpoint` — a chime (not on the start line's lap-closing crossing, which is the lap's)             |
| `lap`         | `lap`                                                                                                 |
| `missed`      | `missed`                                                                                              |
| `reset`       | `reset`                                                                                               |
| `count`, `go` | The lights, and GO                                                                                    |
| `finish`      | The flag                                                                                              |

`air` makes no sound on purpose: the lip is where the sled stops touching anything, and the engine note climbing and the snow going quiet say so. A new sound needs a rung in `route.ts` (or a cue the bed raises) or it can never play, and **no `GameEvent` is ever added for a sound's sake** — what the app can work out from the state, it works out.

## The beds

A continuous sound is never written out of one-shots. It is a LAYER: an oscillator or a looping window onto a pool of noise, a filter, a saturation curve and a gain, built once and then steered every frame toward a target (level, pitch, cutoff, grit, pan) over a glide, on the audio thread. Nothing is booked ahead, so a late frame leaves every layer holding its last value rather than leaving a hole — and so every frame that is not hearing the race (the pause card, a hidden tab, a held screenshot) says `silence()`, or the engine would play on behind the card.

**The engine** (`engine-voice.ts`), seven layers: the MOTOR (the block, through the chassis), the HUM (the firing note — a twin two-stroke fires twice a revolution, so `rpm / 60 × 2`: a 50 Hz chug at idle, 280 Hz at the limiter), the OCTAVE above it (carrying the note at idle where a phone cannot reproduce 50 Hz), the RASP (the expansion chamber — the two-stroke's own voice, hardest on the pipe), the BASS under it, the INTAKE (the airbox, opening with the throttle), and the BELT (the drive's whine, whose pitch is the TRACK's speed over the lug pitch, 6.5 cm, not the crank's). A CVT is why it sounds like a sled and not a car: the clutch holds the engine near its power peak while the belt walks up the sheaves, so under full throttle the note barely moves from rest to ninety, and all the acceleration is in the belt climbing under it. Off a kicker the tread unloads, the crank runs free and the belt screams with nothing to push — the physics does that; the bed only hears it.

**The snow and the air** (`snow-voice.ts`), five layers: the HISS (the skis and the track on packed snow, climbing with the speed), the POWDER (a dark rush with body in it, loudest slow where the sled is sunk and shoving snow aside, thinning as it planes), the CARVE (the ski edges biting a turn on the hardpack), the TREAD (the track's clatter, following the belt's speed) and the WIND (the rider's own, louder off the snow where nothing else is heard). Packed or powder is one number — `SledState.packed`, the share of the load on groomed snow — and the hiss and the rush crossfade on it, so riding off the loop is heard as the hiss giving way before anything else changes.

**The wood** (`bird-bed.ts`) is not a layer but a scheduler of one-shots: a cry is a CUE off the birds' plan, never a `GameEvent` — the engine has no idea a raven exists. Each frame it walks the flocks within earshot, asks how much of each is in the air (a flock calls more on the wing than at rest, and hardly at all after dark — `activityAt`, the sun the sky is lit by), and draws each quarter second since the last frame off the flock's own scatter (`criesIn`), so a seed cries the same cries on every ride and a replay cries them again. Distance is the plan's distance with the height in it, faded to nothing over the last third of a call's reach; a skein is heard from its leader. The eagle keeps quiet on purpose — its silence over the ridge is the character of it.

## Where the ear is (`listener.ts`)

One row per camera rung. On the HOOD the engine is under you and the snow an arm's length away, the pipe behind; at the BARS you are the rider; behind and above (CHASE, the seat the mix is tuned at) it is all in proportion; stood back (FAR) and craned up (HIGH) the sled is a small thing on a big hill, the wind gone; the menu's ORBIT is a thread under a card. A camera-dependent sound is a column in this table, never a branch in a bed.

## The mix

- The landings and the trunk are the loudest things in the bank; the course's chimes sit under the snow — heard over a race, never instead of one. `tests/audio_test.ts` holds a ceiling on every voice.
- **The faders** (OPTIONS ▸ SOUND): MASTER, ENGINE and EFFECTS, under the SOUND switch. `bus.ts` keeps two volume-scaled views of the one synth — the engine's layers play through one (`engineSfx`), the snow, the wind and every one-shot through the other (`sfx`) — and `mixOf` in `settings.ts` folds the master and the switch into both. A layer reads its view every frame, so a fader moved over the front door is heard at once.
- Under a card the whole bed is ducked (`CARD_DUCK` in `App.tsx`), and the race's events make no sound at all unless the player is riding (`soundsLive` in `shell.ts`) — a checkpoint the bot takes behind the front door is not news.
- Nothing plays before the player has touched something: `unlockAudio()` hangs off document-wide `pointerdown` and `keydown`, because a context built outside a real gesture is one iOS Safari never resumes.

## Hearing it

```sh
make audition                                                         # previews/audition.html: every sound on a button, the beds under sliders
CHROMIUM_PATH=/opt/pw-browsers/chromium make audition ARGS=--meter     # headless: a level (dBFS) for every bed preset and every sound
make audition ARGS="--meter --seat hood"                               # ...heard from another camera
```

The page is built by `scripts/audition.mjs`, which inlines the audio modules into one page and plays them on the repo's own synth — so what is auditioned is what ships. A session that cannot listen reads the meter as a SHAPE: idle under cruise under flat out, the air under flat out with the snow gone, the landings at the top of the bank, the chimes at the bottom, nothing within a few dB of the limiter. `tests/audio_test.ts` guards the faults that are silences rather than crashes: an event nothing answers, a mix that creeps, a bed whose numbers never move, a bed that holds under the pause card, a cutoff past a Bluetooth headset's Nyquist.

Music is not built.
