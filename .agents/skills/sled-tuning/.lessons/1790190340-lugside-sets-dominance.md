---
title: The groomed-bend lug exponent (lugSide) decides whether the trail sled sweeps the roster
date: 2026-09-23
scope: engine/game/defs/tuning.ts, engine/game/footprint.ts
concepts: [roster, cornering, balance, sim]
---

With the arcade's side grip multiplying every machine's corner, the bot's lap
is mostly corners, so the spread in `cornerGrip` IS the spread in race time:
at `footprint.lugSide` 0.5 the Hare won 9 of 12 roster seeds including mixed
snow; at 0.35 it wins the groomed ones (7) and the Ibex and Stoat take the
rest. Judge a cornering change by `make sim ARGS="--sled all" COUNT=12`'s
wins row, not by the card.
