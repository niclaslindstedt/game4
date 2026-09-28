---
title: A held lean already carries a flip — a stroke carry on the pitch axis over-rotates it; carry only the yaw, whose own torque is too light
date: 2026-09-28
scope: engine/game/strokes.ts, engine/game/defs/tricks.ts, engine/game/flight.ts
concepts: [tricks, strokes, air, wind-up, ride-lab]
---

Spreading a stroke over a wind-up (`flipWindUp`, `spinWindUp`) costs the turn
about 2/ω s of the stroke's rate, and the first cut gave it back with a carry
on BOTH axes while the input was held. The flip over-rotated: the staged
`backflip` (lean held 1.2 s) landed +50° nose-up and harsh instead of −1°
clean, because `air.leanTorque` is already a carry — a held lean took a
snapped flip from 2.7 to 3.7 rad/s on its own. The bars' `air.steerTorque`
(90 N·m against 60 N·m·s of damping) cannot hold a 360 at all, so the carry
belongs on the yaw only. Before adding a torque to a trick, trace the rate
over time (`wx`, `wy` every 50 ms off `placeRun`) and read `make ride`'s
`backflip`, `frontflip` and `spin` land pitch — the landing moves first.
