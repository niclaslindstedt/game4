---
title: A landing that bounces is the rebound damping and the bump stop handing the stroke back — count the `land` events per jump, not the peak
date: 2026-09-24
scope: engine/game/sled.ts, engine/game/defs/sled.ts, engine/game/flight.ts
concepts: [landing, suspension, damping, rebound, bump-stop, air, gravity]
---

The ride lab's `kicker` row read fine (one impact, one cost) while every
machine was thrown back off the snow for 0.4 s after it — a second `air` and
`land` for one jump. The tell is per-step: CoG heave over its rest height,
`vy` after the touch, how long no probe touches. Two causes, both needed:
rebound at ζ ≈ 0.5 per axle (want ≈ 0.75; print ζ per axle off `skiShare`
before touching a number), and a bump stop returning its whole stored
energy (make it hysteretic, `STOP_RELEASE`). Heavier FLIGHT gravity is a
separate dial (`RunRules.airGravity`) — it shortens every flight, so the
tricks run keeps the real g, and the bot's ballistics must read the same
number (`flightGravity`) or it misplans every kicker.
