# Agent skills

Every skill is a `SKILL.md` playbook under `.agents/skills/<name>/`, with
the §21.3 front matter and structure, an empty `.lessons/` directory the
`skill-reflection` skill fills, and — for the maintenance skills — a
`.last-updated` baseline (§21.4). `.claude/skills` and `.gemini/skills` are
symlinks here. `AGENTS.md` is the router that says which one to load;
`OSS_GAME_SPEC.md` §21 is the contract they are written to, and
`tests/skills_test.ts` holds this directory, the router's Skills section and
the `maintenance` registry to each other.

Most of these were ported from the sibling jet-ski game (`game3`), with
land-vehicle ideas from the rally game (`game2`) folded into `sled-physics`
and `debug-game`: the procedure halves came across nearly unchanged, the
subject halves were rewritten for snow.

## Session workflow

| Skill | One line |
| --- | --- |
| `start-work` | The preflight: clean tree, sync with `origin/main`, the deliver-by-default contract |
| `write-code` | How code is written here: comments and the pruning pass, the edit loop, the 1000-line cap, tests, the generic pools |
| `commit` | Gates by cost, the commit, the push and the PR as one step, the sim-table obligation |
| `changelog` | The fragment-or-`no-changelog` call every PR owes |
| `conflict` | Moving a branch onto another: the backup branch, always fetch, resolve honestly |
| `skill-reflection` | Read each loaded skill's lessons first; record, prune, merge, promote at the end; the size bars; `scripts/skill-lessons.mjs` |

## Maintenance (§21.5, §21.6)

| Skill | One line |
| --- | --- |
| `maintenance` | The umbrella: the registry of every `update-*` skill and the order they run in |
| `update-docs` | `docs/*.md` back in step with the sled, the snow, the generator, the sim, the app and the tooling |
| `update-readme` | `README.md`'s sections back in step with the commands, the sled and the controls |
| `update-website` | The identity-derived shell under `pwa/` back in step with `identity.ts` — and the site still carrying none of the discovery signals it withholds on purpose |
| `sync-game-spec` | Walk `OSS_GAME_SPEC.md` chapter by chapter against the tree; re-date `docs/spec-conformance.md` |

There is no `update-prompts`: this repo ships no `prompts/` tree. Port the
sibling's the day one lands, and add its registry row.

## Craft (§21.9)

| Skill | One line |
| --- | --- |
| `game-feel` | How the game FEELS: a sled on two grounds (the groomer and the powder), the reference (the arcade winter racers), the camera ladder, the cross-system levers |
| `sled-physics` | The sled's answer to the snow: the probes and springs, the sink and the plough, the grip, the drive and the belt, the steering and the carve, the chassis, the rollover, flight; `make ride` |
| `sled-tuning` | The machine's own numbers (`defs/sled.ts`), the expectations a test holds the physics to, the field's pace, the day a roster lands |
| `sled-design` | How the sled LOOKS: the builder in the body frame, the four grid styles; `make world` |
| `rider` | The man on the sled: the half-standing pose from the engine's readings, the limbs solved to the grips and the boards; judged from behind |
| `collision` | The sled meeting what is not snow — trunks, rivals, the edge — and the course counting: checkpoints, misses, laps, the flag, the reset |
| `crash` | The sled past saving and the rider off it: the wipeout and his tumble, the trench and rocking it out, damage when it is on (the rally game's `crash`, rewritten for a rider and snow) |
| `engine-system` | Adding or changing a gameplay system, engine-first |
| `mapgen-improvement` | The world generator: the basin, the loop, the kickers, the spawn, the forest, the day; the R-rules; track-and-terrain craft; the analyze → fix → `make level` loop |
| `add-region` | A new kind of snow country (R21) end to end: the row, the surface, the look and the grade, the word, the suite and the labs — the boreal kept all ones (the jet-ski game's `add-biome`, retyped) |
| `nature` | The snow-loaded woods (where they stand, how they are drawn), the country as a landscape, the ground's clipmap |
| `atmosphere` | The clear winter sky: the sun by the race's own hour, the colour model, the blue in the shadows, the haze |
| `snow-look` | The snow as DRAWN: the shader, the glitter, the groomed track, the trail map and the furrows it lowers |
| `visual-effects` | What the sled throws and leaves and what the rider feels: the spray, the trails' stamping, the vibration table |
| `platform-shells` | The desktop app (`tauri/`) and the store app (`native/`): the two-crate split, the WebView and its server, the `__SH_SHELL__` seam, the haptics bridge, the names stated twice |
| `picture-pricing` | Every PICTURE stop's measured cost and argued benefit, the price list lab (`make bench --costs`), and what PRESET ▸ AUTO keeps because of them |
| `lab-tooling` | How a lab or a script is built: the `scripts/lib/` shelf, pure-Node versus browser-driven, the harness page, the URL contract, registering a tool |
| `hud-and-menus` | The HUD's readouts, the three presses, the handlebar and the lever, the keys — what is drawn over a RACE |
| `menu-system` | The shell around a race: the attract card, the front door, the loading card, the pause card, the settings |
| `ui-review` | The fit-and-finish sweep at the reference viewports |
| `playtest` | Looking at the real game: `make world`'s views and `make screenshots`' moments |
| `test-scenario` | Exact situations: the synthetic maps, `placeRun`, scripted inputs, the ride lab's scenarios |
| `debug-game` | Deterministic repros, classifying by layer, the failing test first |
| `debug-tools` | The developer page behind the title's seven-second hold: the overlay's instruments, the free camera, the REPRO line, UNLOCKS, and the BENCHMARK with its report and history; `make bench` (the rally game's overlay and the jet-ski game's benchmark) |
| `simulate-run` | `make sim`: the `RunReport` table, its columns, which movements are regressions |
| `level-rating` | Whether a generated map is any GOOD and how HARD: `engine/rating/`'s eight axes and the index, the ladder scorer, `make rate` and `make difficulty` (the jet-ski game's, retyped for snow) |
| `campaign` | The pinned maps and the ladder they make — three shelves of six, the points, the locks, the level card a measured run picks its map on, the generator-version contract and the digest a pinned map stands on (the jet-ski game's) |
| `bot-improvement` | The centreline-reading bot in `engine/sim/bot.ts` — the player's stand-in and every rival — measured with `make sim` |
| `sound-effects` | Every sound synthesized from parameters — the engine and the belt, the hiss, the powder, the wind as steered layers, every one-shot as a def — under `pwa/src/game/audio/`; the audition page and its meter |

## Reserved

Subjects the vertical slice leaves unbuilt. Each will be a skill of its own
when its subject is built; until then a lesson about one waits, scoped, in the
nearest existing skill. The sibling repos' skill of the same subject is the
starting point.

| Future skill | Will own |
| --- | --- |
| `tricks` | The aerial vocabulary and its scoring (the jet-ski game's `tricks.ts`) |
| `replay` | A race recorded as its controls and watched again (the jet-ski game's `replay.ts`; the tape it would read is built — `pwa/src/game/ghost.ts`, the time trial's ghost) |
| `store-listing`, `store-shots` | The storefront's words and its screenshot set |
