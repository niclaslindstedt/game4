# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
.PHONY: world sky sled birds trees forest build test lint fmt fmt-check release clean install icons sim level analyze rate difficulty routes ride audition screenshots profile bench hooks shellcheck actionlint changelog bump docs tauri tauri-test tauri-lint tauri-fmt desktop native-install native-bundle native-typecheck native-ios native-iphone native-android

build:
	npm run build

# The vitest suite. SHARD=i/N runs only the i-th of N slices of the test
# FILES — how CI fans the suite out across runners (two of them); a bare
# `make test` is still the whole thing, and stays the definition of green.
#
# Sharding splits at file granularity, so the SLOWEST SINGLE FILE is the
# floor and more runners cannot get under it: share one corpus of built maps
# between the rules a file asserts rather than rebuilding it per rule, and
# split a file whose subject is really two.
test:
	npm test -- $(if $(SHARD),--shard=$(SHARD),)

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

release:
	npm run build

clean:
	rm -rf pwa/dist node_modules pwa/node_modules previews

install:
	npm install

# Regenerate the PWA install icons and the favicon from the app mark (keep
# pwa/public/icons/icon.svg and pwa/src/game/app-mark.ts in lockstep).
icons:
	npm run icons

# THE WORLD LAB: one seed ridden by the bot and photographed through the
# game's own renderer at named moments — previews/world-<view>.png. Builds
# its own one-off bundle from pwa/world-preview.html (never deployed) and
# needs a Chromium: CHROMIUM_PATH=/opt/pw-browsers/chromium in a web
# session. SEED=n picks the map; ARGS="--views=powder,lookback" a subset.
world:
	npm run world -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE SLED LAB: every machine and its rider built with the game's own
# builder and drawn on labelled contact sheets — previews/sled-<sheet>.png:
# the catalog by view (side, front, rear, three-quarter, chase), one
# machine's rider in every pose, and a landing as a time-lapse of the body
# on its legs. Its own one-off bundle from pwa/sled-preview.html (never
# deployed); needs a Chromium like `world`. SLED=id picks the machine the
# poses and the landing ride; ARGS="--sheet=poses" one sheet.
sled:
	npm run sled -- $(if $(SLED),--sled $(SLED),) $(ARGS)

# THE SKY LAB: every weather (R19) against every three hours of the clock,
# day and night, on one seed seen from one place, as one labelled contact
# sheet — previews/sky-<seed>.png. Its own one-off bundle from
# pwa/sky-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n picks the map (its day and latitude are kept);
# ARGS="--hours=6,12,18 --view=vista --weathers=overcast,fog" narrows it.
sky:
	npm run sky -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE WILDLIFE LAB: every bird over the woods and every animal in the snow
# side by side, three poses each through the game's own geometry and
# material, over a metre rule — previews/birds.png. Its own one-off bundle
# from pwa/birds-preview.html (never deployed); needs a Chromium like
# `world`. ARGS="--rows=raven,ptarmigan,reindeer" narrows it.
birds:
	npm run birds -- $(ARGS)

# THE TREE LAB: every kind of tree (spruce, fir, pine, larch, birch) and each
# of its ten variants side by side through the game's own builder and
# material, over snow, seen from the rider's head (2.2 m) standing off
# each tree — previews/trees.png. Its own one-off bundle from pwa/trees-preview.html
# (never deployed); needs a Chromium like `world`. REGION=id paints it as
# that country; ARGS="--kinds=pine,larch" or "--sketch" (the far band's).
trees:
	npm run trees -- $(if $(REGION),--region $(REGION),) $(ARGS)

# THE FOREST LAB: what it is like to be IN a map's woods, from the engine
# and the tree table alone (pure Node, seconds): the trees and their kinds,
# the clumps, the narrowest gap between two groups, how far a rider sees
# into the woods and from the track, any pocket a sled cannot reach — and
# a window of the woods from above, previews/forest-<seed>.png.
# `make forest SEED=38 ARGS=--compare` (version 1 beside it) · `COUNT=12`
forest:
	npm run forest -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# ---------------------------------------------------------------------------
