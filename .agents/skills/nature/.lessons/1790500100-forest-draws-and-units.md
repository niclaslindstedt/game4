---
title: A tree mesh's unit x is a crown radius and its unit y a height (≈4× longer), and every variant a map grows is its own draw call
date: 2026-09-24
scope: pwa/src/game/tree-shapes.ts, pwa/src/game/forest.ts, pwa/src/game/settings-video.ts
concepts: [trees, variants, draw-calls, instancing]
---

Tree geometry is built at unit height and unit crown radius, then scaled to
(crown·0.95, height, crown·0.95). A spray that should climb at 45° rises a
tenth of a UNIT of y per crown radius, not one — the first birch built with
"rise 0.2–0.4" came out as a broom of vertical blades. Lean is applied the
same way (`Shape` multiplies by ~4). Judge any new shape on `make trees`
(seen from the rider's head) before `make world`.

Each (kind, variant) in the full band is an InstancedMesh and a draw call, and
again in the casters under FOREST HIGH: ten variants of five kinds took the
race moment from 54 to 121 draws. `FOREST_LOOK[row].variants` (2/4/10, the
most telling first per `VARIANT_ORDER`) is the lever; size each mesh to the
trees that use it (not `trees.length`), or fifty meshes allocate fifty
full-forest instance buffers.
