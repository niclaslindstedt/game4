---
type: Changed
title: Races draw up to twice as fast, with the same picture
---

The sleds and their riders are now posed on the graphics card instead of the processor. Every machine is still drawn exactly as before, but a frame no longer re-lays and re-sends a hundred and fifty thousand vertices per sled. On a desktop the benchmark race's frame went from 7.5 ms to 3.8 ms at the default picture. The snow on the ground also skips the work it cannot show (the far snow's glitter, the clods off the berm, the sun's shadow past its reach), so the graphics card's share of a frame is about a tenth smaller at the HIGH picture. DEVELOPER ▸ BENCHMARK's report now shows what the graphics card spent on each pass, and `make bench ARGS="--gpu --ab"` shows what each part of the world costs.
