# Configuration

Powder Run has no runtime configuration surface (no accounts, no server); everything below is a URL parameter, build-time, or repo plumbing.

## URL parameters

The running game reads its situation off the URL, which is what makes a map a link and a bug report a repro:

| Parameter     | Meaning                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed`        | Which map to build (an integer). The same seed is the same hills, forest, track, checkpoints, start and sun hour on every machine. Pins the front door's RACE to it. |
| `start=race`  | Boot straight into a race on the grid, the attract card and the front door skipped (`start=1` is the same).                                                          |
| `t`           | ...with this many seconds of it already ridden — by the bot, so a picture of a race is of one moving.                                                                |
| `shot=1`      | ...held still once drawn, so nothing moves under a screenshot's shutter.                                                                                             |
| `paused=1`    | ...or held under the pause card.                                                                                                                                     |
| `camera`      | The race's camera rung: `hood`, `bars`, `chase`, `far`, `high`.                                                                                                      |
| `menu=root`   | Open on the front door rather than the attract card.                                                                                                                 |
| `splash=1\|0` | Force the attract card up, or off an ordinary visit.                                                                                                                 |
| `update=1`    | Draw the new-build button as if a build were waiting.                                                                                                                |

`pwa/src/game/url-params.ts` is the reading of all of them; it, this table and `scripts/screenshot.mjs` move together.

## What the game remembers

Two things, in `localStorage` under `powderrun.settings.v1` (`pwa/src/game/settings.ts`): the camera rung the rider last chose, and whether the sound is on. A stored value this build does not offer is dropped for the default rather than trusted. Nothing else is written beyond what the service worker caches to play offline.

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
