---
title: A drop's landing is judged by riding it — an apron barely softens a 5–10 m face
date: 2026-09-24
scope: engine/mapgen/cliffs.ts, TUNING.air
concepts: [cliffs, landing, harsh, measurement]
---

Placing a sled on each cliff's shelf at 40 and 70 km/h (`placeRun`, throttle
open) showed every cliff throws 1–2 s of air, but nearly every landing is
over `air.harshSpeed` (6 m/s): the sled overflies any apron short enough to
fit, and a soft landing would need a ski-jump-sized slope. The apron's real
job was removing nose-in wipeouts at low speed (2 → 0 of 42). Measure the
flight with a scratch rider before tuning a profile by eye.