# The desktop app (tauri/)
# ---------------------------------------------------------------------------
#
# A thin wrapper around the same built website, for Windows, macOS and Linux
# — `tauri/README.md` is the tree, `docs/platforms.md` is where it sits. It is
# Rust, so it has its own toolchain and its own linter, and none of it is on
# the root suite's path: `make test` and `make lint` stop at this tree's edge.
# These targets are how it is checked; `.github/workflows/desktop-tauri.yml`
# runs them on every push that touches it.

# Build the site into tauri/webroot/, compile the shell, and launch it.
tauri:
	npm run tauri -- $(ARGS)

# The decision layer's whole test suite, and DELIBERATELY only that crate:
# `powderrun-shell` depends on no GUI toolkit, so this target runs on an
# ordinary CI runner with a Rust toolchain and nothing else. The app crate has
# no tests of its own by design (every decision lives in the library), and
# compiling it needs the platform's webview development libraries — which is
# what `make tauri-lint` and `make tauri` are for.
tauri-test:
	npm run tauri:test

# clippy at zero warnings, the peer of `make lint` for this tree. This one DOES
# need the webview libraries: it checks both crates.
tauri-lint:
	npm run tauri:lint

# rustfmt in place, the peer of `make fmt`.
tauri-fmt:
	npm run tauri:fmt

# Package this machine's desktop downloads into tauri/release/ — the release
# workflow's per-platform job, runnable by hand. `ARGS="--target <triple>"`
# for an explicit target.
desktop:
	npm run tauri:package -- $(ARGS)

# ---------------------------------------------------------------------------
# THE STORE APP (native/): an Expo WebView over a copy of the site bundled
# inside the app. OUTSIDE the npm workspace with a dependency tree of its own,
# so it is installed on its own and typechecked on its own — the root lint
# never sees it. `native/README.md` is the tree, `native/RELEASING.md` the
# submission run-through.
#
# `native-bundle` builds the website and packs it into the zip the app serves.
# THE APP SHIPS WHATEVER ZIP IS ON DISK, so a stale one silently installs the
# last change's game: run it before every device build and every EAS build
# (`native-iphone` and the npm build scripts do it for you).
# ---------------------------------------------------------------------------
native-install:
	npm run native:install

native-bundle:
	npm run native:bundle

native-typecheck:
	npm run native:typecheck

native-ios:
	npm run native:ios

# THE PHONE: build the store app and put it on a REAL iPhone over USB, then
# launch it. Bundles the site, regenerates ios/, signs, installs — one command
# from a clean checkout, and the only way to judge the haptics, which a
# simulator has none of. `make native-iphone ARGS="--device 'my iPhone'"`
# picks between several; ARGS="--skip-bundle" reuses the packed site.
native-iphone:
	npm run native:ios:device -- $(ARGS)

native-android:
	npm run native:android

