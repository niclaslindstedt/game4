---
title: Steering that feels dead is usually the ceiling, not the grip — find which term caps the bend before raising a coefficient
date: 2026-09-23
scope: engine/game/sled.ts, engine/game/limits.ts, engine/game/defs/tuning.ts
concepts: [steering, cornering, arcade, yaw-hold, tipping]
---

Every sled settled at ~0.7 g at full lock whatever its skis held. Raising the
ski grip 60 % bought 40 %, because three things capped it in turn: the spring
force pushed along the body's tilted up axis shoved the rolled chassis out of
the bend (fixed: along the snow's normal); the yaw hand's gain was too weak to
bring the tread's slip up to its grip; and the hand's `reach` is
`min(grip, tipLimit)`, so past the static tipping point nothing turns harder.
Instrument the per-probe lateral forces for one step (skis vs tread, and the
hand's torque) and the loads BEFORE touching a coefficient — the saturated
term is the one that caps the bend.
