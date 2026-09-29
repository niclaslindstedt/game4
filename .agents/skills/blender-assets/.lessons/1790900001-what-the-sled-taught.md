---
title: A sled's panels are a cage under a subdivision surface with creases, its paint follows the cage's bands, and what must stand proud is a volume
date: 2026-09-20
scope: scripts/blender/sled.py
concepts: [modelling, sled, cage, creases, silhouette]
---

- **Panels are a CAGE under a subdivision surface, with creases.** A
  cross-section of a dozen keyed points (belly, lower corner, flank,
  SHOULDER, upper flank, brow, crown) lofted through ~18 stations,
  subdivided, with the shoulder creased hard (`crease_edge` 1.0), the brow
  softer and the crown ridge softer still. That is what makes a cowl read
  as moulded panels with a character line rather than a pod or a capsule —
  and the cage is the low-poly base the game budget subdivides once.
- **Paint follows the cage's bands**, assigned per cage FACE (below the
  shoulder black, the band above it a stripe, the rest paint), so every
  colour edge runs along a crease after subdivision. Colouring a fine mesh
  face by face by its centroid stair-steps; a shader mask is clean in
  Cycles but does not survive into glTF.
- **What must stand proud is a VOLUME.** Lamps shrinkwrapped onto the cowl
  read as sunk into it at any offset; a housing that rises out of the
  shoulder and grows toward the nose, ending in a forward lens, pops.
- **Read the class off the references, not off memory.** What moved the
  sled from "vintage" to "current": the belly raised over the front
  suspension (the trace already had the cutout — do not smooth it away),
  a V-shaped nose in plan with a ridge, the lamps high on the shoulders
  just ahead of the screen, angular ski loops reaching back along the ski.
