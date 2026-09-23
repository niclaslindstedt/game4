---
title: A sled's 0–100 is traction-limited — studs, ski share and belt mass move it more than power does
date: 2026-09-23
scope: engine/game/defs/sled.ts, engine/game/footprint.ts
concepts: [acceleration, studs, traction, expectations]
---

The drive is power over belt speed floored at the launch; with ~0.65 of the
weight on a belt at μ≈1, the crossover is grip-limited to well past 100 km/h,
so a 97 kW work sled on 390 kg did 0–100 nearly as fast as a 123 kW one.
Studs at 16 %/hundred made three machines identical at 2.8 s; 8 % keeps them
apart. Power shows in the top end and in powder. When re-deriving
`accel0to100`, read it off `make ride ARGS=--card`, and expect a footprint
change to move it more than an engine change.
