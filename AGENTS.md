# Agent guidance for Powder Run (game4)

This file is the canonical source of truth for AI coding agents working in this repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks to it (`tests/symlinks_test.ts` holds them).

**This file is the ROUTER, not the manual.** It says how work is done here, where things live at one level of detail, and which skill owns the rest. The procedures — every loop, every lab, every craft rule — live in `.agents/skills/`. Load the skill that owns the task's SUBJECT before starting; do not re-derive from this file what a skill already states.

This repository conforms to [`OSS_GAME_SPEC.md`](OSS_GAME_SPEC.md) — the committed copy IS the spec, self-contained, with no upstream document to fetch and no validator to call; it is a verbatim copy of the one the sibling games carry, one spec for all of them, and amending it is a reviewed PR that propagates the new mandate into the tree. When in doubt about layout, naming, or workflow conventions, the spec is the tie-breaker. Where the repo knowingly falls short of it, [`docs/spec-conformance.md`](docs/spec-conformance.md) is the ledger — one row per chapter, with the verdict, the evidence and what closing the gap would take; the `sync-game-spec` skill walks it.

**This repository is a VERTICAL SLICE.** The engine — the world generator, the sled on the snow, the course, the race, the bot — is built and green, and so is the first playable cut of the app around it: ONE generated map per seed (no biomes — one nature: a basin of snowy hills ringed by mountain flanks, forests of snow-loaded conifers, open powder meadows, kickers on the hilltops), a closed-loop packed-snow race track graded into it with crests on it that are jumps and drifts of fresh snow across it, the grid standing on it behind the start line; FOUR sleds in the engine's catalog — trail, crossover, mountain and cross, each an answer to a kind of snow, the player's picked on a SLED CARD (the machine turning on its stand, drawn off its own spec, with a spec sheet beside it) and the rivals dealt one each — with their rider; RACE — the player and three bot rivals, three laps, checkpoints in order — and a FREE RIDE: the whole map and nobody on it, no lights, no laps, the checkpoints counting nothing, on a day and a depth of snow of the rider's own; a clear winter sky whose sun moves an hour every ten minutes of riding from the seed's hour, on the seed's day, at its latitude; a snow shader (the glitter, the blue in the shadows, the groomed track's corduroy) and snow that DEFORMS — every sled's skis and tread stamped into a world-space trail map, so the furrows persist; the spray; a ladder of five cameras; the synthesized sound (the engine and the belt, the hiss and the powder, the wind, every landing); a HUD (speed, revs, position, lap and checkpoint count, the race clock, the split, the air clock, the missed-checkpoint arrow, the news column, the finish plate, and a heading-up MINIMAP of the loop, the field and the checkpoint owed), keyboard and touch; and the shell — an attract card, a front door with a RACE tile that opens the sled card and a FREE RIDE tile that opens a START CARD first (the map's seed with a chart of it — the loop, the grid and every kicker — tapped to start anywhere, the date, the hour, the snow's depth), OPTIONS (the picture as eight ladders applied live over the race, with a first-visit probe that picks the rung this machine can hold; three sound faders; the keys rebound; the thumbs' side, travel and lean; how much the sled helps), a loading card, a pause card. Around THAT, both platform shells are built: `tauri/`, the desktop app, and `native/`, the store app. **NOT BUILT, and with no placeholder file to build into:** a developer page, a campaign, other modes, weather, cloud, night, replays and ghosts, screenshots and a gallery, damage, tricks, music. Do not describe any of them as a feature, and start any of them with `engine-system` — and the sibling repos' answer (below).

## Build and test commands

```sh
npm install       # everything resolves from the public npm registry
make build        # typecheck (both programs) + production build (pwa/dist/)
make test         # vitest over the engine and the DOM-free app modules (SHARD=i/N slices it; CI runs two)
make lint         # eslint + typecheck, zero warnings
make fmt          # prettier in place; fmt-check is what CI runs
make hooks        # install pre-commit + commit-msg hooks
make icons        # regenerate icons/favicon from the app mark
make tauri-test   # the desktop shell's decision layer (Rust; needs no GUI libraries)
make native-typecheck  # the store shell's own tsc (its tree is installed on its own)
```

That is the everyday set. **NEITHER PLATFORM SHELL IS ON THE ROOT SUITE'S PATH** — `make test` and `make lint` stop at `tauri/`'s and `native/`'s edges, and each tree is checked by its own peers: `make tauri-test` / `tauri-lint` / `tauri-fmt` (`.github/workflows/desktop-tauri.yml` runs them on every push that touches the tree) and `make native-typecheck` (`native.yml` runs it before an EAS build, and eslint ignores `native/**`). What the root suite does hold is what each shell RESTATES and cannot import: `tests/tauri_test.ts` reads the Rust as text, and `tests/shell_test.ts` / `tests/rumble_test.ts` read the store shell's three import-free modules directly. **The full list is the README's Usage table, and the `Makefile` is the authority.** The table below says which of them a given change OWES.

**Scope the linter, never the typechecker, and leave the suite to CI.** `npx eslint <changed files>` is seconds where the whole repo is tens; a typecheck must stay whole-program, because it checks a PROGRAM (naming files makes it ignore `tsconfig.json`) and because a changed signature breaks its CALLERS. **And "whole" is TWO programs: `npx tsc --noEmit` at the root does not read `pwa/src` at all** — `npm run typecheck:only` runs both and is what `make build` gates on.

**`make fmt` is the Make target to run; `make test` is CI's.** The suite builds whole maps and races sleds round them at 120 Hz, and CI fans it out on every push — so locally, run the FILES that cover the change (`npx vitest run tests/<topic>_test.ts`) and let the PR find the rest. The Make target is still the definition of green.

## The labs: what to run before and after which change

This project is tuned by measuring and LOOKING, not guessing. Each lab below is REQUIRED before and after a change in its subject — run it, keep both outputs, and put them in the PR. The owning skill says how to read what comes back.

