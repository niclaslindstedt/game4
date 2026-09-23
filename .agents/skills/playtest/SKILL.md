---
name: playtest
description: "Use to verify gameplay changes in the running game and to evaluate game feel and look. Two photographers: `make world` (one seed ridden by the bot, drawn through the game's own renderer at named views — spawn, powder, lookback, furrow, track, hood, bars, far, jump, landing, vista, forest, orbit — no build needed) and `make screenshots` (the BUILT app at moments of a race — grid, go, race, lap — and its cards, at the three reference viewports). Closes the loop the sim numbers can't: does it LOOK and READ right on the snow."
---

# Playtesting

Engine tests prove rules, the labs prove the models and `make sim` proves
balance; playtesting proves the game **works and reads right in the real
renderer**. Every gameplay, rendering or input change ends with a look at the
actual pixels before it ships. Numbers say whether the game is _sound_;
pictures say whether it _looks and reads_ right.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs playtest --list`. Load **`skill-reflection`**
at both ends of the session.

## Tooling

| Piece | Role |
| --- | --- |
| `scripts/world-preview.mjs` (`make world`) | THE WORLD LAB: builds its own bundle from `pwa/world-preview.html` (never deployed), stands one seed up, lets the bot ride it — the player's sled and the field — and draws named views through the game's own renderer to `previews/world-<view>.png`. ONE continuous run, so the trails in the pictures are the trails that run cut. `ARGS=--views=a,b` a subset, `--frames=n` times drawn frames, `--quality=low`, `--skip-build` |
| `scripts/screenshot.mjs` (`make screenshots`) | THE BUILT APP: serves `pwa/dist`, opens `?start=race&seed=&t=&shot=1` (a race with `t` seconds already ridden by the bot, held still once drawn), waits for `window.__SH_READY__`, captures at 1280×720, 390×844 and 844×390 (the phones at 2× with a touchscreen). `SCENE=grid/go/race/lap/all`, `CAMERA=hood/bars/chase/far/high`, `SEED=`, `ARGS="--t 20"`, `ARGS="--surface all"` for the cards, `ARGS=--update` |
| `make ride SCENARIO=<name>` | The moment on the BENCH — the sled over the snow it crossed, with the numbers. No build, no browser, seconds. If the table does not show the moment, no picture will |
| `make level SEED=<n>` | The map from above — when the question is the course, not the rendering |
| `npm run dev` | The headed loop — ride your working copy for anything a still can't judge (the lever, the lean, the carve, the sound) |

### Environment

`playwright-core` is installed with `npm i --no-save playwright-core`; only the
browser binary is separate. In Claude web sessions Chromium is preinstalled:

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium make world SEED=38
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=race
```

Never run `playwright install`; point `CHROMIUM_PATH` at an existing binary.
`make screenshots` needs `make build` first, every time — a stale dist
photographs the last change. `make world` builds its own bundle.

### The views and the moments

| `make world` view | What it photographs |
| --- | --- |
| `spawn` | The grid in the powder on the lights |
| `powder`, `powder-high` | The run through the powder onto the track — the roost, the sink — close and from the high boom |
| `lookback`, `furrow` | Back down the furrows the player has cut; close on them |
| `track` | On the groomed track at pace — the corduroy, the flags |
| `hood`, `bars`, `far` | The bolted and far rungs of the camera ladder |
| `jump`, `landing` | Off a kicker — the hang; the puff coming down |
| `vista`, `forest` | The country from above; in the woods |
| `orbit` | Round the sled — the menu's camera |

| `make screenshots` scene | Seconds in |
| --- | --- |
| `grid` | 0.5 — on the lights |
| `go` | 3.4 — GO just gone |
| `race` | 12 — racing, the field strung out |
| `lap` | 40 — well into lap one |

**A scene is a moment of a real race ridden by the bot**, so what is in the
frame is whatever that seed's race did at that second. When a moment matters
more than a seed (a landing, a tree), use the view that seeks it (`jump`,
`landing`) or bench it with `make ride` first.

**A new player-visible feature earns a way to be photographed in the same
change** — a view in `world-harness.tsx` (and `VIEWS` in
`world-preview.mjs`), or a `SCENES` / `SURFACES` entry in `screenshot.mjs`. A
surface no lab reaches is a surface no future sweep will ever look at.

## Running

**Look at the PNGs with the Read tool** — every judgement is made on a
picture, not on source. Watch the harness's `[pageerror]` lines too: a clean
picture over a page error is a lie.

### MEASURE the moment before chasing it

A picture that waits for a moment the run never produces shows a sled
cruising and says nothing about why. Before re-shooting — certainly before
re-shooting twice — ask the bench: `make ride SCENARIO=kicker` says whether
the sled left the snow and when it came down; `make level SEED=<n>` says
whether that seed's loop has a kicker at all and where. The question is not
"is the shutter too early" but "does this moment exist at this seed".

### Two traps

- **A canvas is not proof of a running game.** The canvas paints from frame
  one; a static frame with plausible HUD chrome can still mean the loop died.
  Check the HUD's live numbers (the clock differing between two `t` values)
  and the `[pageerror]` log before trusting a frame.
- **Same seed, same `t`, same race.** A race is deterministic, so two shots at
  the same seed and `t` are the same moment — which is what makes a
  before/after honest. Two at different `t` are different moments, and "the
  spray got bigger" between them is the clock, not the change. (The trails
  are the one thing that differs if the renderer's stamping changed.)

## Evaluating

Judge each picture against the game's own bar (`game-feel` owns the
reference):

- **The snow reads as snow.** Bright, blue in shade, glitter toward the sun,
  the groomed track greyer and combed — and the sled standing IN it, its
  furrow under it, never floating a hand above the snow or sunk through it.
  That gap is the one visible way the engine and the renderer can disagree.
- **The trails read.** A wide band with a thin line either side behind every
  sled, persisting.
- **The sled's attitude reads.** Rolled into a turn, nose up off a lip,
  suspension compressed on a landing, the rider standing in the air.
- **Speed reads.** The roost, the trees and flags streaming past, the
  speedo climbing — `race` should look fast at every viewport.
- **The HUD is legible over the world** — over bright snow and over the dark
  forest both.
- **Portrait is a real game, not a cropped landscape.** The lever and the
  handlebar reachable, the next checkpoint's flags visible far enough ahead
  to aim.
- **Nothing regressed in the scenery** — the rim on the horizon, the woods
  where the plan put them, no seams in the clipmap, no trees on the track.

For feel questions (the lever's response, the lean's authority, the carve),
run headed: `npm run dev` and ride. A picture cannot judge an input curve.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. A settled
visual rule of thumb ("the trail must show in every powder shot", "the HUD
fails over sunlit snow at noon") is worth recording — read the past ones
before you evaluate, not after.
