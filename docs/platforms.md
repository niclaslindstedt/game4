# Platforms

The repository is structured after its sibling games, which ship one product through many shells: web/PWA, desktop, and native mobile (App Store / Play Store). Powder Run adopts the same shape deliberately — the engine is headless and shell-agnostic, and every shell wraps the identical built site — and ships **the web today**, with the desktop app and the store app planned and their seams already in place.

## Web / PWA (`pwa/`)

The deployed site IS the product. It is installable (home-screen app on iOS/Android, fullscreen launch), offline-capable (hand-rolled precaching service worker, `pwa/pwa-plugin.ts`), self-updating (in-app prompt from `pwa/src/lib/pwa-update.ts`), and phone-first with full desktop keyboard support. Three deploy slots on [game4.niclaslindstedt.se](https://game4.niclaslindstedt.se/):

| Slot        | Serves                                        |
| ----------- | --------------------------------------------- |
| `/`         | The latest release (highest `v*` tag)         |
| `/preview/` | Current `main`, on every push                 |
| `/branch/`  | A feature branch parked via workflow dispatch |

Each slot is a whole build at its own base path with its own install identity, so the three can be installed side by side without fighting over one service-worker scope.

## Desktop (`tauri/`) — planned

A thin Tauri wrapper around the built website for Windows, macOS and Linux: one window in the platform's own webview, the site bundled inside it and served from a private scheme, so it plays offline and is an app rather than a viewer for a web page. It follows the sibling jet-ski game's shape: two Rust crates, `shell/` for every decision (no GUI, testable on a bare toolchain) and `src-tauri/` for every effect.

**What is already in place for it:** the root `package.json` names its `tauri*` scripts; `release.yml` carries a marked seam where the per-platform packaging matrix goes, between the draft release and its publish; and `pwa/src/shell-host.ts` — the one file of the app that knows a shell can exist — is already the page's side of the bridge. **What it will add:** the `tauri/` tree, its `make tauri*` targets, a `desktop-tauri.yml` workflow, and a `tests/tauri_test.ts` that reads the Rust as text to hold its restatement of the identity to `pwa/src/identity.ts`.

## Native mobile (`native/`) — planned

A thin Expo / React Native wrapper around the same built website: one full-screen WebView over a copy of the site packed inside the app and served from a local server on launch, so it plays offline and updates through the store, plus the phone's own haptics under the game's vibration table.

**What is already in place for it:** the root `package.json` names its `native*` scripts, `tests/imports_test.ts` carries the (empty) `SHELL_SEAM` list its import-free seam modules will be named in, and `.prettierignore` / `.gitignore` already know its build output. **What it will add:** the `native/` tree outside the npm workspace, its `make native-*` targets, a dispatch-only EAS workflow, and the seam tests that hold the names it restates to the page's.

## What the page knows about a shell

One file: `pwa/src/shell-host.ts`. Each shell's initialization script defines one frozen global, `__SH_SHELL__`, before the game's own scripts run, and that module is the only place that reads it. What a shell may say to the page and what the page may ask of a shell travels on a handful of DOM events prefixed `sh-` — a fullscreen ask and its answer, a haptic pulse, a menu row pressed — and every one of them is a thing the website already does. **Nothing in `engine/` learns a shell exists**, and a feature a shell needs is a feature the website needs first.

## Deliberate differences from the sibling repos

- **No store listing.** Store metadata, a preflight and a screenshot sweep are out of the slice; they arrive, if ever, with the store app.
- **No modding seam.** Content is typed data in `engine/game/defs/` (the sled, the tuning). If content authoring outgrows TypeScript rows, the defs modules are already the seam.
- **No multiplayer/server.** Maps are deterministic by seed, so the natural first social feature is asynchronous: a shared seed, then ghost times — no server shell until then.
