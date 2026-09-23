// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE, and the rules a run is played by. This slice has ONE way onto
// the snow — a race against a field over the map's loop — so a mode is not
// a menu here; but the rules are still a plain record on the state
// (`GameState.rules`) read by every system that answers to one, and nothing
// branches on anything else. `OPEN_RULES` is what a measurement rides: no
// lights and nobody else out there, so a simulated run's digest carries the
// rider and nothing in front of him.

export type RunRules = {
  /** How many OTHER riders start beside the player (`rivals.ts`). */
  rivals: number;
  /** Laps to the flag. */
  laps: number;
  /** Seconds the lights hold the field before the clock starts; 0 is no
   * lights at all, and the run is racing from its first step. */
  countdown: number;
  /** Whether one sled can lean on another (`rivals.ts`'s `clipRiders`). */
  contact: boolean;
};

/** THE RACE'S NUMBERS. */
export const RACE = {
  /** Three rivals: four on the grid with the player. */
  rivals: 3,
  /** THE LIGHTS, s — three, a second each, then GO. */
  countdown: 3,
  /** The throttle each rival's bot is allowed, dealt off the run's stream
   * once at the grid: what tells one rival from the next. */
  paceBand: { min: 0.88, max: 1 },
  /** HOW ONE SLED LEANS ON ANOTHER: each is two circles down its length of
   * `radius` m, `offset` m ahead and behind the CoG; the share of the
   * closing speed that comes back; and the speed at which the player's own
   * contact is reported, m/s, at most once per `cooldown` s. */
  bump: { radius: 0.6, offset: 0.8, restitution: 0.3, speed: 1.5, cooldown: 0.5 },
} as const;

/** The race as a rider is dealt it: the field, the lights, contact on. The
 * laps are the level's own and are filled in by `createGame`. */
export function raceRules(laps: number): RunRules {
  return { rivals: RACE.rivals, laps, countdown: RACE.countdown, contact: true };
}

/** What a measurement rides: the level's laps, no lights, nobody else. */
export function openRules(laps: number): RunRules {
  return { rivals: 0, laps, countdown: 0, contact: true };
}
