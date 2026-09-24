---
name: menu-system
description: "Use when changing the SHELL the game lives inside — the attract card the app opens on, the front door and its RACE and TIME TRIAL tiles (with the seed on each), the OPTIONS chip and the GALLERY chip (the roll of pictures, shared, copied, saved), OPTIONS and its KEYS page (the picture ladder, the faders, the thumbs, the assist, rebinding a key), the first-visit probe that picks a picture, the loading card over a race being stood up, the pause card that holds a race mid-ride (RESUME, RESTART RACE, SOUND, leave), the finish plate's way on, how a card is walked on the keys, one of the game's own buttons wherever the press came from (`run-actions.ts`), the URL a surface is reached by (`url-params.ts`), or anything the game REMEMBERS between visits (`settings.ts`: the camera, the sound, and every OPTIONS row). Owns the five-surface state machine in `shell.ts` and `App.tsx`, the DOM-free-payload split every card is built on, the rule that the snow never stops behind a card and the one card it does not hold for, and the `make screenshots --surface` loop. Not the readouts over a race — that is `hud-and-menus`."
---

# The menu system: the shell the game lives inside

Everything between opening the page and having hands on a sled, and the little
the game remembers about the visit before. Five surfaces over one canvas, and
one rule they are all arranged around:

**THE SNOW NEVER STOPS — EXCEPT UNDER THE PAUSE CARD.** The engine is stepping
and the renderer is drawing behind every card the app can put up, because each
one stands over a race the BOT has: the bot rides the player's sled, the field
races on, the camera orbits. A menu that froze that would announce the game is
not running. The pause card is the one exception and the one that proves the
rule: it stands over the PLAYER's own race, and a race that carried on while
its rider read a card would cost him the checkpoint he stopped at.
`shell.ts`'s `simulates()` draws that line and `tests/menu_system_test.ts`
holds it.

