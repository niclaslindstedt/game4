// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every sled
// (the machine's own numbers live in `defs/sled.ts`). Grouped by subject:
// the clock, the air, the SNOW (how far it lets a sled sink and what it
// costs to push through it), GRIP, the TREAD and its drive, the STEERING,
// the RIDER, the AIR, the HULL contacts, the trees, the course and the
// reset. Every number carries its unit; every model it feeds names its
// source at the function that implements it. Tweak here, verify with
// `npm run ride` and `npm run sim`; the render layer never reads these.

/** The clock the whole engine runs on. Named out here so the timestep is
 * derived from it rather than restated. */
const PHYSICS_HZ = 120;

export const TUNING = {
  /** HOW OFTEN THE WORLD IS SOLVED, steps a second. The suspension is a
   * set of penalty springs holding three hundred kilos on centimetres of
   * sag, and the bump stops are stiffer again; 120 Hz follows both. The
   * bot decides on every step too. */
  physicsHz: PHYSICS_HZ,
  /** ...and the same number as the timestep, s. Derived, never authored. */
  dt: 1 / PHYSICS_HZ,

  /** Standard gravity, m/s². */
  g: 9.81,

  /** THE AIR: density at −10 °C at a few hundred metres up, kg/m³ (ISA). */
  airDensity: 1.3,

  /** THE SNOW — the sled's water. Powder lets a machine SINK, and how far
   * is a function of speed exactly as a planing hull's draft is: at rest the
   * tread is buried to the tunnel, and with speed the pressure under it
   * climbs and it floats up onto the top. `snow.ts` owns the model. */
  snow: {
    /** How deep a stationary sled sinks into untouched powder, m — the
     * tread's footprint on 30–40 cm of fresh snow buries it to the rails. */
    powderSink: 0.26,
    /** ...and into a groomed track, m: a few centimetres of cut. */
    packedSink: 0.02,
    /** THE PLANING SPEED, m/s: sink falls as exp(−(v / planeSpeed)²), so
     * at this speed a sled carries a third of its rest sink and by
     * 40 km/h it rides a few centimetres into the powder. */
    planeSpeed: 8,
    /** How quickly the support under a probe follows the sink the speed
     * asks for, s (a sled slowing in powder settles, it does not drop). */
    sinkLag: 0.25,
    /** The skis sink less than the tread for the load they carry, as a
     * share of its sink: a wider, lighter footprint. */
    skiSink: 0.7,
    /** ROLLING RESISTANCE, as a share of the load on each probe: on the
     * groomed surface, and in powder. */
    crrPacked: 0.03,
    crrPowder: 0.07,
    /** THE PLOUGH: the snow a sunk footprint shoves aside, N per metre of
     * footprint width per metre of sink per (m/s)² — the bow wave of a
     * displacement hull, and why a bogged sled wants momentum. */
    plough: 80,
    /** POWDER DRAG: what compacting fresh snow costs at speed, as a share
     * of the probe's load per m/s — gone on packed snow. */
    powderDrag: 0.008,
  },

  /** GRIP — the friction coefficients between the machine and the snow,
   * each a peak reached over its reference slip speed (a `tanh` curve,
   * which is how a lugged belt or a carbide keel lets go: progressively). */
  grip: {
    /** The tread driving along its length: studded lugs on groomed snow,
     * and paddling in powder. */
    treadPacked: 1.0,
    treadPowder: 0.6,
    /** ...and holding sideways. */
    treadSidePacked: 0.7,
    treadSidePowder: 0.45,
    /** The skis holding sideways: the carbide keel on a groomed track is
     * what a sled turns on, and in powder the ski only pushes snow. */
    skiPacked: 1.2,
    skiPowder: 0.45,
    /** Slip speed at which the drive grip is 76 % developed, m/s, and the
     * same for the sideways grip. */
    slipRef: 1.4,
    sideRef: 0.5,
  },

  /** THE TREAD'S DRIVE — the belt between the engine and the snow. */
  tread: {
    /** The belt, the drivers and the driven clutch reflected onto the belt
     * as a mass, kg: what the engine has to spin up before it moves the
     * sled, and what spins free in the air. */
    beltMass: 22,
    /** Internal losses: the slide rails, the idler wheels and the belt's
     * own flexing, N per (m/s)² of belt speed — the largest of a sled's
     * drags at speed, and why a sled at full power tops out at the speed it
     * does rather than at the gearing's. */
    lossQuad: 1.1,
    /** ...and a linear part, N per m/s. */
    lossLin: 8,
    /** Engine braking with the throttle shut, N per m/s of belt speed while
     * the driven clutch is still engaged. */
    engineBrake: 45,
    /** The throttle's lag toward the lever, 1/s. */
    throttleRate: 8,
    /** The engine speed's lag toward what the CVT holds it at, 1/s. */
    rpmRate: 9,
    /** The belt speed the drive force is divided by at the least, m/s — the
     * clutch's slip at a standstill, which is where the power-over-speed
     * force would otherwise run away. */
    launchFloor: 2.5,
  },

  /** STEERING — the skis. */
  steer: {
    /** How the lock falls with speed: full at a standstill, halved by
     * `fadeSpeed` m/s, as a rider's own arms do on a fast sled. */
    fadeSpeed: 17,
    /** How fast the skis can be swung, rad/s. */
    rate: 2.6,
  },

  /** THE RIDER — the man on the saddle is a quarter of the moving mass,
   * and moving him is how a sled is ridden. */
  rider: {
    /** The body's lag behind the bars and the lean, s. */
    lag: 0.18,
    /** How far fore and aft the lean moves him, m. */
    aftReach: 0.35,
    /** THE LEAN INTO A TURN: the roll the chassis settles at with the bars
     * full over, rad — on packed snow, and in powder, where it is the
     * whole of how a sled turns. */
    rollPacked: 0.08,
    rollPowder: 0.4,
    /** The righting the rider and the suspension together hold that roll
     * with, N·m per rad, the damping on the roll rate, N·m·s, and the most
     * it can ever be, N·m — a load past this rolls the sled over. */
    rollStiff: 5000,
    rollDamp: 420,
    rollMax: 2600,
    /** THE CARVE: in powder a sled rolled over onto its tread's edge turns
     * toward the low side, as a share of the tread's load per radian of
     * roll. It needs way on, reached by `carveSpeed` m/s. */
    carve: 1.4,
    carveSpeed: 6,
  },

  /** THE AIR — what the rider can still do with the machine once the snow
   * has let go of it (`flight.ts`). */
  air: {
    /** The lean's pitch authority, N·m at full lean (back = nose up). */
    leanTorque: 520,
    /** THE GYRO: the throttle spinning the tread up lifts the nose, and
     * the brake stopping it drops the nose — the reaction of a 20-kilo belt
     * on its drivers, N·m at full lever. */
    throttleTorque: 80,
    brakeTorque: 420,
    /** The bars in the air: a little yaw, N·m at full lock. */
    steerTorque: 90,
    /** Rotational damping in the air, N·m·s per rad/s about each axis. */
    damping: 60,
    /** How long off the snow before it counts as air, s — anything shorter
     * is a sled skipping over a bump. */
    counts: 0.15,
    /** A LANDING: the speed INTO the slope, m/s, past which the suspension
     * cannot take it all and the sled pays for it — a share of its way per
     * m/s over, up to `harshMax`. */
    harshSpeed: 6,
    harshLoss: 0.05,
    harshMax: 0.35,
  },

  /** THE HULL: points on the chassis, the bumpers and the rider's helmet
   * that meet the snow when the suspension is not what is touching it — a
   * belly on a crest, a sled on its side, one upside down. */
  hull: {
    /** Penalty stiffness, N/m, and damping, N·s/m, per point. */
    rate: 30000,
    damp: 2600,
    /** Friction of a chassis sliding on snow. */
    friction: 0.35,
  },

  /** THE TREES — trunks are cylinders (`collision.ts`). */
  trees: {
    /** The sled's plan footprint as three circles down its length, of this
     * radius, m. */
    bodyRadius: 0.55,
    /** How much of the closing speed comes back, and how much of the speed
     * ALONG the trunk a glancing blow scrubs off. */
    restitution: 0.15,
    scrub: 0.35,
    /** A hit is reported at this closing speed, m/s, at most once per
     * `cooldown` s. */
    hitSpeed: 1.5,
    cooldown: 0.6,
    /** Spatial hash cell for the trunks, m. */
    cell: 12,
  },

  /** THE MAP'S EDGE: the rider is turned back this far inside it, m, by a
   * push that grows over `soft` m. */
  bounds: { margin: 6, soft: 20, push: 12 },

  /** THE COURSE. */
  course: {
    /** Metres either side of a checkpoint's visible width that still count
     * — the benefit of the doubt at gate range. */
    grace: 2,
    /** A reset stands the sled this far PAST the last checkpoint it took,
     * m (or this far short of the start line before it has taken one). */
    resetAhead: 3,
  },

  /** THE AUTOMATIC RESET. */
  reset: {
    /** Seconds on its side or back before the rider is put back. A sled
     * counts as over when its up axis is below this share of vertical. */
    overFor: 3,
    overUp: 0.25,
    /** Seconds held at full throttle going nowhere before he is put back,
     * and what "nowhere" is, m/s. */
    stuckFor: 3,
    stuckSpeed: 0.8,
  },
} as const;
