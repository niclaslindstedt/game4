// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public entry point for the game engine. The engine is framework-free and
// renderer-free: the browser app under `pwa/` consumes this module via the
// `@engine` alias, drives `step()` from its render loop at a fixed timestep,
// and reads the returned state to draw. The headless simulator and the tests
// consume the very same surface. See docs/architecture.md.

export { engineVersion } from "./version.ts";
export {
  status,
  info,
  warn,
  error,
  header,
  debug,
  setOutputSink,
  setDebugEnabled,
  recentLogs,
  type OutputLevel,
  type OutputSink,
} from "./output.ts";

// The generic pool the app and the tools reach for.
export {
  createHeightfield,
  fillField,
  sampleField,
  sampleFieldGradient,
  fieldGradient,
  type Heightfield,
} from "./lib/heightfield.ts";
export { createRng, type Rng } from "./lib/prng.ts";
export {
  fromEuler,
  toEuler,
  rotate,
  unrotate,
  multiply,
  normalize,
  identity,
  type Quat,
} from "./lib/quat.ts";
export { angleDiff, clamp, lerp, TAU } from "./lib/math.ts";
export { sunAt, SOUTH, type SunPlace } from "./lib/solar.ts";

// THE WORLD (engine/mapgen/): the generator, the Level contract, the track
// queries.
export * from "./mapgen/index.ts";

// The run.
export { createGame, rulesFor, step, FIELD_SIZE, type CreateGameOptions } from "./game/step.ts";
export { RACE, openRules, raceRules, type RunRules } from "./game/defs/modes.ts";
export { SLED, inertiaOf, totalMass, type SledSpec, type SuspensionSpec } from "./game/defs/sled.ts";
export { TUNING } from "./game/defs/tuning.ts";
export {
  NEUTRAL_INPUT,
  type CraftState,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Progress,
  type Rival,
  type SledInput,
  type SledState,
  type SnowContact,
} from "./game/state.ts";
export { freshSled, skiLockAt, derive } from "./game/sled.ts";
export { probesOf, hullOf, skiShare, type Probe, type HullPoint } from "./game/suspension.ts";
export { sinkTarget, snowDrag, powderFloor, gripAt, type Grip } from "./game/snow.ts";
export { powerShare, driveForce, maxDriveForce, rpmAtTop } from "./game/traction.ts";
export { landingLoss } from "./game/flight.ts";
export {
  bearingToNext,
  crossedCheckpoint,
  crossedLine,
  crossingsToFinish,
  freshProgress,
  resetPose,
  resetSled,
  standSled,
} from "./game/course.ts";
export { collideTrees, keepInBounds, treesNear } from "./game/collision.ts";
export {
  clipRiders,
  createRivals,
  fieldOrder,
  gridSlot,
  raceProgress,
  racePlace,
  stepRivals,
} from "./game/rivals.ts";
export { stepRun } from "./game/run.ts";
export { placeRun, type RunMoment } from "./game/place.ts";
export { SUN_SECONDS_PER_HOUR, sunAtRun, sunHourAt } from "./game/clock.ts";
export {
  brakeDecel,
  cornerGrip,
  lockAt,
  maxRpm,
  topSpeedOf,
  treadCeiling,
} from "./game/limits.ts";

// The bot rider and the headless simulator.
export { botInput, RIDER_BOT, type BotProfile } from "./sim/bot.ts";
export { simulateRun, SIM_SECONDS, type RunReport, type SimOptions } from "./sim/simulate.ts";
