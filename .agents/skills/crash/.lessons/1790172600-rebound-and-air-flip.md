---
title: A wipeout rule read off every `land` or off `overFor` fires on an ordinary overshot kicker — judge the flight's own landing, and a roll only on the snow
date: 2026-09-23
scope: engine/game/crash.ts
concepts: [wipeout, landing, rollover, thresholds]
---

The stadium kicker at 75 km/h lands tail-first 64° nose-up; the slap
throws the sled back up for 0.15 s and it comes down 37° nose-down at
6.9 m/s — a second `land` event that met the nose-in threshold. Gated on
`airTime >= noseAir` that passed, and then the same sled somersaulted
through upside-down IN THE AIR, which `overFor` (world-up, air or not)
counted as a rollover. Neither was a crash: the sled comes down on its
skis. The fixes were `noseAir` and `rolledFor` (over, on the snow). The
bot never met either case, so `make sim` was blind to it — only the ride
lab's `kicker` row showed it, which is why the kicker is in `crash_test`.
