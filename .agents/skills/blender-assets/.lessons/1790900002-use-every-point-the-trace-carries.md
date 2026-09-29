---
title: Use every point the trace carries, lay what sits on a panel on the cage, give a boolean a rim, and place every part off something the trace does say
date: 2026-09-20
scope: scripts/blender/sled.py
concepts: [modelling, sled, trace, booleans]
---

- **Use every point the trace carries.** The screen is FOUR corners (the
  front edge base → top, the side edge foot → back): lofted off the front
  edge alone, a touring screen came out a flat slab hovering over the bars;
  wrapped from the front edge round to the side edge, its lower edge laid
  on the cowl, it reads as the tall wrapped screen it is. The mirrors and a
  race sled's plates are in the trace too — check `SledLook`'s fields
  against the builder whenever a class looks thin.
- **Lay what sits on a panel ON the cage** (`ring_at`, `cowl_top`): a flat
  box for a number plate cuts through the curved cowl; a patch lofted off
  the cage's own points follows it.
- **A boolean needs a rim.** A hole placed off one edge of a plate goes
  through that edge where the plate is shallow (a touring tunnel is 4 cm
  deep at the tail), and the boolean then drops the whole panel — silently.
  Place holes at mid-depth and skip them where the plate is too shallow.
- **Hang what hangs from what it hangs on.** A traced flap that starts
  below a shallow tunnel's deck floats; carry its top up to the deck.
- **Every part is data-driven or class-proportional.** Where the trace says
  nothing (a bumper's loop, a lever), place it off something it does say
  (the nose, the grip) — so the same builder models all six classes; the
  mountain sled got its bar handle and no screen, the touring machine its
  backrest, grab handles and luggage, with no class-specific code.
