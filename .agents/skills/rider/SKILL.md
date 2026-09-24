---
name: rider
description: "Use when working on THE RIDER — the man on the sled: how he is posed on the machine (the hands on the grips, the boots on the running boards, the half-standing crouch a sled is ridden in), how his body answers the engine's readings (the weight hung into a turn, thrown back or forward by the lean, standing taller in the air, a landing folded into the knees), and how he looks from behind at chase range. Owns `pwa/src/game/rider-pose.ts` (the pose as three-free arithmetic: `BODY`, `MOUNTS`, `solveLimb`, `riderPose`, and the body on its legs — `createRiderSpring` / `stepRiderSpring`), `rider.ts` (the figure in his kit) and `rider-cloth.ts` (the cloth he is built of: the shaped sections, their creases and pads), the rider's cases in `tests/world_render_test.ts` and `tests/rider_test.ts`, and the loop: `make sled ARGS=--sheet=rider` (close up), `--sheet=poses` and `--sheet=landing`, `make world` (orbit, jump, landing), then the built app with `make screenshots`."
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

**HIS BODY IS A MASS ON HIS LEGS** (`RiderSpring`, the view's, stepped with
the frame's `dt` in `sled-body.ts`): a spring-damper in the machine's
vertical (about 2.3 Hz, a little under half critical), kicked by every change
in the machine's own climb (`SledState.vy`), so a landing that stops the sled
dead leaves the body still coming down — the knees fold up to 24 cm and spring
back — and the chatter of a rough groomer is a jiggle. Beside it the STAND,
eased at 5 /s: sat at a crawl, half up on the move (0.62), stood tall in the
air. **HUNG OFF** into a turn his hips go past the seat (`HANG` × the engine's
`riderRight`) and his upper body rolls in (`HANG_ROLL`), the head held nearer
level, the inside knee thrown out over its board, the shoulders turned a
little with the bars and the head looking into the turn.

**HE IS A MAN IN CLOTHES, NOT A STACK OF CAPSULES.** Dressed after
photographs of sleds ridden from behind: a big helmet sat down on a tall
collar (no neck showing), built as a model of its own (`rider-helmet.ts`)
and MEASURED off a photograph of a real motocross helmet: a HOLLOW shell
whose reach from the head's middle is three measured profiles (ahead, behind,
to the side) — flat at the eyes, the chin bar a long jaw reaching 21 cm
forward in line with the rim, the peak riding the crown level to 18.5 cm —
the eye port cut out of it with a dark liner and a rim, over a HEAD whose
face (the kit's `skin`) shows in the port, the goggles ON his eyes filling
the port nearly flush and their strap round the outside of the shell's back;
worn tipped nose-down (`HELMET_TILT`) so the port looks level; a wind jacket that is one boxy
mass from the hem to the shoulders — the shoulders BUILT INTO it, never a
ball on a stick — under a contrasting yoke; baggy sleeves bunched into flared
gauntlets; insulated pants round a real seat (two lobes and a cleft), with
knee pads and gaiters over big boots (`RiderStyle`: jacket, accent, pants,
helmet, peak, visor). Every part is CLOTH (`rider-cloth.ts`): coarse, boxy
shaped sections (eight sides a limb) whose silhouette carries the garment —
the bagging, the pads, a few big creases in the crook of each joint — rather
than fine round tubes. Each limb is turned about its bone so its +z faces
where the joint bends, so a knee pad is on the knee. The whole figure is carried by the traced grip's
distance from `MOUNTS.grip` (`sled-body.ts`), so every machine's rider sits on
its own seat.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs rider --list`. Load `skill-reflection` at
both ends, `write-code` beside this for any code change, and `sled-design`
when the machine he stands on is what moves.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/rider-pose.ts` | `BODY` (the limb lengths and proportions, m), `MOUNTS` (where the grips, the bars' pivot, the boots and the base hips are fixed to the machine), `solveLimb` (two bones toward a target, bent toward a pole), `gripAt` (a grip at a bar angle), `riderPose(input)` → every joint. Three-free, so the suite reads it |
| `pwa/src/game/rider.ts` | `createRider(style)`: the figure in the slot's `RiderStyle` — each limb a fixed shape hung from its joint and turned to face its bend (only ever turned, never stretched), the torso in its own frame, the seat, the helmet |
| `pwa/src/game/rider-helmet.ts` | The head and his helmet, in the head's frame: `helmetShell` (the outer skin laid on an around-and-up grid with the port's cells left open, the liner, the rim along every open edge), `buildHelmet` (the head and nose, the goggles on the face, the strap, the stripe, the chin bar, the peak) |
| `pwa/src/game/rider-cloth.ts` | What he is built of: `shaped` (rings of a rounded box along a line, smoothed and folded, rings laid only as densely as a fold needs), `cloth` (a limb's creases and pads), `torsoFold` (the jacket gathered, draped, the blades under it). A crease wants three rings a ridge or it breaks into a saw |
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

1. `make sled ARGS=--sheet=rider` — him CLOSE UP in the poses that read
   most, from behind at the chase camera's height, the rear three-quarter,
   the side and the front three-quarter (`--slot=n` another kit). Judge the
   clothing here; a dark kit hides its folds, so light the pants in a
   scratch copy of the style to see them, and never commit it. The FACE
   has its own sheet, `make sled ARGS=--sheet=head`: the helmet alone in
   every kit from the front, three-quarters, the side, the rear
   three-quarter, the back and the chase camera's height, and a PROFILE on
   a centimetre grid centred on the head's middle. A helmet change starts
   from a PHOTOGRAPH of a real one (a freely licensed one, kept out of the
   tree): grid it, scale it to a known length, read the numbers off it, and
   lay the profile beside it at the same scale.
2. `make world SEED=38 ARGS=--views=orbit,far,jump,landing` — round him,
   at range, in the air and coming down. Judge from BEHIND first (that is
   the game's view), then the side for the crouch and the reach.
3. A pose change is a number in `riderPose` or `MOUNTS`; a body change is
   `BODY`; a look change is `rider.ts`'s figure or a `RiderStyle`. One axis,
   re-shoot, look.
4. `npx vitest run tests/world_render_test.ts` — the pose cases.
5. `make build`, then `make screenshots` (a bright seed) and crop the sled at
   3× to judge; at 1280 px he is sixty pixels tall and a pose reads only as
   a silhouette.
6. `make profile`: four riders on the grid, each merged into its machine's
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
