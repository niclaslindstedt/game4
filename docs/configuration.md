# Configuration

Powder Run has no runtime configuration surface (no accounts, no server); everything below is a URL parameter, build-time, or repo plumbing.

## URL parameters

The running game reads its situation off the URL, which is what makes a map a link and a bug report a repro:

| Parameter     | Meaning                                                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed`        | Which map to build (an integer). The same seed is the same hills, forest, track, checkpoints, start and sun hour on every machine. Pins the front door's RACE to it.                                                                                                                |
| `start=race`  | Boot straight into a race on the grid, the attract card and the front door skipped (`start=1` is the same).                                                                                                                                                                         |
| `start=free`  | ...or into a FREE RIDE on the start card's stored map, day and snow (the `seed` over it).                                                                                                                                                                                           |
| `t`           | ...with this many seconds of it already ridden — by the bot, so a picture of a race is of one moving.                                                                                                                                                                               |
| `shot=1`      | ...held still once drawn, so nothing moves under a screenshot's shutter.                                                                                                                                                                                                            |
| `paused=1`    | ...or held under the pause card.                                                                                                                                                                                                                                                    |
| `mode=trial`  | The run a link boots into (and the next one pressed) is a TIME TRIAL — alone, against the record and its ghost — rather than a race.                                                                                                                                                |
| `mode=tricks` | ...or a TRICKS run: two minutes alone on the seed's trick field (R20), scored.                                                                                                                                                                                                      |
| `camera`      | The race's camera rung: `hood`, `bars`, `chase`, `far`, `high`.                                                                                                                                                                                                                     |
| `sled`        | The player's machine for this visit — `trail`, `crossover`, `mountain`, `cross` — over the stored pick and never written back (a pick on the sled card replaces it).                                                                                                                |
| `menu=root`   | Open on the front door rather than the attract card; `menu=sled` the sled card, `menu=start` the free ride's start card, `menu=options` OPTIONS, `menu=keys` its KEYS page, `menu=campaign` the campaign card, `menu=levels` the level card (with `mode=trial` for a TIME TRIAL's). |
| `weather`     | Ride the map under this sky instead of the one R19 dealt it — `clear`, `fair`, `high`, `overcast`, `snow`, `fog` (`withSky`); the map itself is the seed's.                                                                                                                         |
| `hour`        | ...and from this solar start hour, 0–24 — how a lab stands a race in the dark.                                                                                                                                                                                                      |
| `video`       | Draw this visit at a picture preset — `low`, `medium`, `high` — without storing it: how a lab meters or photographs a rung.                                                                                                                                                         |
| `probe=0`     | Do not time the machine on this visit: the first-visit probe may move an untouched picture, and a lab wants it held still.                                                                                                                                                          |
| `splash=1\|0` | Force the attract card up, or off an ordinary visit.                                                                                                                                                                                                                                |
| `update=1`    | Draw the new-build button as if a build were waiting.                                                                                                                                                                                                                               |

`pwa/src/game/url-params.ts` is the reading of all of them; it, this table and `scripts/screenshot.mjs` move together.

## What the game remembers

One blob, in `localStorage` under `powderrun.settings.v1` (`pwa/src/game/settings.ts`): the camera rung the rider last chose, the sled last picked on the sled card, whether the sound is on, and every row of OPTIONS — the three faders (master, engine, effects), the picture (`pwa/src/game/settings-video.ts`: resolution, distance, terrain, trails, forest, shadows, spray, antialiasing), the key bindings, the thumbs (the lever's side, the travel, the inverted lean), the two assist dials and the damage switch — the time trial's length, the pinned map the level card last picked (`level`, a campaign map's id), the start card's free ride (`pwa/src/game/free-ride.ts`: the map, the date and the hour — each null until moved, which is the map's own — the snow dial, and the spot picked on the chart with the seed it was picked on), and whether the first-visit probe has had its say. It is merged field by field and a stored value this build does not offer is dropped for the default rather than trusted.

**The record book** is a second blob, under `powderrun.records.v1` (`pwa/src/game/records.ts`): one row per map seed, sled, mode and laps — the best time, the sled, the date it was set and the clock at every crossing of that run (what the HUD's **VS BEST** chip is read against). Every row is checked on the way in and one no run could have set is dropped. **The ghosts** are one key each, `powderrun.ghost.v1:<row>` (`pwa/src/game/ghost.ts`): the time trial's record run as the controls that rode it — five run-length-encoded streams, a few kilobytes a lap — with a fingerprint of the map it was ridden on, so a tape for a map the generator has since moved is never put back on the snow. A tape over 400 000 characters is not kept, and a store that will not take either leaves the row standing for the session. Nothing else is written beyond what the service worker caches to play offline.

**The campaign's board** is a third blob, under `powderrun.campaign.v1` (`pwa/src/game/campaign.ts`): per map id, the best time, the sled that set it, the best place and the best medal, and — on a race — the points the whole field was paid by the better afternoon. Ids this ladder does not have and figures no run could have set are dropped on the way in.

A free ride keeps no record and no ghost: its runs are not comparable (`keepsRecords`).

**The first visit's picture.** A fresh visit opens on the MEDIUM picture and, under the front door, times itself drawing it for a second and a half (`pwa/src/game/video-probe.ts`): a machine with room for twice and a half the frame at the display's own rate is moved to HIGH, one already missing frames is moved to LOW, and the verdict is stored so it is asked once. It never touches a picture anybody has changed, never runs over a race, and `?probe=0` or `?video=` hold it off.

## Installing

Every dependency resolves from the public npm registry, so `npm install` needs no token and no `~/.npmrc` entry.

## Build-time environment

| Variable                           | Meaning                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`                        | Deploy base path: `/` (default), `/preview/`, `/branch/`. Drives the SW scope, the manifest identity, and every emitted URL.                                   |
| `VITE_PWA_IGNORE_PATHS`            | Comma-separated absolute paths the built service worker must NOT claim. Only the root slot sets it (`/preview/,/branch/`) so nested slots own their own pages. |
| `GITHUB_SHA` / `GITHUB_RUN_NUMBER` | Provided by CI; baked into the build label the HUD corner shows.                                                                                               |
| `CHROMIUM_PATH`                    | The browser the screenshot and profile tools drive. Claude web sessions have one at `/opt/pw-browsers/chromium`.                                               |

