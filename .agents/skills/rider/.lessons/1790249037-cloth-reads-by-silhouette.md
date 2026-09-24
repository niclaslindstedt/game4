---
title: A garment reads by its SILHOUETTE — coarse, boxy sections that bag and pad, a few big creases laid on rings dense enough to carry them
date: 2026-09-24
scope: pwa/src/game/rider-cloth.ts, pwa/src/game/rider.ts
concepts: [clothing, polygons, creases, silhouette]
---

Round capsules read as a mannequin however many sides they have; eight boxy
sides that balloon between the joints, pad the knee and flare over the boot
read as a jacket and pants. Detail spent on roundness is wasted — the owner
asked for coarse limbs that look like clothes. A crease finer than a third
of the ring spacing aliases into a saw along the silhouette (it did at the
hem and the boot tops), so lay rings by the fold (`gatherStep`) rather than
uniformly: fine at a joint, coarse between — 11.5k triangles a rider came
back to ~5.9k with the same look (the capsule figure was 1.7k). And give a limb a ROLL (`hang` toward its
bend) before authoring anything one-sided on it: `setFromUnitVectors` turns
a bone by whatever twist is shortest, so "the front of the knee" means
nothing until the frame is pinned.