| Change you are making | Run | Owner |
| --- | --- | --- |
| The springs, the sink, the grip, the drive, the steering, the carve, the air, a landing | `ride`, `sim` | `sled-physics` |
| The machine's own numbers (`defs/sled.ts`), the field's pace | `ride`, `sim` | `sled-tuning` |
| The sled's look | `world`, `screenshots`, `profile` | `sled-design` |
| The rider: his look, his pose | `world`, `screenshots` | `rider` |
| A tree, a rival, the edge, a checkpoint, a lap, the reset | `ride SCENARIO=tree`, `sim` | `collision` |
| The world generator, its rules, the analyzer | `analyze`, `level`, `sim` | `mapgen-improvement` |
| The woods, the country as it reads | `level`, `world`, `profile` | `nature` |
| The sky, the sun, the haze, the shadows | `world` (an early and a late hour), `screenshots` | `atmosphere` |
| The snow as DRAWN: the shader, the groomed track, the trail map | `world`, `screenshots`, `profile` | `snow-look` |
| The spray, the trails' stamping, a pulse in the hands | `world`, `screenshots`, `profile` | `visual-effects` |
| The bot rider, the rivals | `sim` (and `sim ARGS="--rivals 3"`) | `bot-improvement` |
| The HUD, the controls | `screenshots` | `hud-and-menus`, `ui-review` |
| A card, a setting, the shell's flow | `screenshots ARGS="--surface all"` | `menu-system`, `ui-review` |
| A PICTURE row: what a rung of OPTIONS ▸ PICTURE costs (`settings-video.ts`) | `profile ARGS="--video all"`, `screenshots ARGS="--video low"` | `menu-system`, `write-code` |
| A sound: a bed, a one-shot, the listener, the mix | `audition`, `audition ARGS=--meter` | `sound-effects` |
| The camera, anything about the FEEL | `ride`, `world`, `screenshots` | `game-feel` |
| Anything a FRAME costs — a pass, a material, a mesh | `profile` | `write-code` |
| The desktop app, the store app, the seam with the page | `tauri-test`, `native-typecheck`, the three seam tests | `platform-shells` |
| A lab or a script under `scripts/` | the tool's own `--help`, then the lab it registers | `lab-tooling` |
| Does it LOOK and READ right at speed | `world`, `screenshots` | `playtest` |

`sim`, `ride`, `level` and `analyze` are pure Node — no build, no browser, seconds. `audition` writes a page in pure Node; its `--meter` drives that page in Chromium. `screenshots` and `profile` drive the BUILT SITE, so **`make build` first, every time**: a stale dist photographs the last change rather than this one. `world` builds its own one-off bundle from a harness page (`pwa/world-preview.html`) and needs no `make build`. The browser-driven ones need `npm i --no-save playwright-core`; in Claude web sessions Chromium is preinstalled — prefix them with `CHROMIUM_PATH=/opt/pw-browsers/chromium`.

Four of these are worth knowing about even when they are not your subject:

- **`make level SEED=38`** reasons about ONE map without riding it — the country shaded by height, the forest, the track, every checkpoint numbered, every kicker labelled (`K1…` on the track, `X1…` off it), the spawn and the grid, and a table of the checkpoints — in a couple of seconds. A claim about "the third checkpoint on seed 38" is a claim about a row there.
- **`make analyze SEED=7`** scores a map against the rule book and names every finding by its R-rule; `COUNT=24` sweeps. The generator REJECTS on the same verdict, so a check is a rule with teeth.
- **`make sim`** is CI's `simulate` job and exits non-zero when the bot finishes NO seed. Its digests are where a determinism regression shows first; `docs/simulation.md` says what every column means.
- **`make world SEED=38`** rides one seed with the bot through the game's own renderer and photographs named views (`spawn`, `powder`, `lookback`, `furrow`, `track`, `hood`, `bars`, `far`, `jump`, `landing`, `vista`, `forest`, `orbit`) — ONE continuous run, so the trails in the pictures are the trails that run cut. It exists because a screenshot of the app is one frame of one camera, and the furrows, the float and the landing are moments a still has to be steered to.

## How work is done here

Rules that apply to every task, before any subject skill has a say. They are restated here from the skills that own them because a session that gets them wrong gets them wrong from its first tool call:

