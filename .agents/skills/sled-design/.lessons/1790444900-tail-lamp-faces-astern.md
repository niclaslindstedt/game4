---
title: The traced taillight is a FLANK lamp; what shines astern is the lens across the tail
date: 2026-09-26
scope: pwa/src/game/sled-body.ts, scripts/blender/sled.py
concepts: [lamps, glow, flap, textures]
---

`look.taillight` runs along the tunnel's flank, forward of the tail, and the
traced flap stands taller than it — so anything hung on it (the glow sprite,
the cloud's red) is buried behind the flap from the chase lens. `lampMounts`'
`tail` is the lens across the tunnel's top at its tail (the model's
`taillight_rear`), and its `glow` stands behind the rearmost of the flap.
Judge it with `make screenshots ARGS="--scene go --weather overcast --hour 19"`.
A `THREE.DataTexture` samples NEAREST by default: a sprite built on one needs
`LinearFilter` set, or it draws in squares.
