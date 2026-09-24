---
title: A drag keyed to the grip's sideways force brakes a straight sled — the side force chatters on a kicker face; key it to the rate asked
date: 2026-09-24
scope: engine/game/sled.ts, engine/game/defs/tuning.ts
concepts: [steering, scrub, kicker, measurement, arcade]
---

The first cut of the turn scrub summed `|across|` over the probes. As the
skis met the stadium kicker's face the side grip flipped sign every step at
±25–40 kN, the net cancelled but the magnitude did not, and the drag took
6 m/s off a sled riding dead straight — the Beaver then landed 48° nose-up
and rolled (`flight_test`'s "a landing sticks"). Summing per-step
magnitudes of a chattering force is never a measure of a turn. The scrub now
reads the yaw hand's `asked` rate × the way (smooth, rate-limited, zero going
straight), on the packed share only. Print the per-step force across the
lip before trusting any term built on the grip's own outputs.