- **LOOK AT THE SIBLING REPOS BEFORE BUILDING ANYTHING.** This game was built by porting the non-water parts of [`niclaslindstedt/game3`](https://github.com/niclaslindstedt/game3) (the jet-ski racer — the same layering, the same app shell, HUD, audio, shells and skills) and it shares [`OSS_GAME_SPEC.md`](OSS_GAME_SPEC.md) with it and with [`niclaslindstedt/game2`](https://github.com/niclaslindstedt/game2) (the rally game — the land-vehicle reference: terrain, trees, a car on the ground, tracks in snow, a crash lab, debug tools). Both are **further along in nearly everything not snow**: a campaign, weather and night, replays, screenshots, a debug overlay, deeper `scripts/` shelves. **Read their answer first and adapt it; do not reinvent one.** They are public: `git clone --depth 1 https://github.com/niclaslindstedt/game3` (or `game2`), read-only; nothing in this tree may import from either — what comes across is the DESIGN, retyped in our vocabulary: a craft or a car is a sled, a shore or a stage is a map, a gate is a checkpoint, water or tarmac is snow.
  - **What is ours alone:** the snow (the sink, the plough, the float — `sled-physics`), the sled's answer to it, the map and its kickers (`mapgen-improvement`), the snow as drawn and the trails it keeps (`snow-look`). A planing hull or a tyre's grip model ported into any of those is how this game stops being about snow — take the IDEA (the sink is the planing-hull analogy on purpose) and state it for snow.
  - **What comes across nearly unchanged:** tooling and labs, the menu and shell furniture, the maintenance and release plumbing, store and platform work, and the procedure half of any skill. Adapting a sibling skill is a real port — its subject must exist HERE first, and it lands with its name and routing added to this file, `.agents/skills/README.md` and the `maintenance` registry, which `tests/skills_test.ts` holds.
- **Lint, typecheck and format ONCE, at the gate — not after every edit.** `make fmt` and `make lint` are the commit's gate (the `commit` skill owns the split). Mid-loop, if a specific answer is genuinely needed, check only the files you touched (`npx eslint <paths>`, `npx tsc --noEmit`) — never a whole-repo pass, and never `prettier`, whose every finding `make fmt` fixes at the end for free.
- **TEST WHAT YOU WROTE; THE PR TESTS THE REST.** Run the suites that cover the change and the ones it plausibly reaches, by file, and push — a red PR is a normal state and a follow-up commit costs nothing. Be honest about reach: a change to `TUNING`, `sled.ts`, `snow.ts` or the generator reaches tests three directories away (a sink retune moves `sled_test`, `flight_test`, `simulation_test` and `determinism_test`'s digests at once; a rules change moves `mapgen_test`, `analysis_test`, `docs_rules_test` and the sim), so name the topics generously for those; and a red PR is work NOW, not something to leave sitting.
- **THIS REPOSITORY IS PUBLIC — no personal details go in it.** Team ids, account names, tokens, keys, device ids, e-mail addresses, absolute paths under a home directory: none of them are committed, not even the ones that are identifiers rather than secrets, and not as a "default" a contributor can override. Everything of that kind is read from the ENVIRONMENT — a gitignored `.env` beside the tree that needs it (with the committed `.env.example` documenting the shape), and GitHub repository **secrets** for credentials or **variables** for identifiers on CI. The published app's own identifiers (`APP_NAME`, `SITE_URL`, `REPO_URL`) are the deliberate exception — they live in `pwa/src/identity.ts`.
- **NAME NO REAL PRODUCT — not a game, not a machine.** Nothing in this tree names another game, a games console, a snowmobile manufacturer or one of its models, or any other real brand: not in prose, not in a doc, not in a comment, not in a skill or a lesson, and least of all in anything the player reads. **The feel reference is the arcade winter racers of the late 90s** — named as a GENRE, never as a title. Where a real machine's numbers are the honest source for a proportion or a tuning value, keep the NUMBER and the band it sits in and drop the badge ("a 600-class trail sled is 210–240 kg dry", never a make and model). The generic words — snowmobile, sled, snow machine — are descriptions and stay; so do the sibling repos `game2` and `game3`, which are ours. A cited scientific model is not a brand either (Coulomb, Bekker, Kasten–Young are named on purpose).
- **Every work session ends by committing its work with the `commit` skill.** Once the requested change and its gates are complete, load and follow that skill; when working in a worktree, follow its required sync step afterward.

## Commit and PR conventions

- Conventional commits (`feat(engine): …`, `fix(pwa): …`, `docs: …`); enforced by the `commit-msg` hook. Squash-merge: the PR title becomes the commit subject on `main`, so it must be a conventional subject too.
- Every user-visible change ships a changeset fragment in `.changes/unreleased/` (`<unix-ts>-<slug>.md` with `type:` front matter, `Added | Changed | Fixed | Removed | Security | Deprecated`), or the PR carries the `no-changelog` label. **Never edit CHANGELOG.md** — the release workflow writes it, and `tests/changeset_test.ts` holds both the fragments and the file's shape.
- Sled, snow, bot or generator PRs carry the `make sim` table before AND after, with the owning lab's output beside it.
- Full workflow details: [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture summary

Three layers, one direction of dependency (details: [docs/architecture.md](docs/architecture.md); enforced by `tests/imports_test.ts`):

- **`engine/`** — the whole game as a framework-free, renderer-free TypeScript module that imports NOTHING but itself. Fixed 120 Hz `step(state, input)` (`TUNING.physicsHz`; the bot decides on every step too), deterministic per seed (no `Math.random` at runtime — everything draws from the seeded RNG in state, `state.rng`). Contains the world generator (`mapgen/`), the sled on the snow (`game/sled.ts` summing `suspension.ts`, `snow.ts`, `traction.ts`, `flight.ts`, `chassis.ts`), the trees and the edge (`game/collision.ts`), the course (`game/course.ts`), the race and the field (`game/step.ts`, `run.ts`, `rivals.ts`), the bot rider + headless simulator (`sim/`), the generator's scoreboard (`analysis/` — dev-time AND the generator's accept gate), the §19.4 output module (`output.ts`), and the data (`game/defs/`). `engine/index.ts` is the one public surface; `@engine` is how every host spells it.
- **`pwa/`** — the browser shell: Preact app, three.js renderer (reads `GameState`, never steps physics — the terrain is the engine's own heightfield, and the trail map is stamped from the engine's own contacts), input, HUD, the audio (`game/audio/` — every sound synthesized over one WebAudio instrument in `lib/synth.ts`; nothing is a file), PWA plumbing (hand-rolled service worker via `pwa-plugin.ts` + the update watch in `lib/pwa-update.ts`).
- **`tests/` + `scripts/`** — root-level vitest suites over the engine and the DOM-free app modules, and Node tooling (the sim CLI, the level map, the analyzer, the ride lab, the world lab, the audition page, screenshots, the profiler, icons, release plumbing; every tool parses its flags through `scripts/lib/cli.mjs`, which gives it `--help` and a non-zero exit on an unknown flag).

Beside them, OUTSIDE the npm workspace and outside the root suite's path, the two shells that wrap the built site, both BUILT: **`tauri/`** (the desktop app) is two Rust crates, `shell/` for every decision and `src-tauri/` for every effect, with its own `make tauri*` targets, its own workflow and a packaging matrix in `release.yml`; **`native/`** (the App Store / Play Store app) is an Expo/React Native WebView over a copy of the site packed inside it, with its own `make native-*` targets and a dispatch-only EAS workflow. **Nothing in `engine/` may learn either exists, and the ONE file of `pwa/` that does is `pwa/src/shell-host.ts`** (the frozen `__SH_SHELL__` global and the `sh-` events around it). A feature a shell needs is a feature the website needs first, and a menu row may only press a button the game already has.

The root suite may import from a shell in exactly one place: the pure, import-free seam modules named in `tests/imports_test.ts`'s `SHELL_SEAM` (`native/src/injected.ts`, `navigation.ts`, `rumble.ts`). A seam module that grows an import fails that test. The desktop shell's Rust is held the other way, as TEXT (`tests/tauri_test.ts`).

**Hard rules:** the engine never imports three.js, Preact, `node:` or anything from `pwa/` or `scripts/`; the renderer never mutates `GameState`; engine randomness only via `state.rng` (`tests/determinism_test.ts` + `tests/imports_test.ts` enforce it); source files stay under 1000 lines (`tests/file_size_test.ts`, §20.5's marker for the honest exceptions); the engine prints only through `engine/output.ts`. **The game ships no asset files** — every hill, every tree, every sled and every sound is code.

### The role map, and what is generated

The spec (§23) names roles, not directories: `engine/` is the **simulation core** (§23.1) with `engine/index.ts` as its one public entry surface; `pwa/` is the **presentation shell** (§23.2); `tauri/` and `native/` are **platform shells** (§23.3); `scripts/` is **tooling** (§23.6) and may import anything while nothing imports it. There is no session service — the game is single-player (§34 does not apply). The core imports nothing from a shell or a script; a shell imports the core, never another shell; the suite reaches the core through `@engine` like a host does.

**Content (§23.5) is the deliberate deviation**: the maps are GENERATED from a seed rather than authored, and the small fixed catalogs (`engine/game/defs/sled.ts`, `tuning.ts`, `modes.ts`; `mapgen/rules.ts`) are TypeScript consts rather than schema-validated data files. `docs/spec-conformance.md` carries the reasoning — do not start converting a catalog to data on the strength of §24 alone.

What IS generated is generated, and **a generated artifact is never hand-edited**:

| Artifact | Regenerated by | Guard |
| --- | --- | --- |
| `pwa/dist/` (the site, the service worker, its manifest) | `make build` | CI's `build` job |
| Icons, favicon | `make icons` | `tests/app_mark_test.ts` holds the SVG to `app-mark.ts`; `tests/identity_test.ts` the palette |
| Every lab picture under `previews/` | its lab target (labs table) | gitignored |
| `CHANGELOG.md` | the release workflow | `tests/changeset_test.ts`, the pre-commit hook |
| `engine/version.ts` + the `package.json` versions | `scripts/update-versions.sh` | the release workflow |

## Where new code goes

By area first. Each row's skill owns the file-by-file map inside that area — go there rather than guessing from a directory name.

| Area | Lives in | Skill |
| --- | --- | --- |
| The springs and the probes: the raycast suspension, the rest loads off the geometry, the chassis points | `engine/game/suspension.ts`, `defs/sled.ts`'s `front` / `rear` | `sled-physics` |
| THE SNOW UNDER A PROBE: the sink and how speed floats a sled out of it, the rolling resistance, the plough, the powder drag, the grip | `engine/game/snow.ts`, `TUNING.snow` / `.grip` | `sled-physics` |
| The drive: the engine's power curve, the CVT, the belt as a mass, the brake | `engine/game/traction.ts`, `TUNING.tread` | `sled-physics` |
| The body: every force summed, the steering, the rider's weight, the roll into a turn, the CARVE in powder, the arcade's hand on the yaw | `engine/game/sled.ts`, `TUNING.steer` / `.rider` | `sled-physics` |
| The air: the lean, the throttle's gyro, the brake's nose-down, what a landing costs | `engine/game/flight.ts`, `TUNING.air` | `sled-physics` |
| The chassis meeting the snow when the springs run out, as impulses | `engine/game/chassis.ts`, `TUNING.hull` | `sled-physics` |
| What a sled CAN do (the ceilings the physics and the bot share) | `engine/game/limits.ts` | `sled-physics`, `bot-improvement` |
| The machine's own numbers, and its documented expectations | `engine/game/defs/sled.ts` | `sled-tuning` |
| Trees and the map's edge | `engine/game/collision.ts`, `TUNING.trees` / `.bounds` | `collision` |
| Checkpoints, laps, the flag, the arrow, the reset | `engine/game/course.ts`, `TUNING.course` / `.reset` | `collision` |
| ONE RIDER'S STEP: the reset, the sled, the trees, the air record, the clock, the course | `engine/game/run.ts` (`stepRun`) — run for the player and every rival alike | `engine-system` |
| THE FIELD: the grid, the rivals as whole runs, sled against sled, the standings | `engine/game/rivals.ts`, `RACE` in `defs/modes.ts` | `engine-system`, `collision`, `bot-improvement` |
| What a run is PLAYING BY: the race's rules, the open rules a measurement rides, the free ride's (`course` off) | `engine/game/defs/modes.ts` (`RunRules`, `raceRules`, `openRules`, `freeRules`), `GameState.rules` | `engine-system` |
| THE SNOW DIAL: how deep the powder sinks, a run's own | `SNOW_DIAL` in `engine/game/defs/modes.ts`, `GameState.snowDepth`, read by `snow.ts` | `sled-physics`, `engine-system` |
| A FREE RIDE stood up: where it starts, on which day | `freeSpawn` in `engine/game/course.ts`, `withDay` / `freeHours` in `engine/mapgen/sun.ts`, `createGame`'s `free` / `spawn` / `day` / `snowDepth` | `engine-system` |
| HOW MUCH THE SLED HELPS: the yaw held, the roll levelled in the air | `Assist` / `FULL_ASSIST` in `engine/game/defs/modes.ts`, `GameState.assist`; the rows are `settings.ts`'s `assistOf` | `sled-physics`, `menu-system` |
| Standing a run at a moment | `engine/game/place.ts` (`placeRun`) | `test-scenario` |
| A whole new gameplay system | engine first, then `pwa/` | `engine-system` |
| The world generator: the search, the country, the loop, the kickers, the spawn, the checkpoints | `engine/mapgen/` (`generate.ts`, `terrain.ts`, `track.ts`, `kickers.ts`, `spawn.ts`, `compile.ts`, `query.ts`) | `mapgen-improvement` |
| The rule book (R1–R16) | `engine/mapgen/rules.ts`, mirrored verbatim in `docs/level-generator.md` | `mapgen-improvement` |
| How a map is scored for DEFECTS | `engine/analysis/` | `mapgen-improvement` |
| WHERE THE TREES STAND (R14) | `engine/mapgen/forest.ts` | `nature`, `mapgen-improvement` |
| The day a map is ridden on (R15) and the sun's hour at run time | `engine/mapgen/sun.ts`, `engine/game/clock.ts` | `atmosphere` |
| The bot rider | `engine/sim/bot.ts` | `bot-improvement` |
| Measuring balance | `engine/sim/simulate.ts`, `scripts/simulate-run.mjs` | `simulate-run` |
| The ground as a mesh: the clipmap round the lens | `pwa/src/game/terrain.ts` | `nature`, `snow-look` |
| The snow as DRAWN: the shader, the glitter, the groomed track | `pwa/src/game/snow-glsl.ts` | `snow-look` |
| THE TRAILS: what a contact stamps, and the maps that keep it | `pwa/src/game/trail-stamp.ts` (three-free), `trail-map.ts` | `snow-look`, `visual-effects` |
| The woods as drawn | `pwa/src/game/forest.ts` | `nature` |
| The checkpoints as drawn: the poles, the flags, the start banner | `pwa/src/game/gates.ts` | `collision` |
| The sky: the sun's place and colour, the dome, the haze, the lights, the shadow box | `pwa/src/game/sky.ts` (three-free), `haze.ts`, `sky-dome.ts`, `environment.ts` | `atmosphere` |
| The sled as drawn, and one draw per posed figure | `pwa/src/game/sled-body.ts`, `posed-merge.ts` | `sled-design` |
| The rider: the pose, the figure | `pwa/src/game/rider-pose.ts` (three-free), `rider.ts` | `rider` |
| What the sled throws: the roost, the ski spray, the landing puff | `pwa/src/game/spray.ts` | `visual-effects` |
| WHAT IS FELT, and the one motor | `pwa/src/game/rumble.ts` (DOM-free), `haptics.ts` | `visual-effects` |
| The camera: the ladder, the rigs, the hand-over, what the lens may not stand inside | `pwa/src/game/camera-rigs.ts` (three-free), `camera.ts`, `camera-clear.ts` | `game-feel` |
| Anything drawn, with no better home; drawing between two steps | `pwa/src/game/renderer.ts` (behind `renderer-api.ts`), `interp.ts` | `snow-look` |
| The HUD: the readouts, the snapshot they are drawn from, the rev bar, the presses, the finish plate | `pwa/src/game/hud.tsx`, `snapshot.ts`, `hud-dial.tsx`, `hud-actions.tsx`, `hud-press.ts`, `hud-result.tsx` | `hud-and-menus` |
| WHAT A RACE SAYS: the news line an event earns | `pwa/src/game/run-news.ts` (pure) | `hud-and-menus` |
| THE MINIMAP: the ground baked once per map, the heading-up pose, the loop, the checkpoints and the field on it | `pwa/src/game/minimap-bake.ts` (DOM-free, run in `minimap-worker.ts`), `minimap-view.ts` (DOM-free), `minimap.tsx`; the grid slots' colours are `sled-colours.ts` | `hud-and-menus` |
| The controls: which key does what, the input maths, the listeners, the thumb zones | `pwa/src/game/settings-input.ts`, `input-model.ts` (DOM-free), `input.ts`, `hud-touch.tsx`, `thumb-guard.ts` | `hud-and-menus` |
| Every word the player reads | `pwa/src/game/strings.ts` (§39.1) | `hud-and-menus`, `menu-system` |
| WHICH SURFACE IS UP, and what follows from it | `pwa/src/game/shell.ts` (DOM-free), `App.tsx` | `menu-system` |
| THE SLED CARD: the machine on its stand, the spec sheet derived off the catalog, RIDE | `pwa/src/game/menu-sled.tsx`, `sled-picker.tsx`, `sled-turntable.ts` (its own chunk), `sled-stats.ts` (DOM-free) | `menu-system`, `sled-design`, `sled-tuning` |
| The cards: attract, front door, loading, pause, and walking them on the keys | `pwa/src/game/splash-screen.tsx`, `splash.ts`, `menu-main.tsx`, `loading-screen.tsx`, `menu-pause.tsx`, `menu-nav.ts`, `menu-cursor.ts`, `menu-glyphs.tsx`, `mark-trails.tsx` | `menu-system` |
| Standing a race up behind a card | `pwa/src/game/run-loader.ts` (the sequencing), `app-load.ts` (the steps) | `menu-system` |
| THE START CARD: the free ride's map, date, hour and snow, and the chart a spot is picked on | `pwa/src/game/menu-start.tsx`, `free-ride.ts` (DOM-free: what is stored, `freeGameOptions`), `seed-preview.tsx` over `seed-preview-worker.ts`, `seed-chart.ts` (DOM-free) | `menu-system` |
| ONE OF THE GAME'S OWN BUTTONS, wherever the press came from | `pwa/src/game/run-actions.ts` | `menu-system`, `hud-and-menus` |
| The app's frame loop (the §37 accumulator) | `pwa/src/game/run-loop.ts` | `menu-system` |
| What the game REMEMBERS, and what it reads off its URL | `pwa/src/game/settings.ts`, `url-params.ts` | `menu-system` |
| OPTIONS and its KEYS page, and the rows both are built from | `pwa/src/game/menu-options.tsx`, `menu-keys.tsx`, `menu-knobs.tsx` | `menu-system`, `ui-review` |
| WHAT THE PICTURE COSTS: the eight ladders and the presets; the probe that picks a first visit's rung | `pwa/src/game/settings-video.ts`, `video-probe.ts` (both DOM-free); `renderer.setVideo` applies them | `menu-system`, `write-code` |
| A SOUND: a one-shot and its route | `pwa/src/game/audio/bank.ts`, `route.ts` | `sound-effects` |
| A BED: the engine, the belt, the snow, the wind — and where the ear is | `pwa/src/game/audio/engine-voice.ts`, `snow-voice.ts`, `ride-bed.ts`, `listener.ts` | `sound-effects` |
| The instrument | `pwa/src/lib/voice.ts` (the vocabulary), `lib/synth.ts` (the only WebAudio) | `sound-effects` |
| The desktop app | `tauri/` — `shell/` decides, `src-tauri/` acts; `make tauri*` | `platform-shells` |
| The store app | `native/` — `App.tsx`, `src/*.ts`; `make native-*` | `platform-shells` |
| A lab, a harness page, a script | `scripts/*.mjs` over `scripts/lib/`; a harness in `pwa/src/tools/` + `pwa/<name>-preview.html` | `lab-tooling` |

And the pieces that belong to no skill in particular:

| Kind of change | Where it goes |
| --- | --- |
| Run orchestration (create, the lights, the field, sled against sled) | `engine/game/step.ts` — one rider's own step is `run.ts` |
| The state shape and the events | `engine/game/state.ts` — only `sled.ts`, `collision.ts`, `course.ts` and `step.ts` write it during a run (`place.ts` stands one at a moment) |
| A number that shapes the FEEL, shared by every sled | `engine/game/defs/tuning.ts` — every number carries its unit, and the model it feeds names its source |
| Map geometry / compilation | `engine/mapgen/compile.ts` — bakes the grids ONCE; nothing downstream regenerates any of it |
| A generic grid, a quaternion, noise, the PRNG, the sun's astronomy | `engine/lib/` — the generic pool, nothing of THIS game in it (§23.7 rule 5) |
| App identity (name, palette, URLs) | `pwa/src/identity.ts` — the single source; `tests/identity_test.ts` holds every restatement to it |
| The app mark, wherever the app draws one | `pwa/src/game/app-mark.ts` (the two trails as data) |
| A Node script needing an app module | `aliasEngine` in `scripts/lib/engine-alias.mjs` before the dynamic import — never a Vite build to read a table |
| Engine and DOM-free app tests | `tests/<topic>_test.ts`; shared maps in `tests/support/` |
| A DECISION the desktop window makes | `tauri/shell/src/` + a case in `tauri/shell/tests/` |
| An EFFECT the desktop window has | `tauri/src-tauri/src/` — the only crate that knows Tauri exists |

### Stated once — never restate these

Each of these is the one place an answer is written down. Anything that needs it ASKS; a second copy is a bug the day one of them moves.

- **WHAT A MAP IS** — `generateLevel(seed, opts?)` in `engine/mapgen/generate.ts`, returning the `Level` in `engine/mapgen/types.ts`: the heightfield and its three queries (`groundAt`, `normalAt`, `packedAt` — bilinear samples of grids baked once), the closed `track` (points every 2 m with `s`, heading, width, height), the `checkpoints` (index 0 the start/finish line, the track point nearest the spawn), the `spawn` and the `grid` (the player's slot first), the `trees`, the `sun`, the `laps`, and — optional in the type so a synthetic map need not invent them — the packed field, the `kickers`, the basin and the attempt. A map is a pure function of its seed: each attempt draws everything off `subSeed(seed, attempt)` in a fixed order and is accepted only if `analyzeLevel` finds it clean. Extend the shape; never rename a field without moving every reader.
- **WHAT THE RULES ARE** — `engine/mapgen/rules.ts`: R1–R16 stated once in the header as prose and every number in `LEVEL_RULES`. The generator BUILDS to them, `engine/analysis/` HOLDS the finished map to them, the tests assert them, and `docs/level-generator.md` carries the prose verbatim.
- **WHERE ON THE LOOP A POINT IS** — `nearestTrackPoint(level, x, z)` in `engine/mapgen/query.ts` (off a lazily built spatial hash), with `trackPointAt`, `arcAhead` and `arcBetween` beside it. The spawn, the forest, the analysis, the physics, the course, the bot and the renderer all ask it; nothing walks the loop a second way.
- **WHAT THE SNOW DOES TO A PROBE** — `engine/game/snow.ts`: `sinkTarget` (the support under the untouched surface, rising with speed as the planing hull's draft does), `powderFloor`, `snowDrag`, `gripAt`. The packed share it blends by is the level's `packedAt` and nothing else — the physics' grip, the renderer's groomed look and the audio's hiss-to-rush crossfade all read that one field (the last through `SledState.packed`).
- **WHAT THE SLED LEAVES IN THE SNOW** — `SledState.contacts` (`SnowContact`: every probe's footprint on the surface, its `sink`, width, compression, load, `touching`), written by the engine every step; `drawnDepth` in `pwa/src/game/trail-stamp.ts` is the ONE place the drawn furrow is decided — the physics' sink or the powder's own furrow, whichever is deeper, never shallower — and `trail-map.ts`'s `trailAt` the one decoder the terrain reads it back with.
- **What the speedo reads** — `SledState.speed`: `|v|`, vertical included, written once at the end of `stepSled`. The HUD, the bot and the sim all read it and none restates it; "how fast forwards" is `way`.
- **What a sled CAN do** — `engine/game/limits.ts` (`maxRpm`, `topSpeedOf`, `treadCeiling`, `lockAt`, `brakeDecel`, `cornerGrip`), read by the physics AND `sim/bot.ts`. Never restate a ceiling. `SLED.topSpeed` and `accel0to100` are EXPECTATIONS the physics is held to (`tests/sled_test.ts`), not inputs.
- **Every shared number** — `TUNING` in `engine/game/defs/tuning.ts`, each with its unit, the timestep derived from `physicsHz` (`dt = 1 / physicsHz`) rather than restated; the machine's own numbers are `SLED` in `defs/sled.ts`; the race's are `RACE` in `defs/modes.ts`. The renderer never reads `TUNING`.
- **The sign conventions** — heading 0 = +z, clockwise from above; pitch NOSE-UP positive; roll RIGHT-SIDE-DOWN positive; body rates right-handed about right / up / forward, so a nose-up pitch rate is a NEGATIVE `wx`. `engine/lib/quat.ts`'s `fromEuler` / `toEuler` own the flip. The one place the SCREEN's axes become the engine's signs is `pwa/src/game/input-model.ts`.
- **The heading to the owed checkpoint** — `bearingToNext` in `engine/game/course.ts`, for the HUD's arrow and the bot alike. **Where a reset stands the sled** — `resetPose` beside it: on the track past the last checkpoint TAKEN, facing along it — on a free ride, the nearest point of the track; `standSled` is how anything puts a sled down at rest.
- **Where a rider stands in the race** — `raceProgress` / `racePlace` / `fieldOrder` in `engine/game/rivals.ts`: laps, then crossings, then distance to the next checkpoint. The HUD, the finish plate and the sim read it.
- **The sun at run time** — `sunHourAt(level, t)` / `sunAtRun(level, t)` in `engine/game/clock.ts` (ten minutes of riding is an hour of sun), over the generic `lib/solar.ts`. `pwa/src/game/sky.ts`'s `skyLookAt` turns it into the one `SkyLook` every frame; the lights, the dome, the haze and the snow's glitter all read that one look, and nothing picks its own sun.
- **The haze** — `SKY_GLSL`'s `skyColour` in `pwa/src/game/haze.ts`: the dome paints it and every world material fades into it along its own direction through `hazeMaterial`. Three's own fog is never used in the world.
- **The ONE clock** — `state.t` advances by `TUNING.dt` per step and is the only time the engine knows. Nothing in `engine/` reads a wall clock.
- **Which surface is up** — `Shell` in `pwa/src/game/shell.ts` (`splash | menu | loading | pause | run`), and the six predicates beside it. **The snow never stops behind a card — except the pause card**, the one surface `simulates` says no to.
- **The app's clock** — `pwa/src/game/run-loop.ts`: `MAX_FRAME_SECONDS` is the clamp, stated nowhere else; the time beyond it is dropped, never paid down.
- **What the player presses** — `pwa/src/game/settings-input.ts`: every action and its keys (`DEFAULT_KEYS`), whether it is held or taken on the press; `HeldAction` is `keyof KeysHeld`, never restated.
- **What the game remembers** — `pwa/src/game/settings.ts` (the camera, the sled picked, the sound switch, and every OPTIONS row: the faders, the picture, the keys, the thumbs, the assist), and `mergeSettings` is the one place a stored blob becomes settings this build offers. `mixOf` is the one place the master and the switch fold into the two faders the bus is handed.
- **What the picture costs** — `pwa/src/game/settings-video.ts`: every row's ladder and what each stop buys (the pixel share, the ground's clipmap — `terrainLook`, every stop reaching `TERRAIN_REACH` — the trail maps, the forest's bands, the draw distance and the haze that closes before it, `hazeFor`, the shadow map, the spray share). `renderer.setVideo` is the one place a row becomes a draw call, and `tests/video_test.ts` holds the ladder; a lab's `?video=<tier>` is this visit's and never stored.
- **How much the sled helps** — `GameState.assist` (`Assist` in `engine/game/defs/modes.ts`): the yaw hold and the air's roll-levelling, each 0..1, read and never written during a run, drawing nothing from the stream. Every hand is on unless `createGame` is asked otherwise, and the field always rides with every hand on. **What the URL says** — `pwa/src/game/url-params.ts`, and `scripts/screenshot.mjs` drives the built site through exactly that.
- **Every word the player reads** — `pwa/src/game/strings.ts`; no component carries a literal.
- **Where the ear is** — `LISTENERS` in `pwa/src/game/audio/listener.ts`, one row per camera rung; nothing else branches on the camera to decide how loud something is.
- **What is felt** — `pwa/src/game/rumble.ts` (which moment is worth a pulse, how big), and `haptics.ts` the one motor.
- **App identity** — `pwa/src/identity.ts` (`APP_NAME`, `SITE_URL`, `REPO_URL`, `PALETTE`, `BRAND_COLOR`).
- **Which shell the page is in** — `pwa/src/shell-host.ts`: the frozen `__SH_SHELL__` global and the `sh-` events (`SHELL_RUMBLE`, `SHELL_COMMAND` and its word list, the fullscreen pair). The ONE line of `pwa/` that knows a shell exists.

## Test conventions

- Tests live in the root `tests/` directory, one file per topic, named `<topic>_test.ts` (OSS_GAME_SPEC §20.2).
- Runner: vitest via `make test`; config in `vitest.config.ts` (alias `@engine` → `engine/index.ts`). No DOM, no browser — engine tests, plus the DOM-free app modules (`input-model.ts`, `sled-stats.ts`, `snapshot.ts`, `run-news.ts`, `minimap-bake.ts`, `minimap-view.ts`, `shell.ts`, `url-params.ts`, `settings.ts`, `settings-video.ts`, `video-probe.ts`, `camera-rigs.ts`, `rider-pose.ts`, `sky.ts`, `trail-stamp.ts`, the audio's vocabulary, bank, route and beds under a recording synth).
- **Physics tests stage the sled on the SYNTHETIC maps** in `tests/support/synthetic.ts` — `syntheticLevel()` (the stadium: a packed loop, a kicker, hills, a lone tree) and `flatLevel()` (a drag strip, all packed or all powder), nothing the generator built — and stand it at a moment with `placeRun` (`engine/game/place.ts`), then script inputs step by step. That is the §23.8 sequel test kept honest: the rule suite passes with the generator deleted. The `test-scenario` skill owns staging an exact situation.
- **A file that asserts a dozen rules over the same spread of seeds takes its maps from `tests/support/levels.ts`** (`LEVEL_SEEDS`, `levelFor`, `analysisFor`) rather than generating them per `it`. Generating a map is the most expensive thing the engine does and it is deterministic, so the second build can only return the first one's answer. What comes back is SHARED and read-only.
- **Sharding splits at FILE granularity, so the slowest single file is the floor under `make test` on CI.** Keep a file under a minute: share the corpus, and split a file whose subject is really two.
- **The governance tests are tests too**, and they run in the same suite: `imports_test` (the dependency direction, §23.7), `file_size_test` (§20.5), `symlinks_test` (§7.1, §21.2), `identity_test` (§35.6), `app_mark_test`, `changeset_test` (§8.5), `skills_test` (§21), `docs_rules_test` (the rule book's mirror), `determinism_test` (§25), `tauri_test` and `shell_test` (§23.3). A structural rule this file states and no test holds is a rule that will not survive a deadline.
- **Running them:** `make test` is the whole suite (`SHARD=i/N` runs one slice); `npx vitest run tests/<topic>_test.ts` runs one file.
- No extra test dependencies; everything runs on plain Node.

## Documentation sync points

| When this changes | Update this |
| --- | --- |
| The sled model, the snow, the drive, the air, the chassis, trees, the reset (`engine/game/*`, `TUNING`, `SLED`) | `docs/riding.md` (the model, every quoted number, the measured table), then `make ride` and `make sim` |
| Generator rules (`mapgen/rules.ts`) | `docs/level-generator.md` (the R-rules VERBATIM — `tests/docs_rules_test.ts` holds it) |
| The `Level` shape, the search, a check | `docs/level-generator.md` |
| The bot, the sim harness, the `RunReport`, the sim CLI | `docs/simulation.md` (and its table, re-run) |
| The layers, the step order, the state shape, the app's modules | `docs/architecture.md` |
| Commands / npm scripts / Make targets | README Usage table + this file's labs table |
| The URL parameters, what is stored, the deploy slots | `docs/configuration.md`; `url-params.ts` and `scripts/screenshot.mjs` move together |
| A card, a control, the shell's flow | `docs/getting-started.md` (and the README's Controls) |
| A picture row, a fader, an assist dial | `docs/configuration.md`'s stored-data section, `docs/getting-started.md`'s OPTIONS paragraph; a picture row owes `make profile ARGS="--video all"` before and after |
| A sound, a bed, a column in the listener | `docs/audio.md`, then `make audition` (and its `--meter` table in the PR) |
| A new failure mode, a new tool's trap | `docs/troubleshooting.md` |
| App identity, domain, deploy slots | `identity.ts`, README, `docs/configuration.md`, `pwa/public/*`, `pwa/index.html` |
| A shell's tree, a bridge, a build knob | `docs/platforms.md`, `tauri/README.md` or `native/README.md`, `docs/configuration.md`'s environment rows |
| A spec chapter, or a verdict under one | `docs/spec-conformance.md` — `sync-game-spec` re-dates it |
| A skill added, renamed or retired | this file's Skills section, `.agents/skills/README.md`, the `maintenance` registry for an `update-*` — `tests/skills_test.ts` holds all three |

## Parity and cross-cutting rules

Places where one idea is deliberately written in two files that cannot import each other. Each is a live trap: change one, change both.

- `pwa/src/identity.ts` is the identity source of truth; `pwa/public/icons/icon.svg`, `scripts/generate-icons.mjs` and `pwa/src/game/app-mark.ts` encode the same mark geometry (the two trails over the hill, the flag) and the same palette. None can import either of the others, so change one and change all three, then `make icons`. `tests/identity_test.ts` holds the generator's palette to `PALETTE`, and `tests/app_mark_test.ts` holds the SVG to `app-mark.ts`.
- `pwa/index.html` restates the name and `BRAND_COLOR` (a static head cannot import); `pwa/public/CNAME` restates the domain. **THE SITE IS DELIBERATELY NOT INDEXED** — the head carries `noindex` and no description, canonical, Open Graph, Twitter card or JSON-LD, the body prerenders no copy, `robots.txt` is `Disallow: /`, and `sitemap.xml`, `llms.txt` and `og.png` are not shipped. `tests/identity_test.ts` holds all of it from both sides; `docs/configuration.md` § *Discoverability* is the description.
- The service worker contract (the cache id, the emitted files) is shared between `pwa/pwa-plugin.ts` and `pwa/src/app-pwa.ts` (`cacheIdForBase`) — keep them agreeing.
- **The rule book has a mirror.** `engine/mapgen/rules.ts` states R1–R16 once in its header; `docs/level-generator.md` carries the same prose VERBATIM. `tests/docs_rules_test.ts` reads the ids off the code, so a new rule fails the test until its mirror lands.
- **The generator and the analyzer read one rule book and must not share anything else.** The search builds to `LEVEL_RULES`; `analyzeLevel` re-checks the FINISHED map against the same numbers reading only what the `Level` publishes, never the plan. A check that could read the plan checks the plan.
- **The sled is drawn off the physics' spec.** `pwa/src/game/sled-body.ts` builds each machine in the engine's body frame from its OWN spec (the stance, the tread's run and lugs, the width, the CoG height — the chassis on the crossover's line, the running gear on its own), and the sled card's sheet (`sled-stats.ts`) bills it off the same row and the engine's own `limits.ts` / `footprint.ts`; and `rider-pose.ts`'s `MOUNTS` are where the drawn grips and boards are. Move the spec and the drawing follows; move the bars or the boards in the drawing and move `MOUNTS` with them.
- **THE DESKTOP SHELL RESTATES THE IDENTITY IN RUST.** `pwa/src/shell-host.ts` states the `__SH_SHELL__` global, both fullscreen events and the menu's word list; `tauri/shell/src/config.rs` and `menu.rs` spell every one of them again, and `identity.ts`'s name, description, `SITE_URL` and `BRAND_COLOR` are restated in `tauri/src-tauri/tauri.conf.json` and `config.rs`. `tests/tauri_test.ts` holds all of it, reading the Rust as TEXT. A word added to one side alone is a menu row that silently does nothing. **The store app restates the same global in JavaScript** — `NATIVE_FLAG` in `native/src/injected.ts`, injected before the page's own scripts — and `tests/shell_test.ts` holds it; `native/app.config.js` READS its name and palette off `identity.ts` by regex, the shape `tests/identity_test.ts` holds.
- **A PULSE IS NAMED THREE TIMES.** The event (`SHELL_RUMBLE` in `pwa/src/shell-host.ts`), the listener that posts it (`RUMBLE_BRIDGE` in `native/src/injected.ts`) and the parser that reads it (`parseRumble` in `native/src/rumble.ts`) cannot import each other; `tests/rumble_test.ts` holds all three. The WEBSITE owns the feature: what is felt is `rumble.ts`, the motor is `haptics.ts`, and the shell only plays what it is handed.
- **The audition page links by CONCATENATION.** `scripts/audition.mjs` inlines the audio modules into one page in dependency order; a bed's table that is not exported, or a module a bed calls that is not listed before it, is a page that builds clean and throws on the first button.
- **Linear light, and every hand-written shader closes the loop.** `sky.ts` authors linear RGB; a `ShaderMaterial` that writes straight to `gl_FragColor` skips the output conversion and hands out a picture about half as bright as authored — every one ends with `#include <colorspace_fragment>`.
- The deployed site IS the product (§11.2-as-webapp): there is no separate `website/` tree and no marketing copy. Keep what is left (the title, the theme colour, the manifest, the privacy and support pages) in sync with `identity.ts` (`update-website` owns the sweep).
- The engine's determinism is a contract three suites hold from three sides — `determinism_test` (a run replays), `simulation_test` (the bot finishes what the generator builds), `imports_test` (no clock, no `Math.random`, nothing external). The only draws a race makes are the rivals' paces at the grid; adding a draw anywhere in `step`, or into the generator's fixed order, changes every digest — say so in the PR.

## Skills

Skills live in `.agents/skills/` (`.claude/skills` and `.gemini/skills` symlink there) — each a `SKILL.md` playbook with an empty `.lessons/` directory `skill-reflection` fills. Load the one that owns the task's SUBJECT, plus the workflow ones its steps name. This file is the router; the procedures live in the skills. `tests/skills_test.ts` holds this list to the directory.

**Session workflow** (every task):

- **`start-work`** — the preflight: clean tree, sync with `origin/main`, the deliver-by-default contract.
- **`write-code`** — how code is written here: comments and the comment-pruning pass, the edit loop, the 1000-line cap, test conventions, the generic pools and aliases. Load beside the subject skill on any code change.
- **`skill-reflection`** — read each loaded skill's lessons at the start (`node scripts/skill-lessons.mjs <skill>`), record/prune/promote at the end.
- **`changelog`** → **`commit`** — the fragment-or-label call, then gates, push, PR. **`conflict`** whenever a branch moves onto another.

**Craft** (the subject owners):

- **`game-feel`** — how the game FEELS: a sled on two grounds, the groomer and the powder; the reference (the arcade winter racers with a modern look); the camera ladder; the cross-system levers. Load it whenever the acceptance test is "does it feel right".
- **`sled-physics`** — the sled's answer to the snow: the probes and springs, the sink and the plough, the grip, the engine, the CVT and the belt, the steering, the carve, the chassis, the rollover, flight and landings; `make ride`.
- **`sled-tuning`** — the machine's own numbers and the expectations a test holds the physics to; the field's pace; the day a roster lands.
- **`sled-design`** — how the sled LOOKS: the builder in the body frame, the grid's four styles; `make world`.
- **`rider`** — the man on the sled: the half-standing pose from the engine's readings, the limbs solved to the grips and the boards; judged from behind at chase range.
- **`collision`** — the sled meeting what is not snow (trunks, rivals, the edge) and the course counting (checkpoints, misses, laps, the flag, the reset); what each event means.
- **`engine-system`** — adding or changing a gameplay system, engine-first.
- **`mapgen-improvement`** — the world generator (the search, the country, the loop, the kickers, the spawn, the forest, the day), the R-rules, the track-and-terrain craft, and the analyze → fix → `make level` loop.
- **`nature`** — the snow-loaded woods (where the generator stands them, how they are drawn), the country as a landscape, the ground's clipmap.
- **`atmosphere`** — the clear winter sky: the sun at the race's own hour, the colour model, the blue in the shadows, the haze, the shadow box.
- **`snow-look`** — the snow as DRAWN: the shader, the glitter, the groomed track and its corduroy, the trail map and the furrows it lowers.
- **`visual-effects`** — what the sled throws and leaves and what the rider feels: the spray, the trails' stamping, the vibration table; event → effect, presentation only.
- **`platform-shells`** — the desktop app (`tauri/`: two crates, decisions and effects) and the store app (`native/`: the WebView, the local server, the haptics bridge), the `__SH_SHELL__` seam and the names stated twice.
- **`lab-tooling`** — how a lab or a script is built here: the `scripts/lib/` shelf, pure-Node versus browser-driven, the harness page, the URL contract, and registering a tool. Load it BEFORE writing a one-off script.
- **`hud-and-menus`** — the HUD's readouts, the three presses, the handlebar and the lever, the keys — what is drawn over a RACE.
- **`menu-system`** — the shell around a race: the attract card, the front door, OPTIONS and its KEYS page, the first-visit probe, the loading card, the pause card, the settings and the URL.
- **`ui-review`** — the fit-and-finish sweep at the reference viewports (1280×720, 390×844, and 844×390 — the phone on its side).
- **`playtest`** — looking at the real game: `make world`'s views and `make screenshots`' moments.
- **`test-scenario`** — exact situations: the synthetic maps, `placeRun`, scripted inputs, the ride lab's scenarios.
- **`debug-game`** — deterministic repros, classifying by layer, the failing test first.
- **`simulate-run`** — `make sim`: the `RunReport` table, its columns, which movements are regressions.
- **`bot-improvement`** — the centreline-reading bot in `engine/sim/bot.ts` — the player's stand-in and every rival — measured with `make sim`.
- **`sound-effects`** — every sound, synthesized: the vocabulary and the instrument, the bank and the route, the beds (the engine and the belt, the snow, the wind) and the listener; `make audition`, and `--meter` for a session that cannot listen.

**Maintenance** (each with a `.last-updated` baseline):

- **`maintenance`** — the umbrella: dispatches every `update-*` skill in registry order after big merges or on a cadence.
- **`update-docs`** / **`update-readme`** / **`update-website`** — re-sync `docs/*.md`, README.md and the identity shell against their sources of truth. (There is no `prompts/` tree, so no `update-prompts`.)
- **`sync-game-spec`** — walk OSS_GAME_SPEC.md chapter by chapter against the repo, offline, and re-date `docs/spec-conformance.md`; the closing step of a full sweep.

Run the specific skill when you know what drifted; run `maintenance` when you don't.

**Reserved, not written** (see `.agents/skills/README.md`): soundtrack, crash, damage, tricks, campaign, level-rating, debug-tools, replay, store-listing, store-shots. A lesson about one of those subjects waits, scoped, in the nearest existing skill until its subject is built — and the sibling repos' skill of the same name is where it starts.
