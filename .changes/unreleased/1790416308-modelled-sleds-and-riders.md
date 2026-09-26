---
type: Added
title: Modelled sleds and riders
---

The sleds and their rider are now drawn from models made in Blender off the game's own numbers — every machine in its livery's colours, every rider in his grid slot's kit, posed by the same physics and body as before. The code-built machines and rider are one switch away: `VITE_MODEL_SLEDS=0` and `VITE_MODEL_RIDERS=0`, or `make ci-models MODELS=off` for every CI build.
