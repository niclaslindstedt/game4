# Troubleshooting

The failures a player or a contributor actually meets, and what each one is.

## Playing

- **A black canvas, or a WebGL error on the loading card.** The renderer needs WebGL2. Check `chrome://gpu` (or the browser's equivalent) and try another browser; a machine with hardware acceleration switched off draws through a software rasterizer at a few frames a second. The engine itself is fine — `make sim` races the same maps with no GPU at all.
- **The sled bogs down off the track.** Deep powder holds a slow sled — that is the game, not a bug. Keep the throttle open and the speed up and it climbs onto the top of the snow and planes; stop in it and you dig in. The quickest way back is usually straight at the track.
- **Stuck, on your side, or upside down.** R stands the sled back on the track just past the last checkpoint you took. The engine does it on its own after a few seconds on your side or going nowhere at full throttle.
- **A checkpoint did not count.** Checkpoints are taken in order, one live at a time. Ride past one and the HUD's arrow points back at it with the metres to go; nothing after it is credited until it is taken.
- **No sound.** A browser makes no sound until the page has been touched — a tap or a key after it loads unlocks it. Check the SOUND switch in OPTIONS (off the front door or the pause card), and on an iPhone the ringer switch (the browser respects it; the store app does not).
- **The phone does not buzz.** Vibration is the browser's Vibration API, which iOS Safari does not offer; the store app uses the phone's own haptics.
- **A stale build after a deploy.** The installed app keeps racing the build it has and shows a small new-build button in a corner when a newer one is waiting — press it. If that was missed, reload twice or clear the site's data.
- **The same map every time.** A `?seed=` on the URL pins the front door's RACE to that map; the tile says so. Drop it from the URL for a fresh map each race.

## Developing

- **`make screenshots` or `make profile` photographs the last change.** Both drive the BUILT site in `pwa/dist/`: `make build` first, every time. (`make world` and `make audition` build their own bundles and do not need it.)
- **A browser lab cannot find a browser.** They need `npm i --no-save playwright-core` and a Chromium; point `CHROMIUM_PATH` at one (`/opt/pw-browsers/chromium` in a Claude web session). Never run `playwright install`.
- **A browser lab times out waiting.** It waits for `window.__SH_READY__`, which the app sets once a race's frame is drawn; a page error before that (printed as `[pageerror]`) is the real failure. A key held before it is dropped — the loading card is still up.
- **`make bench` takes a quarter of an hour, or scores in single figures.** Headless Chromium draws in SOFTWARE (SwiftShader), so the pinned thirty seconds run at a frame or two a second: pass `ARGS="--width 640 --height 360 --video low"` and read the score as this build's cost rather than a device's. A score to hold a phone to comes off the phone: DEVELOPER ▸ BENCHMARK ▸ COPY DEBUG REPORT.
- **A lab dies with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.** The labs run on `node --experimental-strip-types`, which refuses enums, parameter properties and namespaces in anything a script imports — even three files away. Neither `make lint` nor `make test` catches it; write a union and assign fields in the constructor body.
- **`npx tsc --noEmit` is green and `make build` fails.** The root typecheck does not read `pwa/src`; `npm run typecheck:only` runs both programs and is what the build gates on.
- **A test passes under vitest and fails `make lint`.** The root `tsconfig.json` has no DOM library, so a test that reaches a module importing `window` or `document` — even by `import type` — runs green and fails the typecheck. Keep the tested half of a surface DOM-free.
- **The sim digests changed and nobody touched the sim.** Any change to the physics, the bot or the generator moves every digest; a draw added anywhere in `step` or in the generator's fixed order moves them all. It is only a bug when two runs of the SAME tree differ (`tests/determinism_test.ts`).
- **`make analyze` fails on a seed after a rules change.** The rules change re-rolled the map; compare finding TALLIES over a sweep (`make analyze COUNT=24`), never one seed before and after.
- **`tests/docs_rules_test.ts` fails.** An R-rule's prose in `engine/mapgen/rules.ts` and its copy in `docs/level-generator.md` disagree; the doc carries it verbatim.
- **`tests/skills_test.ts` fails.** A skill on disk is missing from `AGENTS.md`'s Skills section (or the other way round), a routing table names a skill that does not exist, or the `maintenance` registry is out of step with the `update-*` skills.
- **The desktop or store app shows an old game.** `make tauri` rebuilds the site into `tauri/webroot/`; the store app ships whatever `native/assets/webroot.zip` is on disk, so `make native-bundle` before every native build.