**Checking it: the PICTURE, not a counter.** Under a software rasterizer a
frame-time probe quantizes and never moves, so a live loop reads as a dead
one. Take two screenshots of the same patch of snow half a second apart and
compare the bytes.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
menu-system --list`. Load **`skill-reflection`** at both ends,
**`write-code`** beside this one, **`hud-and-menus`** for anything drawn over
a RACE, and **`ui-review`** for the sweep at the reference viewports.

**Not built:** a developer page (and the hold that lets it out), a campaign,
other modes beyond RACE and FREE RIDE, a replay, a benchmark. **The
GALLERY is built** (`menu-gallery.tsx` over `lib/shot-store.ts`, the policy
in `lib/shot-roll.ts`; `?menu=gallery`), reached from a CHIP on the front
door's foot — it is not a way onto the snow, so it does not wear a tile's
shape. The shutter is ENTER, or the phone's own screenshot in the store app
— never a menu row, as in game3. The roll
is IndexedDB and never load-bearing; `--surface gallery` photographs the
empty state a fresh browser sees, `--surface gallery-roll` rides a race,
presses ENTER and opens the roll in the same tab.
The sibling `game3` has every one of them, and its `menu-system` skill the
rules they were built under; port from there, and never add a row whose
setting nothing reads (below). OPTIONS is built — ported from game3's, and
the rows are its `menu-knobs.tsx` trimmed to what this page uses.

## The five surfaces

| Surface | Covers | Where |
| --- | --- | --- |
| `splash` | The publisher's name while the first map is built, then the title, the trails laying themselves, and an invitation | `splash-screen.tsx` over the policy in `splash.ts`; the mark from `app-mark.ts` via `mark-trails.tsx` |
| `menu` | The front door over a bot-ridden race: RACE (three laps against three riders on a map dealt from a seed, the seed ON the tile), the OPTIONS chip (the sound switch is a row inside it, never a chip on the door) — and its pages, which are the SAME surface over the same live race (`App.tsx`'s `page`: `root`, `sled`, `options`, `keys`). RACE opens the SLED card — the machine turning on its stand, its sheet beside it, RIDE — which is the last card before the grid. FREE RIDE opens the START card first (the map with its chart, the date, the hour, the snow), whose NEXT is the sled card | `menu-main.tsx`, `menu-start.tsx` (over `free-ride.ts`, `seed-preview.tsx`, `seed-chart.ts`), `menu-sled.tsx` (over `sled-picker.tsx`, `sled-turntable.ts`, `sled-stats.ts`), `menu-options.tsx`, `menu-keys.tsx` |
| `loading` | A race being stood up, paid for in slices | `loading-screen.tsx` over `run-loader.ts`, whose steps are `app-load.ts`'s |
| `pause` | The race HELD: RESUME, RESTART RACE, SOUND, and the way out | `menu-pause.tsx` |
| `run` | The player's hands on the bars, the HUD over the top; the finish plate once the flag is down | `hud.tsx`, `hud-result.tsx` (`hud-and-menus`) |

The surfaces and what each one MEANS are `pwa/src/game/shell.ts` — DOM-free:
`playerRides`, `soundsLive`, `simulates`, `hudOver`, `canPause`, `cameraFor`;
`App.tsx` decides only WHEN one gives way to the next. **One engine state
carries through all five** — the surface decides who rides it (`botInput`
under a card, the input manager under a race) and whether it is stepped at
all.

## Where each piece lives

| Piece | Where |
| --- | --- |
| What the game REMEMBERS: the camera rung, the sled picked, the sound switch, the three faders, the picture, the keys, the thumbs and the assist — versioned, merged field by field | `pwa/src/game/settings.ts` (`mergeSettings`, `mixOf`, `assistOf`, `RUN_CAMERAS`, `nextCamera`) |
| WHAT THE PICTURE COSTS: eight rows, each a ladder cheapest first, the presets, `presetOf` | `pwa/src/game/settings-video.ts` — DOM-free, three-free; `tests/video_test.ts` holds the whole ladder. `renderer.setVideo` is the ONE place a row becomes a draw call |
| The first visit's picture: time MEDIUM under the front door, then promote to HIGH or demote to LOW — only a picture nobody touched | `pwa/src/game/video-probe.ts` (`judgeTier`, DOM-free), fed from `App.tsx`'s loop; off under `?probe=0`, `?video=` and any race a link boots |
| The rows every settings page is built from (a ladder, a fader, a link, a binding), the page head and the ONE caption | `pwa/src/game/menu-knobs.tsx` |
| Which key does what, and the page that changes it | `settings-input.ts` (`KEY_ACTIONS`, `bindKey`, `clashesWith`, `mergeKeys`) + `menu-keys.tsx`; the manager takes the answer through `setBindings` |
| Every parameter the app reads off its URL | `pwa/src/game/url-params.ts` — DOM-free |
| ONE handler for a press, from a key, a HUD thumb or a desktop menu-bar row | `pwa/src/game/run-actions.ts` |
| Standing a race up: the steps and what they are | `pwa/src/game/run-loader.ts` (the sequencing, a frame budget, DOM-free) + `app-load.ts` (the steps, a factory over `App.tsx`'s closures) |
| The fixed-step clock under all of it | `pwa/src/game/run-loop.ts` (§37: the accumulator, the clamp, a hidden tab) |
| Walking a card on the keys | `pwa/src/game/menu-nav.ts` (the DOM half) over `menu-cursor.ts` (the geometry, DOM-free) |
| The marks the cards are read by | `pwa/src/game/menu-glyphs.tsx` — the flag on RACE, the speaker, the pause card's three, the sliders on OPTIONS and its groups' keyboard, dial and screen |
| The new-build button | `pwa/src/game/update-button.tsx` over `pwa/src/lib/pwa-update.ts` |
| Every word | `pwa/src/game/strings.ts` (§39.1) — no card carries a literal |
| The chrome | `pwa/src/styles.css` |

## The rules that are easy to undo by accident

- **The DOM-free payload split.** The decision is a pure module the root
  suite reads (`shell.ts`, `splash.ts`, `menu-cursor.ts`, `run-loader.ts`,
  `run-loop.ts`, `url-params.ts`, `mergeSettings`); the `.tsx` only renders
  it. A rule moved into a component stops being checked.
- **THE PAUSE CARD FREEZES; NOTHING ELSE DOES** — and the absence is never
  paid down. Hold a race three seconds, resume, and the clock moves one frame,
  not three seconds (§37.2, the rule a hidden tab gets too).
- **RESUME IS THE WAY BACK, AND COSTS ONE PRESS.** Escape, the backdrop and the
  cursor's first landing all go back to the snow.
- **A SETTING THE APP IGNORES IS WORSE THAN NO SETTING.** The player moves it,
  nothing happens, and nothing else on the page can be trusted either. Every
  OPTIONS row is read by something (the renderer, the bus, the manager, the
  thumb zones, `createGame`'s `assist`); there is no MUSIC fader because the
  game has no music, by design. A row lands the day the thing behind it exists. A row a
  machine cannot use is not OFFERED to it (the keys without a keyboard, the
  thumbs without a touchscreen) — and is still stored.
- **THE PICTURE APPLIES AT ONCE, OVER THE LIVE RACE** — that is why it is on
  the front door and not the pause card, which freezes the very thing it is
  judged against. TERRAIN and TRAILS REBUILD the ground (a grid's pitch is
  what its buffer was allocated at) and lose the trails cut so far; ANTIALIAS
  is the one row a running context cannot take, and its caption says "next
  time". ASSIST is dealt to a race when it is stood up, so its caption says
  "from the next race".
- **A LAB'S PICTURE IS NEVER STORED.** `?video=<tier>` is this visit's, and
  `?probe=0` holds the probe off; `make screenshots` and `make profile` send
  the second always and the first on `--video`.
- **A LISTENER A PRESS ARMS IS A LAYOUT EFFECT.** OPTIONS ▸ KEYS arms its
  capture in `useLayoutEffect`: an ordinary effect waits for the next paint,
  and a key pressed in between went to the manager as a press of whatever it
  was bound to. Under a software rasterizer that gap is seconds, which is how
  it was found.
- **The stored blob is merged FIELD BY FIELD and every value CHECKED**
  against what this build offers. A value off a ladder is one no press can
  walk the player back to; `Object.assign` over the whole thing is the bug.
- **EXACTLY ONE LIT CONTROL PER CARD.** The brand's red (`PALETTE.flag`) is
  the way onto the snow; a second red control cancels the first.
- **A shell may add a second way to a button, never a second button.** Every
  word the desktop menu bar sends lands on the line a key lands on
  (`run-actions.ts`; `platform-shells`).
- **AN ARRIVAL ANIMATION IS `backwards`, NEVER `both` OR `forwards`.** A
  forwards fill keeps the last keyframe at animation priority and silently
  kills `:active`'s press transform — it photographs perfectly and never
  depresses under a thumb.
- **Every fill on the LOADING card is a `transform`.** The phases that need a
  bar most are single calls that hold the main thread (the generator's
  search, the shader compile); a width animated on that thread freezes for
  exactly as long as the player needs to see it move. Count PHASES, never
  seconds.
- **Confirm is the BROWSER's.** Every control is a real `<button>`, so Enter
  and Space already press it; `menu-nav.ts` is wired for directions and back
  only, or a row is pressed twice.
- **Anything reachable from a card is reachable as a URL** (`?splash=1`,
  `?menu=root|options|keys|sled|start`, `?start=race|free`, `?paused=1`, `?seed=`) — which is what makes a
  frame handable to somebody else, and how `make screenshots` reaches it.

## The loop

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots ARGS="--surface all"   # splash, menu, loading, pause, options, keys, gallery…
CHROMIUM_PATH=/opt/pw-browsers/chromium make profile ARGS="--video all"          # a picture row: every rung, draws and triangles
make screenshots SCENE=race                                                      # the race behind them
npx vitest run tests/menu_system_test.ts tests/video_test.ts
```

`--surface` waits on the card being in the DOM rather than on
`__SH_READY__`, which is a race's flag. Then LOOK, and run `ui-review` at
1280×720, 390×844 and 844×390.

**A card that outgrew the viewport photographs perfectly** — `.menu-card`
scrolls, so its last control sits below the fold in every picture. Anything
that adds HEIGHT is measured: `scrollHeight` against `clientHeight`, before
and after, on both phones.

**A picture is not the machine.** Drive the real flow before calling a change
done: attract card → a press → the front door → RACE → the loading card → the
lights → the HUD; Escape into the pause card and out again (the clock and the
speed held, and not jumping forward); RESTART RACE; finish, and the plate's
way on. The pause card photographs identically whether or not the race under
it actually stopped.

## What the change obliges elsewhere

- A new URL parameter or surface → `url-params.ts`, `docs/configuration.md`,
  `docs/getting-started.md`, and `scripts/screenshot.mjs` if the lab should
  reach it.
- A word on a card → `strings.ts`.
- A new setting → `mergeSettings` **and** a case in
  `tests/menu_system_test.ts` for what an older blob does to it.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule about
what a card may do to the race behind it — or which half of a surface belongs
on the testable side of the line — belongs in the rules above once it has held
twice.
