// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE AND THE STROKES — the block of `TUNING` that answers to
// `tricks.ts` (what the air, the ground a flight covered, the flips, the
// spins and the rider's poses are worth, and the combo they ride on) and to
// `strokes.ts` (what one stroke on the lean or the bars turns the sled by,
// and out of what budget). It lives beside `tuning.ts` and is folded in as
// `TUNING.tricks`, which is how the whole repo spells it; nothing reads this
// module directly.
//
// Every number in here is an ARCADE DIAL, with one exception that says so
// where it stands (`lengthKnee`, the metres an ordinary kicker carries a
// sled, which is a measurement because it is what ties the two halves of a
// jump together). What the rest are chosen against is the LADDER they make
// between one flight and the next, and the doc comment below is that
// ladder.

/** THE SCORE (`tricks.ts`) and THE STROKES (`strokes.ts`). Read the score's
 * dials together with the runs they buy — every jump quoted at the reference
 * speed `lengthKnee / airKnee`, where its seconds and its metres are worth
 * the same and its base is twice what the clock alone would pay —
 *
 *   a 1 s jump                         108 × 1  =    108
 *   a 2 s jump                         371 × 1  =    371
 *   a 2 s jump with a backflip         671 × 3  =  2 013
 *   a 2 s jump with a 360              671 × 3  =  2 013
 *   a 2 s jump with a can-can          521 × 3  =  1 563
 *   a 2 s jump, a backflip AND a 360 1 271 × 5  =  6 355
 *   a 3 s double backflip            1 631 × 5  =  8 155
 *
 * — the shape the whole thing is for: a rider who goes for the hard one off
 * the same kicker is paid several times over, the two axes are worth the
 * same so that CHAINING them beats repeating either, and a pose is worth a
 * little less than a revolution because the sled never turns over for it.
 * A jump with nothing done in it multiplies nothing: the air's own rung is
 * only ever sold beside a trick. */
export const TRICKS = {
  /** What a second of air is worth one `airKnee` into a flight, points/s;
   * the rate rises as `log2(1 + t/airKnee)` from there, so a flight's purse
   * grows rather faster than the flight does (`airPointsPerSecond`). */
  airRate: 100,
  /** The flight, s, the rate is quoted at — one second, the shortest jump a
   * rider reads as a jump rather than a bump. */
  airKnee: 1,
  /** HOW FAR THE FLIGHT CARRIED HIM, m, the length curve is quoted at —
   * `airKnee`'s twin on the other axis of the same jump, and the one number
   * the by-the-metre half is drawn from (`lengthPointsPerMetre` states the
   * rate off it, so there is no `lengthRate` to drift out of step with
   * `airRate`). It is a SPEED in disguise: the metres an ordinary kicker
   * carries a sled in the air's own knee. Measured with the bot riding a
   * lap of the trick field (R20) on four seeds on every machine of the
   * roster — 204 flights of more than half a second — the machines between
   * 16.2 m/s (the trail sled) and 19.8 (the cross), 17.5 across them. */
  lengthKnee: 17.5,
  /** What the FIRST revolution of a flight adds to the combo's base,
   * points; the Nth adds N times it, alongside N steps of multiplier — so a
   * double is ×4 and not ×3, because a double backflip is a much harder
   * trick that happens to be measured in revolutions. */
  flipPoints: 300,
  /** ...and a revolution about the sled's own UP axis — the 360 — on the
   * same ladder, and the same figure, so the two are worth CHAINING rather
   * than repeating. The axes are counted apart: a flip with a spin in it is
   * two first revolutions. */
  spinPoints: 300,
  /** THE TWIST — a flip and a 360 in the SAME flight, credited as a third
   * element beside the two revolutions themselves: this much base and one
   * step. What it prices is the combination; the turns are already paid. */
  twistPoints: 300,
  /** A RIDER'S POSE held in the air (`TrickPose`): what it adds to the base
   * once it has been held `poseHold` s, beside one step of multiplier. Each
   * pose is bought once a flight. */
  posePoints: 150,
  poseHold: 0.35,
  /** THE LANDING FINISHES THE TURN: a revolution this short of whole at
   * the touchdown, rad, is counted — the skis meeting the slope rotate the
   * sled the last of the way, and a rider who came round to 330° and rode
   * it away has turned a flip. Short of it, and he has not; nose-first past
   * it is `crash.ts`'s. */
  landSlack: 0.6,
  /** How long the rider has on the snow, s, to leave the next lip before
   * the combo closes and banks. */
  linkWindow: 1.2,
  /** THE AIR ITSELF AS AN ELEMENT: how long a flight has to last, s, for
   * the air to buy a step of multiplier — credited only once a trick has
   * landed beside it, and only once per combo. */
  airElement: 0.5,

  /** ── THE STROKES (`strokes.ts`) ─────────────────────────────────────
   * THE GATES: how far toward the top of its axis an input has to be
   * carried for it to be a stroke rather than trim — the lean's (both
   * ways: back is the backflip, forward the front flip) and the bars'.
   * Below them the lean and the bars are the ordinary air control of
   * `flight.ts`. */
  flipGate: 0.8,
  spinGate: 0.85,
  /** WHAT ONE STROKE IS WORTH, N·m·s of angular impulse about the pitch
   * axis (the lean, and the gyro of the throttle behind it) and about the
   * up axis (the bars thrown over): divided by the sled's own inertia, so a
   * heavier machine turns less for the same throw. About 2.6 rad/s of pitch
   * and 4.1 of yaw on the crossover. */
  flip: 800,
  spin: 1250,
  /** ...and the most a FLIGHT's strokes may add up to, rad/s on each axis:
   * the budget a rider taps out of. Enough for a double off the big lips
   * and not a triple. */
  flipCeiling: 6.5,
  spinCeiling: 8,
  /** A flight a stroke may be thrown in: one that LEFT the snow climbing at
   * least this fast, m/s, and has been up `air.counts` — a sled dropping off
   * a crest is not a launch. */
  launch: 0.5,
} as const;
