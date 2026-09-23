# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
.PHONY: build test lint fmt fmt-check release clean install icons sim level analyze ride audition screenshots profile hooks shellcheck actionlint changelog bump docs

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

# THE PLATFORM SHELLS' SEAM. The desktop app (tauri/) and the store app
# (native/) are not built yet; when they land their targets go here — each
# tree checked by its own peers (`tauri-test`, `native-typecheck`, …), never
# by `make test` or `make lint`. package.json already names their scripts.

# Headless balance sweep: the bot rides generated maps through the real
# engine and prints the pace / laps / air / hits table, per seed. Also CI's
# `simulate` job — it exits non-zero when the bot finishes NO seed.
# `make sim` · `make sim SEEDS=3,7`
sim:
	npm run sim -- $(if $(SEEDS),--seeds $(SEEDS),) $(ARGS)

# THE LEVEL MAP: one map from above, from the engine alone — no build, no
# browser. The hills, the forest, the track and every checkpoint numbered,
# the spawn and the grid, drawn to previews/level-<seed>.png, with a table
# of the checkpoints beside it. A claim about "the third checkpoint on seed
# 38" is a claim about a row here.
# `make level SEED=38` · `make level SEED=38 ARGS=--json`
level:
	npm run level -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# SCORE generated maps instead of looking at them: each check a band, and a
# finding names what is wrong. The measuring half of the generator loop;
# `make level` is the looking half. Exits non-zero on any error finding.
# `make analyze SEED=7` · `make analyze COUNT=24`
analyze:
	npm run analyze -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(ARGS)

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