# Headless balance sweep: the bot rides generated maps through the real
# engine and prints the pace / laps / air / hits table, per seed. Also CI's
# `simulate` job — it exits non-zero when the bot finishes NO seed.
# `make sim` · `make sim SEEDS=3,7`
sim:
	npm run sim -- $(if $(SEEDS),--seeds $(SEEDS),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE LEVEL MAP: one map from above, from the engine alone — no build, no
# browser. The hills, the forest, the track and every checkpoint numbered,
# the spawn and the grid, drawn to previews/level-<seed>.png, with a table
# of the checkpoints beside it. A claim about "the third checkpoint on seed
# 38" is a claim about a row here.
# `make level SEED=38` · `make level SEED=38 ARGS=--json`
level:
	npm run level -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# SCORE generated maps instead of looking at them: each check a band, and a
# finding names what is wrong. The measuring half of the generator loop;
# `make level` is the looking half. Exits non-zero on any error finding.
# `make analyze SEED=7` · `make analyze COUNT=24`
analyze:
	npm run analyze -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# RATE generated maps — how HARD each one is and what KIND of hard, on the
# eight axes of engine/rating/ folded into one index. `--stats` is the
# population per axis; CAMPAIGN=1 audits the committed ladder (every map on
# its own version and held to its digest, the bot's time, the climb).
# `make rate` · `make rate COUNT=96 ARGS=--stats` · `make rate CAMPAIGN=1`
rate:
	npm run rate -- $(if $(SEED),--seed $(SEED),) $(if $(SEEDS),--seeds $(SEEDS),) $(if $(COUNT),--count $(COUNT),) $(if $(CAMPAIGN),--campaign,) $(ARGS)

# THE DIFFICULTY SCHEMATIC: one map from above with what makes it hard drawn
# over it — the corners, the climbs, the drifts, the walled woods — and the
# eight axes beside it, to previews/difficulty-<seed>.png. CAMPAIGN=1 draws
# one sheet per committed map.
# `make difficulty SEED=38` · `make difficulty CAMPAIGN=1`
difficulty:
	npm run difficulty -- $(if $(SEED),--seed $(SEED),) $(if $(CAMPAIGN),--campaign,) $(ARGS)

# THE CAMPAIGN'S ROUTES: every pinned map's loop written down as the line its
# box on the card draws (pwa/src/game/campaign-routes.ts, generated).
# `make routes` · `make routes ARGS=--check`
routes:
	npm run routes -- $(ARGS)

# THE RIDE LAB — the sled on the snow, drawn in profile over the ground it
# crossed, with the numbers that decide the next step beside each cell. One
# staged scenario at a time, through the real engine and a canvas. Required
# before/after any change to the skis, the tread, the sink or the flight.
# `make ride SCENARIO=jump` · `make ride ARGS=--all`
ride:
	npm run ride -- $(if $(SCENARIO),--scenario $(SCENARIO),) $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE EAR: the audio review page, previews/audition.html — every sound on a
# button and the beds (the engine, the track on the snow, the wind) under
# sliders, played by the repo's own synth. Pure Node to build; a browser to
# hear. `ARGS=--meter` drives it headlessly and prints every level.
# `make audition` · `make audition ARGS=--meter`
audition:
	npm run audition -- $(ARGS)

# Drive the built app headlessly and screenshot it at the reference
# viewports. Needs a built pwa/dist (`make build` first, every time),
# `npm i --no-save playwright-core` and a Chromium (CHROMIUM_PATH overrides
# discovery). `make screenshots SEED=38` · `make screenshots SCENE=jump CAMERA=chase`
screenshots:
	node scripts/screenshot.mjs $(if $(SCENE),--scene $(SCENE),) $(if $(SEED),--seed $(SEED),) \
		$(if $(CAMERA),--camera $(CAMERA),) $(ARGS)

# Meter what one frame costs the renderer: draw calls, triangles, program
# and texture binds. Same Chromium requirements as `screenshots`. Run it
# before and after any rendering change.
# `make profile` · `make profile ARGS="--seed 7"`
profile:
	npm run profile -- $(ARGS)

# DEVELOPER ▸ BENCHMARK off the command line: the built site on `?bench=1`,
# the pinned race timed to its end, and the report COPY DEBUG REPORT would
# copy printed and written to previews/benchmark.txt. Headless Chromium draws
# in software, so read its score as this build's cost, not a phone's.
# `make bench` · `make bench ARGS="--width 640 --height 360 --video low"`
bench:
	npm run bench -- $(ARGS)

shellcheck:
	shellcheck scripts/*.sh .githooks/*

actionlint:
	actionlint -color

# Install the repo's git hooks (pre-commit format check, conventional
# commit message lint).
hooks:
	git config core.hooksPath .githooks
	@echo "git hooks installed (core.hooksPath = .githooks)"

docs:
	@echo "see docs/"

# Local preview of what the release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run inside a scratch branch or
# revert afterwards if you only wanted a preview.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	node scripts/release/collate-changelog.mjs $(VERSION)

# Print the semver bump (patch/minor/major) the release workflow will
# auto-derive from the current .changes/unreleased/ fragments. Read-only.
bump:
	@node scripts/release/compute-bump.mjs
