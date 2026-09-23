---
title: A trench is staged against a powder bank, not on a slope — a high-centred sled on a slope slides out of its own hole
date: 2026-09-23
scope: scripts/lib/ride-scenarios.mjs, engine/game/trench.ts
concepts: [trench, staging, ride-lab]
---

On flat powder a sled at full throttle launches past `trench.creep` inside a
second, so it never bogs; on a 20° powder slope it bogs, digs, high-centres
on the belly's chassis points (friction 0.35, under tan 20°) and slides back
down at 1–2 m/s, which clears the trench before the rider can rock anything.
What reproduces a real trench is a sled nosed into the foot of a steep powder
bank (`flatLevel({ packed: 0, grade: 1 })`, placed 3 m short of `slopeFrom`,
heading a little across it): it climbs, falls back and paws at the bank's foot
until it digs in. `stuck` and `stuck-held` in the ride lab are staged that
way; the tests pin the sled's way off it instead (`crash_test.ts`).
