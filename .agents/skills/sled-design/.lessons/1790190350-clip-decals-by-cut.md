---
title: A two-tone decal is the traced outline CUT by a line, not a polygon laid over it
date: 2026-09-23
scope: pwa/src/game/sled-body.ts, pwa/src/game/sled-liveries.ts
concepts: [livery, decals, clipping]
---

A `split` pattern stated as a free polygon poked past the traced cowl as a
floating block (the cowl is concave, so Sutherland–Hodgman cannot clip a
decal against it). The split is laid as the painted half of the outline cut
by a half-plane (`cutBy`), which follows the trace exactly; free decals
(stripes, chevrons) stay inside v 0..0.8 of the flank, where every traced
cowl is convex enough. Judge a pattern on `make sled ARGS=--sheet=liveries`.
