# Getting started

Powder Run runs in any browser with WebGL2 — on a phone held either way up, or on a desktop with a keyboard. This page is what a first race looks like, what every control does, and how to run the game from a checkout.

## Playing it

Open [game4.niclaslindstedt.se](https://game4.niclaslindstedt.se/). To keep it on a phone, install it: iOS Safari → Share → Add to Home Screen; Android Chrome → menu → Install app. The installed app launches fullscreen, plays offline once loaded, and shows a small new-build button in a corner when a newer version has been deployed — press it whenever you like; the build you are racing keeps working until you do.

## A first race

1. **The attract card.** The publisher's name while the first map is built behind the card, then the app's two trails lay themselves, POWDER RUN rises under them, and the card asks for a press. Any key or a tap clears it.
2. **The front door.** One lit tile, **RACE**: three laps against three riders on a map dealt fresh from a seed, with the seed printed on the tile — that number is the map, and `?seed=<n>` on the URL rides it again. Along the foot: the sound switch, **OPTIONS**, the keys you ride on, the build. Behind the card a bot is already racing the map and the camera circles its sled; nothing is paused.
3. **The loading card.** The map generated from its seed, the field stood on the grid, the terrain, the forest and the checkpoints built, every shader compiled — a second or two, shown as a bar per phase.
4. **The lights.** You stand in deep powder beside the track with the field abreast of you. Three lights, then GO.
5. **Onto the track.** The first thing a race asks is the run through the powder onto the packed trail. The start line is the track point nearest the grid; crossing it opens lap one.
6. **The race.** Checkpoints — a pair of flagged poles either side of the track, the next one loud red, the rest muted — must be taken in order. Ride past one and the HUD warns you, with an arrow back to it and the metres to go; the next one is not credited until the missed one is taken. Three laps, then the flag.
7. **The finish plate.** Your place and time, then the whole field's table, live, as the others cross the line. **RACE AGAIN** (the same map from the grid), **NEW MAP**, or **MAIN MENU**.

At any point, **Escape** (or the pause mark in the top right) holds the race under the pause card: **RESUME** (back to the frame you left), **RESTART RACE**, **SOUND**, **MAIN MENU**. The pause card is the only surface that stops the snow; behind every other card the race keeps running.

## Riding

The whole game is two grounds under one machine. On the **packed track** the skis bite, the tread drives and the sled is quick and sure. In **powder** the sled sinks: at walking pace it wallows with the tread buried to its rails, and as speed builds it climbs up onto the top of the snow and planes — keep the throttle open and you float; stop in it and you dig in. Cutting a corner through the powder is a decision with a price.

- **Turning.** On the track the skis turn you. In powder the rider's weight does: the sled rolls onto the edge of its tread and carves round.
- **Kickers.** Crests on the track (and on hilltops off it) are shaped to throw you. In the air the **lean** pitches the sled; the **throttle** spins the tread up and lifts the nose; the **brake** stops the tread and drops it. Land on the downslope and you keep your speed; land flat past it and the suspension bottoms and costs you.
- **Trees** are solid. A clipped trunk spins you; one met square stops you.
- **Stuck or upside down?** **R** stands you back on the track just past the last checkpoint you took. It also happens on its own after a few seconds on your side or going nowhere at full throttle.

## Controls

**Keyboard** (`pwa/src/game/settings-input.ts` is the table):

| Key                | Does                                             |
| ------------------ | ------------------------------------------------ |
| W / ↑              | Throttle                                         |
| S / ↓ / Space      | Brake                                            |
| A D / ← →          | Steer                                            |
| E / Shift          | Lean back — in the air, nose up                  |
| Q / Z              | Lean forward — in the air, nose down             |
| R                  | Back onto the track at the last checkpoint taken |
| B                  | Restart the race from the grid                   |
| C                  | Next camera                                      |
| Escape             | Pause                                            |
| Arrows, Enter, Esc | Walk a card, press a row, go back                |

**Touch:** the lower-left of the screen is the **handlebar** — touch anywhere there and move the thumb: sideways travel steers, vertical travel leans. The lower-right is the **lever** — it anchors where your thumb lands; drag DOWN to open the throttle, push UP to brake. The top-right corner carries three presses: pause, reset, camera.

**Cameras** (C, or the camera press): **hood** and **bars** are bolted to the sled and pitch and roll with it; **chase** (the default), **far** and **high** stand behind on a boom. The game remembers the one you chose.

## Options

**OPTIONS** on the front door, over the same live race, in four groups. **CONTROLS**: **KEYS** opens a page with every action on it — press a row, then the key to put on it (Escape leaves it as it was); a key on two actions says so. On a touchscreen, **LEVER SIDE** swaps the lever and the handlebar, **TRAVEL** shortens or lengthens every thumb's throw, and **INVERT LEAN** makes pushing the bar away the lean back. **ASSIST**: **STEER HOLD** (the arcade's hand keeping the nose on the line the skis ask for) and **AIR LEVEL** (the rider's body keeping the sled level side to side in the air), each FULL, HALF or OFF, from the next race. **SOUND**: the switch, and faders for everything, the engine and the effects. **PICTURE**: a **PRESET** that moves every row at once, then RESOLUTION, DISTANCE, TERRAIN, TRAILS, FOREST, SHADOWS, SPRAY and SMOOTH EDGES one at a time — each applied at once, so it is judged against the race behind the card (SMOOTH EDGES alone waits for the next visit). A first visit picks its own preset by timing the machine (`docs/configuration.md`). The caption at the foot says what the row under the pointer does.

## What the game remembers

The camera, the sound switch and every OPTIONS row (`docs/configuration.md`).

## From a checkout

```sh
npm install
npm run dev          # the game, hot-reloading; ?seed=38 on the URL for a given map
make build           # typecheck + production build into pwa/dist/
make test            # the suite
make sim             # the bot races generated maps headlessly: the balance table
make level SEED=38   # one map from above, every checkpoint numbered
make ride            # the sled on the snow in profile, one staged scenario at a time
```

The README's Usage table lists every target; [AGENTS.md](../AGENTS.md) says which one a change owes. The browser-driven labs (`make screenshots`, `make profile`, `make world`, `make audition ARGS=--meter`) need `npm i --no-save playwright-core` and a Chromium (`CHROMIUM_PATH`).

The desktop app (`make tauri`) and the store app (`make native-*`) wrap the same built site — [platforms.md](platforms.md).
