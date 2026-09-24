---
title: A roll term that destabilises on purpose must be off at a crawl and stay up on a straight launch — check both on real terrain, not only the flat strip
date: 2026-09-24
scope: engine/game/sled.ts, engine/game/defs/tuning.ts
concepts: [rollover, deep-snow, balance, ride-lab, measurement]
---

Deep snow's "rides like a bike" is a NEGATIVE roll stiffness (`rider.deepTip`) the rider's weight has to beat. Two failures the flat drag strip hid. (1) A straight launch from rest in a metre went over within 1.5 s: the sequential-impulse chassis resolves the two belly corners in order and hands the sled a one-step asymmetry, which any unstable term amplifies — deepTip 3 fell, 2.5 held; `accel-deep` is the check. (2) A sled stopped on a real meadow crept downhill at 2–3 km/h at idle and the term rolled it over by itself; only `make world ARGS="--views=deep --snow=2.5"` showed it. Hence the pace ramp (`deepTipFrom` / `deepTipFull`). Whenever you add or retune a balance term, check a launch, a parked sled on a 5° slope, and a 10° traverse (`sidehill-deep`, hands off and held).
