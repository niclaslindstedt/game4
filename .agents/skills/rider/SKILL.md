---
name: rider
description: "Use when working on THE RIDER — the man on the sled: how he is posed on the machine (the hands on the grips, the boots on the running boards, the half-standing crouch a sled is ridden in), how his body answers the engine's readings (the weight hung into a turn, thrown back or forward by the lean, standing taller in the air, a landing folded into the knees), and how he looks from behind at chase range. Owns `pwa/src/game/rider-pose.ts` (the pose as three-free arithmetic: `BODY`, `MOUNTS`, `solveLimb`, `riderPose`) and `rider.ts` (the figure), the rider's cases in `tests/world_render_test.ts`, and the loop: `make world` (orbit, jump, landing), then the built app with `make screenshots`."
---

# The rider

The rider is the one human thing in the frame, and the chase camera looks at
his back for the whole race. He is **posed from the engine's readings**, never
animated by hand: `rider-pose.ts` places every joint in the sled's own body
frame from a `RiderInput`, and `rider.ts` hangs the figure on those points.

**A SLED IS RIDDEN HALF STANDING.** Seated, a rider can only hold on; a
snowmobile ridden hard is ridden up off the seat, knees bent, boots on the
running boards, the weight moved about with the legs — hung off the uphill
side on a sidehill, thrown forward up a climb, back for a landing. The base
pose is that crouch, and every input moves it.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs rider --list`. Load `skill-reflection` at
both ends, `write-code` beside this for any code change, and `sled-design`
when the machine he stands on is what moves.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/rider-pose.ts` | `BODY` (the limb lengths and proportions, m), `MOUNTS` (where the grips, the bars' pivot, the boots and the base hips are fixed to the machine), `solveLimb` (two bones toward a target, bent toward a pole), `gripAt` (a grip at a bar angle), `riderPose(input)` → every joint. Three-free, so the suite reads it |
| `pwa/src/game/rider.ts` | `createRider(style)`: capsules for the limbs (each its own fixed length, only ever turned, never stretched), a torso, a helmet and its visor, in the slot's `RiderStyle` (jacket, pants, helmet, visor) |
| `pwa/src/game/posed-merge.ts` | The posed tree — machine and rider — drawn as ONE mesh, re-laid each frame through each part's matrix; a part hidden with its ancestors (the rider in the cockpit views) collapses to nothing |
| `pwa/src/game/sled-body.ts` | Hangs the rider on the machine; the grips, the bars and the boards he is fixed to are drawn there |
| `engine/game/sled.ts` | Where his MASS actually is: `riderRight`, `riderAft` on `SledState`, lagging the bars and the lean by `TUNING.rider.lag` |
| `tests/world_render_test.ts` | The pose held: hands on the grips, a hang to the right moves him right, a lean back moves him back |

## How he is posed

1. The HIPS go where the engine has put his mass — `riderRight`,
   `riderAft` off `MOUNTS.hips` — so the physics' own lag is the pose's lag.
2. The TORSO pitches with `lean` (+1 back drops the hips toward the seat and
   leans back, −1 throws him forward over the bars) and rolls into the hang.
3. The HANDS are ON THE GRIPS, turned with the bars (`gripAt(side, bars)`),
   and each arm is solved back to its shoulder with the elbow out and down.
   A grip out of reach is reached for along the same line, fully extended —
   an arm is never stretched.
4. The BOOTS stand on the running boards (`MOUNTS.foot`); the knees are
   solved forward and out.
5. In the AIR he stands taller; a fresh LANDING (`landing`, seconds since
   the last) folds the knees and recovers.

Everything he does is a `SledState` field the engine wrote (`riderRight`,
`riderAft`, `lean`, `steer`, `airborne`, `landing`); nothing re-derives
intent from physics deltas.

## The loop

1. `make world SEED=38 ARGS=--views=orbit,far,jump,landing` — round him,
   at range, in the air and coming down. Judge from BEHIND first (that is
   the game's view), then the side for the crouch and the reach.
2. A pose change is a number in `riderPose` or `MOUNTS`; a body change is
   `BODY`; a look change is `rider.ts`'s figure or a `RiderStyle`. One axis,
   re-shoot, look.
3. `npx vitest run tests/world_render_test.ts` — the pose cases.
4. `make build`, then `make screenshots` (a bright seed) and crop the sled at
   3× to judge; at 1280 px he is sixty pixels tall and a pose reads only as
   a silhouette.
5. `make profile`: four riders on the grid, each merged into its machine's
   one draw (`posed-merge.ts`) — that is the invariant, not the triangle
   count.

## Judging him

- **From behind, at sixty pixels, he must read as a man on a machine**: the
  helmet, the shoulders, the jacket against the snow, the arms out to the
  bars. Contrast does the work, not detail — and a rider in white is gone.
- **Hands on the grips, boots on the boards, always.** A hand floating off a
  grip is the first thing a player sees.
- **The body answers the sled.** Turn: he hangs into it. Lean back: he sits
  back and the nose lifts. Air: he stands. Landing: the knees take it, then
  settle. Nothing snaps — every motion is the engine's own lag or a spring.
- **Proportions are `BODY`'s.** Fix a REACH at the mounts or the pose,
  never by lengthening an arm.

## What is not here yet

The rider THROWN — he never leaves the machine; a rollover keeps him on it
and the reset stands them both back up. No crash animation, no second rider,
no body springs driven by the sled's accelerations (the pose follows the
engine's lagged weight and the landing clock only). Each is a subject for
`engine-system` first if the engine has to know about it.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
pose number that fixed a read at chase range, a mount a machine change
broke, a motion that read as a twitch.
