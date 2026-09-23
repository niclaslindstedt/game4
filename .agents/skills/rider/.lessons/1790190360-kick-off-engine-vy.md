---
title: Kick the rider's body spring with the ENGINE's change of climb, as a velocity impulse — not an acceleration off the drawn pose
date: 2026-09-23
scope: pwa/src/game/rider-pose.ts, pwa/src/game/sled-body.ts
concepts: [secondary-motion, landing, bump]
---

Frames and engine steps do not line up: a frame with no new step sees no
change and the next sees two. Feeding `(vy − lastVy)` straight into the
spring's RATE is an impulse whose integral is right however the steps fall,
where an acceleration off the interpolated pose is noise. The kick is scaled
(`LEGS.kick` 0.45) because a 6 m/s landing at full share folds the knees
36 cm; clamp the fold and let it spring back.
