---
title: The bot must be at a kicker's speed a ramp short of the lip — braking on the lip throws a slow sled onto its nose
date: 2026-09-23
scope: engine/sim/bot.ts
concepts: [kickers, braking, nose-in]
---

`speedAllowed` planned each kicker's speed AT the lip, so the bot was still
braking up the ramp; with the skis loaded by the brake and then dropping off
the crest, a slow sled pitched 41° nose-down before it left the snow and the
tricks run wiped out every flight (`tricks_test`'s bot run went to 0 points
after a geometry change moved the CoG 10 cm nearer the belt's front).
`KICKER_RUNUP` (10 m) plans the speed a ramp short of the lip. A geometry
change to `skiForward` / `treadFront` owes that test and `make ride kicker-slow`.
