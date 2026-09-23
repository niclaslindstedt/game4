# Getting started

Powder Run runs in any browser with WebGL2 — on a phone held either way up, or on a desktop with a keyboard. This page is what a first race looks like, what every control does, and how to run the game from a checkout.

## Playing it

Open [game4.niclaslindstedt.se](https://game4.niclaslindstedt.se/). To keep it on a phone, install it: iOS Safari → Share → Add to Home Screen; Android Chrome → menu → Install app. The installed app launches fullscreen, plays offline once loaded, and shows a small new-build button in a corner when a newer version has been deployed — press it whenever you like; the build you are racing keeps working until you do.

## A first race

1. **The attract card.** The publisher's name while the first map is built behind the card, then the app's two trails lay themselves, POWDER RUN rises under them, and the card asks for a press. Any key or a tap clears it.
2. **The front door.** One lit tile, **RACE**: three laps against three riders on a map dealt fresh from a seed, with the seed printed on the tile — that number is the map, and `?seed=<n>` on the URL rides it again. The tile opens the sled card. Beside it, **TIME TRIAL**: the map the menu is standing over (the one you just rode, or the one `?seed=` pinned), alone under the lights, against the clock — the tile shows the best time the record book holds for that map, the sled on the sled card and the trial's length. Then **TRICKS** (below) and **FREE RIDE** (below). Along the foot: the sound switch, the trial's length (**TRIAL 3 LAPS** / **TRIAL 1 LAP**), **OPTIONS**, the keys you ride on, the build. Behind the card a bot is already racing the map and the camera circles its sled; nothing is paused.
3. **The sled card.** Which machine: the sled itself turning on a stand of snow, an arrow either side of it to step through the four — **TRAIL** (short tread, low lugs: quickest on the groomer, lost in a drift), **CROSSOVER** (the middle of every band), **MOUNTAIN** (a long belt of tall paddles: floats where the others bog, pushes wide on a groomed bend) and **CROSS** (light, stiff, long travel: lands what the others bottom on) — its top speed, 0–100 and power beside it, and five bars saying where it stands against the other three: ACCELERATION, TOP SPEED, CORNERING, POWDER, LANDINGS. The pick is remembered. **RIDE** stands the race up; the three rivals are each dealt a machine of their own.
4. **The loading card.** The map generated from its seed, the field stood on the grid, the terrain, the forest and the checkpoints built, every shader compiled — a second or two, shown as a bar per phase.
5. **The lights.** You stand in deep powder beside the track with the field abreast of you. Three lights, then GO.
6. **Off the grid.** The field stands in rows on the track behind the start line; crossing it opens lap one. Stretches of the track lie drifted over with fresh snow (R17) — slower going on a short-tread sled, and where a mountain sled earns its keep.
7. **The race.** Checkpoints — a pair of flagged poles either side of the track, the next one loud red, the rest muted — must be taken in order. Ride past one and the HUD warns you, with an arrow back to it and the metres to go; the next one is not credited until the missed one is taken. Three laps, then the flag. The round map under the buttons in the top right turns with you, so ahead is always up: the grey line is the track, the red bar the checkpoint you owe (a red chevron on the rim points at it when it is off the map), and the coloured dots the other three sleds.
8. **The finish plate.** Your place and time, then the whole field's table, live, as the others cross the line. **RACE AGAIN** (the same map from the grid), **NEW MAP**, or **MAIN MENU**. A time trial's plate is your time, then the record book's line: **NEW RECORD**, or the best that stood — its sled and the day it was set — and how far off it you were; **RIDE AGAIN** is the same map from the grid.

**The record book and the ghost.** Every finished run is filed under its map's seed, the sled, the mode and the laps, and a quicker one replaces the row (a tie does not). In a time trial the HUD's split carries a second chip, **VS BEST**: how far ahead (green) or behind (red) the record was at that same checkpoint. And the run that set the record is kept as the controls that rode it, so the next trial on that map, sled and length is ridden beside its **ghost** — a pale, see-through sled on exactly the line the record took, leaving no trail in the snow. Beat the time and your run becomes the ghost.

## A tricks run

**TRICKS** on the front door is the map the menu is standing over with its **trick field** laid on the loop (R20): groomed kickers in three sizes — small, medium, large and round again — at every straight stretch of the track. It opens the sled card; **RIDE** stands it up, and after the lights you have two minutes alone on it, the course counting nothing. The score is the run:

- **The air pays** by the second and by the metre, more the longer you hang.
- **Flips**: carry the lean all the way back off the lip (**E** / **Shift**) and the sled throws a **BACKFLIP**; all the way forward (**Q** / **Z**) a **FRONT FLIP** — the brake's gyro helps it over. **360s**: throw the bars all the way over. One full press is one throw; tap it again for more rotation, out of what the flight allows. You cannot start one on the way down. Short of full lean, the lean is the usual air control — how you check a flip for the landing.
- **Poses**: hold the trick button (**F** / **X**, or the **TRICK** press on a touchscreen) in the air: with the bars over, a **ONE-FOOTER**; with the lean back, a **CAN-CAN**; otherwise a **TUCK**. While you pose the lean and the bars move you, not the sled — and let go before you land.
- **The combo**: everything turned in one flight, and in flights linked by landing and taking the next kicker within a second or so, is one combo: its points × its multiplier, over the nose while it is in hand, banked when you have been back on the snow a moment. A second revolution in one flight is worth more than two single ones; a flip and a 360 in one flight is a **TWIST**. Land it hard (**SKETCHY**) and you are paid the points without the multiplier; land on the nose, get thrown, reset, or come down still in a pose and the combo is lost.

The HUD shows the **SCORE** and the seconds **LEFT** where a race keeps its laps; the finish plate is the score. The record book keeps no tricks scores.

## A free ride

**FREE RIDE** on the front door is the whole map with nobody else on it: no lights, no laps, no checkpoint owed, no clock to beat — the hills, the kickers out in the country, the deep powder. It opens the **start card** first:

- **MAP** — the seed, typed or stepped, and **ANOTHER MAP** to deal a fresh one. Beside it the map itself, north up: the hills shaded, the woods, the groomed loop in orange, the grid (a green triangle) and every **kicker** as an arrow the way it throws — red on the loop, violet out in the country, which is what a free rider goes looking for. **Tap the chart to start anywhere on it** (a spot in a trunk is moved onto the nearest point of the track); **FROM THE GRID** takes that back.
- **DATE** — any day from the first of December to the middle of April: how high the sun climbs and how long the shadows lie. It stands on the map's own date until moved.
- **TIME** — the hour the ride starts at, anywhere from sunrise to sunset on that date at that map's latitude. The sun moves on from there an hour every ten minutes of riding.
- **SNOW** — how deep the powder is, read as how far a sled standing in it sinks: a dusting over a crust at the bottom, a bottomless dump at the top. Deeper is slower going and softer landings.

**NEXT** is the sled card, and **RIDE** there stands the ride up. The HUD keeps the speed, the air clock and the minimap, and in place of the race's place, lap and checkpoint count shows the ride's clock, its **BEST AIR** and the distance **RIDDEN**; the minimap shows the loop without a checkpoint on it. **R** stands you back on the nearest point of the track. The pause card's **START AGAIN** rides the same map from where you started. Everything on the start card is remembered.

At any point, **Escape** (or the pause mark in the top right) holds the race under the pause card: **RESUME** (back to the frame you left), **RESTART RACE**, **SOUND**, **MAIN MENU**. The pause card is the only surface that stops the snow; behind every other card the race keeps running.

## Riding

The whole game is two grounds under one machine. On the **packed track** the skis bite, the tread drives and the sled is quick and sure. In **powder** the sled sinks: at walking pace it wallows with the tread buried to its rails, and as speed builds it climbs up onto the top of the snow and planes — keep the throttle open and you float; stop in it and you dig in. Cutting a corner through the powder is a decision with a price.

- **Turning.** On the track the skis turn you. In powder the rider's weight does: the sled rolls onto the edge of its tread and carves round.
- **Kickers.** Crests on the track (and on hilltops off it) are shaped to throw you. In the air the **lean** pitches the sled; the **throttle** spins the tread up and lifts the nose; the **brake** stops the tread and drops it. Land on the downslope and you keep your speed; land flat past it and the suspension bottoms and costs you.
- **Trees** are solid. A clipped trunk spins you; one met square stops you — and met hard, it stops the sled and not you.
- **Wipeouts.** Hit a trunk hard, land on the nose or roll the sled at speed and the rider comes off, tumbles through the snow, and a couple of seconds later you are stood back on the track at the last checkpoint you took.
- **Dug in.** Sit in deep powder with the belt spinning and it digs itself a hole until the belly is on the snow (**STUCK** on the screen). Ease off the throttle and **rock it** — the lean back and forth and the bars side to side — then drive out. Pinned, it only digs deeper.
- **Stuck or upside down?** **R** stands you back on the track just past the last checkpoint you took. It also happens on its own after a few seconds on your side or going nowhere at full throttle (longer once you have dug in, to give you the time to rock it out).

## Controls

**Keyboard** (`pwa/src/game/settings-input.ts` is the table):

| Key                | Does                                             |
| ------------------ | ------------------------------------------------ |
| W / ↑              | Throttle                                         |
| S / ↓ / Space      | Brake                                            |
| A D / ← →          | Steer                                            |
| E / Shift          | Lean back — in the air, nose up                  |
| Q / Z              | Lean forward — in the air, nose down             |
| F / X              | Hold in the air on a tricks run: a pose          |
| R                  | Back onto the track at the last checkpoint taken |
| B                  | Restart the race from the grid                   |
| C                  | Next camera                                      |
| Escape             | Pause                                            |
| Arrows, Enter, Esc | Walk a card, press a row, go back                |

**Touch:** the lower-left of the screen is the **handlebar** — touch anywhere there and move the thumb: sideways travel steers, vertical travel leans. The lower-right is the **lever** — it is WIDE OPEN the moment your thumb lands; slide UP to ease off the throttle, and further up to brake. The top-right corner carries three presses: pause, reset, camera. On a tricks run a **TRICK** press over the speed is held for a pose.

**Cameras** (C, or the camera press): **hood** and **bars** are bolted to the sled and pitch and roll with it; **chase** (the default), **far** and **high** stand behind on a boom. The game remembers the one you chose.

## Options

**OPTIONS** on the front door, over the same live race, in four groups. **CONTROLS**: **KEYS** opens a page with every action on it — press a row, then the key to put on it (Escape leaves it as it was); a key on two actions says so. On a touchscreen, **LEVER SIDE** swaps the lever and the handlebar, **TRAVEL** shortens or lengthens every thumb's throw, and **INVERT LEAN** makes pushing the bar away the lean back. **ASSIST**: **STEER HOLD** (the arcade's hand keeping the nose on the line the skis ask for) and **AIR LEVEL** (the rider's body keeping the sled level side to side in the air), each FULL, HALF or OFF, and **DAMAGE** (on, a trunk or a hard landing bends a ski or hurts the suspension and the sled rides it for the rest of the race, with an instrument beside the speed; off by default), all from the next race. **SOUND**: the switch, and faders for everything, the engine and the effects. **PICTURE**: a **PRESET** that moves every row at once, then RESOLUTION, DISTANCE, TERRAIN, TRAILS, FOREST, SHADOWS, SPRAY and SMOOTH EDGES one at a time — each applied at once, so it is judged against the race behind the card (SMOOTH EDGES alone waits for the next visit). A first visit picks its own preset by timing the machine (`docs/configuration.md`). The caption at the foot says what the row under the pointer does.

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
