# Powder Run

> A snowmobile racing game for the browser: generated snowy hills, mountain flanks and snow-loaded forest, a packed-snow race loop laid over them and deep powder everywhere else, a sled that sinks, floats, carves and flies the way a sled actually does — playable on your phone or desktop, installable as a PWA, offline once loaded. **[Play it now](https://game4.niclaslindstedt.se/).**

[![ci](https://github.com/niclaslindstedt/game4/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/game4/actions/workflows/ci.yml)
[![release](https://github.com/niclaslindstedt/game4/actions/workflows/release.yml/badge.svg)](https://github.com/niclaslindstedt/game4/actions/workflows/release.yml)
[![pages](https://github.com/niclaslindstedt/game4/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/game4/actions/workflows/pages.yml)
[![spec](https://img.shields.io/badge/OSS__GAME__SPEC-v1.1.0-blueviolet)](OSS_GAME_SPEC.md)
[![license](https://img.shields.io/badge/license-PolyForm--NC-blue.svg)](LICENSE)

## What

Powder Run is an arcade snowmobile racer — no account, no download, free. The whole game is the sensation of a sled meeting snow: on the packed track the skis bite and the tread drives, and off it the sled wallows in deep powder at walking pace and climbs up onto the top of it as speed builds, the way a sled really floats. Hill crests kick you into the air, the throttle and the brake pitch the nose in flight, and a harsh landing costs you the speed you carried into it.

Every map is **generated from a seed** by a rules engine: a basin of rolling hills and ridges walled by mountain flanks, open powder meadows between forests of snow-loaded conifers, and a closed race loop graded into the ground with crests on it that are jumps. The race starts out in the powder beside the track — you ride onto it first — and runs three laps against three rivals through checkpoints in order. The sun's hour comes with the seed too; the same seed is the same map on every machine, so a URL is a map and a bug report is a repro.

One sled ships, an invented trail sled with no real brand behind it, with its rider on the seat. Every hill, every tree and every sled is written in code; the game ships no asset files, and every sound is synthesized.

**What exists today is the first vertical slice**: one generated map, one sled, RACE mode only (you and three bot rivals, three laps) under a clear sky, the trails every sled leaves in the snow, a HUD with the speed, the lap and checkpoint count, the race clock and your place, keyboard and touch controls, and a shell of attract card, front door, loading card, pause card and finish plate. Weather, night, more modes, more sleds and the desktop and store apps are planned, not built.

## Why

- **The snow first.** Packed track and virgin powder are two different grounds under the same sled: sink, drag and grip all answer to how packed the snow under each ski and under the tread is, and the sled floats higher the faster it goes.
- **A sled, not a car.** Two sprung skis steer, a sprung tread drives through a traction limit, and the rider's weight carves the sled in powder. Each force is stated once, with its unit.
- **Maps, endlessly.** A rules engine builds every map and every track under hard constraints — same seed, same map, shareable and replayable.
- **Measured, not guessed.** A headless simulator rides a bot through the real engine; the balance table and the labs keep the sled, the snow and the generator honest with each other.
- **Web-native.** One codebase, phone-first, portrait and landscape, installable, offline-capable. Desktop and store shells come later ([docs/platforms.md](docs/platforms.md)).

## Prerequisites

- Node.js 22+ (CI pins the version in [`.nvmrc`](.nvmrc))
- npm 10+

## Install

```sh
git clone https://github.com/niclaslindstedt/game4
cd game4
npm install
```

Every dependency comes from the public npm registry — no token, no registry configuration.

## Quick start

```sh
npm run dev
```

Open the printed URL. `?seed=38` on the URL opens another map.

## Usage

| Command                 | What it does                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `make build`            | Typecheck both programs (the engine and the app) and build the site into `pwa/dist/`                        |
| `make test`             | The vitest suite; `SHARD=i/N` runs one slice of it (CI runs two)                                            |
| `make lint`             | eslint and the typecheck, zero warnings                                                                     |
| `make fmt`              | prettier in place; `make fmt-check` is what CI runs                                                         |
| `make hooks`            | Install the pre-commit and commit-msg git hooks                                                             |
| `make icons`            | Regenerate the install icons and the favicon from the app mark                                              |
| `make sim`              | The headless balance sweep: the bot races generated maps through the real engine (`SEEDS=3,7`)              |
| `make level`            | One map from above, from the engine alone: the hills, the forest, the track and its checkpoints (`SEED=38`) |
| `make analyze`          | Score generated maps for defects; exits non-zero on an error finding (`SEED=7`, `COUNT=24`)                 |
| `make ride`             | The sled on the snow in profile, one staged scenario at a time (`SCENARIO=`)                                |
| `make world`            | One map ridden by the bot, photographed through the renderer at named views (`SEED=38`, `ARGS=--views=`)    |
| `make audition`         | The audio review page, every sound and bed on a button; `ARGS=--meter` prints the levels                    |
| `make screenshots`      | Drive the built app headlessly and photograph it at the reference viewports (`make build` first)            |
| `make profile`          | What one frame costs the renderer: draw calls, triangles, binds (`make build` first)                        |
| `make tauri`            | Build the site into the desktop app and launch it (needs Rust)                                              |
| `make tauri-test`       | The desktop app's decision layer, on a bare Rust toolchain                                                  |
| `make tauri-lint`       | clippy over both desktop crates at zero warnings (needs the webview libraries); `make tauri-fmt` formats    |
| `make desktop`          | Package this machine's desktop downloads into `tauri/release/`                                              |
| `make native-install`   | The store app's own dependency tree                                                                         |
| `make native-bundle`    | Pack the built site into the store app — before every native build                                          |
| `make native-typecheck` | tsc over the store app's shell                                                                              |
| `make native-ios`       | The store app on an iOS simulator (`native-android` for Android, `native-iphone` for a real iPhone)         |
| `make shellcheck`       | shellcheck over the scripts and the git hooks; `make actionlint` lints the workflows                        |
| `make changelog`        | Preview the CHANGELOG section a release would write (`VERSION=X.Y.Z`)                                       |
| `make bump`             | Print the semver bump the release would derive from the changeset fragments                                 |

The browser-driven labs (`screenshots`, `profile`, `world`, `audition ARGS=--meter`) need `npm i --no-save playwright-core` and a Chromium; `CHROMIUM_PATH` points at one.

## Controls

**Keyboard:** W throttle, A D / ← → steer, S / Space brake, ↑ ↓ lean the rider forward and back (in the air they pitch the sled), R back onto the track at the last checkpoint you passed, C camera, Escape pause. In the air the throttle spins the tread and lifts the nose; the brake stops it and drops the nose.

**Touch:** the lower-left of the screen is the handlebar — touch anywhere and move the thumb: sideways travel steers, vertical travel leans. The lower-right is the throttle lever — drag DOWN to open it, further for the brake. Works in portrait and landscape; the HUD re-flows to fit.

**On the phone:** the game is an installable PWA — open [game4.niclaslindstedt.se](https://game4.niclaslindstedt.se/), then "Add to Home Screen" (iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app). It launches fullscreen, works offline and prompts in-app when a new build ships.

## Configuration

All configuration is a URL parameter or build-time:

- `?seed=` — which map.
- `VITE_BASE` — deploy base path (`/`, `/preview/`, `/branch/`); set by the Pages workflow, defaults to `/`.
- `VITE_PWA_IGNORE_PATHS` — sibling deploy slots the root service worker must not claim; set by the Pages workflow.

**The three deploy slots**, all on GitHub Pages at [game4.niclaslindstedt.se](https://game4.niclaslindstedt.se/):

| Slot        | Serves                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| `/`         | The latest release (the highest `v*` tag), or `main` before the first release         |
| `/preview/` | The current `main`, rebuilt on every push                                             |
| `/branch/`  | A feature branch parked there by dispatching the `pages` workflow with a `branch_ref` |

See [docs/configuration.md](docs/configuration.md) for the full picture.

## Troubleshooting

- **Black canvas / WebGL errors** — the renderer needs WebGL2; check `chrome://gpu` or try another browser. The engine itself is fine — `make sim` runs without any GPU.
- **The sled bogs down off the track** — deep powder holds a slow sled. Keep the throttle open and the speed up and it climbs onto the top of the snow; stop in it and you dig in.
- **Stuck or upside down** — R puts you back on the track at the last checkpoint you passed; it also happens on its own after a few seconds.
- **Stale build after deploy** — the service worker prompts before updating; if a prompt was dismissed, reload twice or clear site data.

## Architecture

Three layers, one direction of dependency: `engine/` is the whole game as a framework-free, renderer-free TypeScript module (the map generator, the sled, the snow, the course, the race, the bot and the analyzer — fixed 120 Hz steps, deterministic per seed); `pwa/` is the browser shell (Preact, three.js, the HUD, the audio, the PWA plumbing) that reads the engine's state and never steps it; `tests/` and `scripts/` sit beside them. [AGENTS.md](AGENTS.md) is where new code goes.

## Documentation

- [Configuration](docs/configuration.md) — URL parameters, the deploy slots, the identity
- [Platforms](docs/platforms.md) — the web, and the desktop and store apps planned beside it
- [Spec conformance](docs/spec-conformance.md) — where this repo stands against [OSS_GAME_SPEC.md](OSS_GAME_SPEC.md), chapter by chapter

## Contributing

Bugs and feature requests go to [GitHub Issues](https://github.com/niclaslindstedt/game4/issues); questions to [Discussions](https://github.com/niclaslindstedt/game4/discussions). Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow (conventional commits, changeset fragments, the labs-before-and-after rule for sled, snow and generator changes). This repository conforms to [OSS_GAME_SPEC.md](OSS_GAME_SPEC.md).

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to play, read, and modify for noncommercial purposes. Code and the generated assets alike: the game ships nothing it did not write, so there is no second license to state.