`.env.example` at the root documents the same set; copy it to `.env` (gitignored) to override locally.

The platform shells (`tauri/`, `native/`) each bring an environment of their own, read neither by the website's build nor by each other: the desktop app's launch-time `SH_GAME_URL` (point the window at a deploy slot instead of its bundled copy), and the store app's `native/.env` (`native/.env.example` documents it — the store identifier, the Expo project, the signing team). See [platforms.md](platforms.md).

## The deploy slots

`pages.yml` builds three whole sites and merges them into one Pages artifact served at `game4.niclaslindstedt.se` (the custom domain in `pwa/public/CNAME`; DNS is a CNAME on `niclaslindstedt.github.io`, and the repo's Pages settings must say "GitHub Actions" + that domain):

- `/` — the highest `v*` tag (or `main` before the first release), with `VITE_PWA_IGNORE_PATHS` set so its service worker disowns the nested slots.
- `/preview/` — the triggering `main` commit, every push.
- `/branch/` — parked by `workflow_dispatch` with a `branch_ref` input; persisted in the `branch-deploy` orphan branch so ordinary deploys carry it forward until the next dispatch overwrites it.

Each slot's manifest gets a distinct `id`/`scope`/`start_url` and install name (`Powder Run`, `Powder Run (preview)`, `Powder Run (branch)`), and each slot's service worker its own precache (`cacheIdForBase` in `pwa/src/app-pwa.ts`: `powder-run`, `powder-run-preview`, `powder-run-branch`), so side-by-side installs don't collide.

## Releases

`version-bump.yml` (manual dispatch, and the only entry point) checks the branch and the tree, prints the version it is about to cut, and calls `release.yml`, which derives the bump from `.changes/unreleased/` fragments, rewrites every version string via `scripts/update-versions.sh`, collates the CHANGELOG, commits `chore(release): vX.Y.Z`, tags, creates the GitHub Release as a draft, publishes it, and chains into `pages.yml` so `/` serves the new tag immediately. It is one dispatched run under the default `GITHUB_TOKEN` — no PAT. The desktop shell's packaging matrix (`release.yml`'s `desktop` job) runs between the draft and the publish, which waits until every platform's download is attached.

## Identity

Name, copy, palette, and URLs live in `pwa/src/identity.ts` and nowhere else:

| Field         | Value                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| `APP_NAME`    | Powder Run                                                                        |
| Short name    | PowderRun                                                                         |
| Publisher     | Agilator Games                                                                    |
| `SITE_URL`    | https://game4.niclaslindstedt.se                                                  |
| `REPO_URL`    | https://github.com/niclaslindstedt/game4                                          |
| `BRAND_COLOR` | `PALETTE.skyHigh`, `#6fa8dc` — the manifest, the boot card and the browser chrome |

Every surface that cannot import the module restates what it needs: `pwa/index.html` (the title and the theme colour — deliberately carrying no crawlable copy, see _Discoverability_), `pwa/public/` (CNAME, robots, the privacy and support pages), `scripts/generate-icons.mjs` (the palette the icons are painted in) and the two `package.json` descriptions. `tests/identity_test.ts` holds every one of them to the module, so a rename or a palette change is one edit and a failing test naming the copies.

**The app mark** — a sled's two trails curving over a hill, with a red checkpoint flag — is stated three times: `pwa/public/icons/icon.svg`, the arcs `scripts/generate-icons.mjs` rasterizes (`make icons`), and the two trail paths as data in `pwa/src/game/app-mark.ts`. `tests/app_mark_test.ts` holds the SVG and the data module together.

## Discoverability

**The web deploy is not indexed, on purpose.** The site is the game's free, incomplete cut; it is not meant to be found through a search engine or to unfurl as a card in a chat client, so it emits none of the signals that would make either work:

| Surface                             | What it carries                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pwa/index.html` head               | `noindex,nofollow,noarchive,nosnippet,noimageindex` and nothing else a crawler reads: no meta description, no canonical, no sitemap link, no Open Graph or Twitter card, no JSON-LD |
| `pwa/index.html` body               | `#root` and a `<noscript>` line. No prerendered copy describing the game                                                                                                            |
| `pwa/public/robots.txt`             | `Disallow: /`, advertising no sitemap                                                                                                                                               |
| `sitemap.xml`, `llms.txt`, `og.png` | not shipped, and not generated                                                                                                                                                      |
| `privacy/`, `support/`              | still REACHABLE — a store review fetches them by URL — but `noindex,nofollow` and no canonical                                                                                      |

`robots.txt` alone would only ask a crawler not to fetch; a URL it already knows can still be listed. The per-page `noindex` is what covers that, which is why both are there. `tests/identity_test.ts` holds all of it: adding a discovery tag, a crawler file or prerendered body copy back fails the suite.

This is a deliberate deviation from OSS_GAME_SPEC §11.3, recorded as such in [spec-conformance.md](spec-conformance.md).
