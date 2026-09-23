---
title: Measure a bend at a governed speed — a fixed throttle in a turn drifts the speed and the radius goes as its square
date: 2026-09-23
scope: scripts/lib/ride-scenarios.mjs
concepts: [ride-lab, turn, measurement]
---

The old `turn` scenario held 0.25 throttle "at 60 km/h" and finished at
77 km/h, so its radius was a figure about the throttle. `hold(st, kmh)` in
`ride-scenarios.mjs` is a proportional lever (brake only past a real
overshoot); every turn scenario rides it, and `turn-in` reads the time to nine
tenths of the settled yaw. Quote a bend's g and radius at a matched,
governed speed or not at all.
