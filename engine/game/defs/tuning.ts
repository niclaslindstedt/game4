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

  /** THE FOOTPRINT — how much each machine's own tread is worth against the
   * reference's (`footprint.ts`; the crossover reads 1 on every one). */
  footprint: {
    /** The rest sink goes as the ground pressure to this power: a sink is
     * the snow compacted until it carries the load, and fresh snow stiffens
     * as it packs, so halving the pressure takes off less than half. */
    floatExp: 0.8,
    /** The powder drive goes as the lug height to this power — a paddle
     * twice as tall moves about half again the snow. */
    lugPowder: 0.35,
    /** The groomer's sideways hold goes as the INVERSE lug height to this
     * power: a tall lug folds over under a sideways load. */
    lugSide: 0.5,
    /** The belt's own losses go as the lug height to this power, beside
     * its length — a tall paddle is more rubber flexed round every idler. */
    lugLoss: 0.8,
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
    treadSidePacked: 1.0,
    treadSidePowder: 0.45,
    /** The skis holding sideways: the carbide keel on a groomed track is
     * what a sled turns on, and in powder the ski only pushes snow. */
    skiPacked: 0.95,
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
     * own flexing, N per (m/s)² of belt speed, on the reference machine's
     * belt (`footprint.ts` scales it for another's) — with the air, what an
     * 850-class sled's 123 kW tops out against at 160–175 km/h on the
     * groomer, where the class runs 105–128 mph flat out. */
    lossQuad: 0.3,
    /** ...and a linear part, N per m/s. */
    lossLin: 5,
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
    /** THE ARCADE'S HAND ON THE YAW — which models nothing. The skis stand
     * a long way ahead of the centre of gravity and the tread's centroid a
     * short way behind it, so a sled whose weight is thrown onto its skis —
     * braked hard with the bars over — has more turning moment at the front
     * than holding moment at the back and swaps ends; a racer should not
     * have to catch that. On the snow the yaw rate is held toward the one the
     * skis' own geometry asks for (the way, times the tangent of the ski
     * angle, over the ski-to-tread base) but no faster than `pathShare` of
     * the corner grip can turn the way itself, with `yawHold` N·m per rad/s;
     * and the nose is held to the way the sled is going, `slipHold` N·m per
     * rad of slide once it is going faster than `slipFrom` m/s; the two
     * together no more than `yawHoldMax` N·m. Zero is the bare physics. */
    yawHold: 1500,
    slipHold: 2500,
    yawHoldMax: 3000,
    pathShare: 1,
    slipFrom: 3,
    /** The base the skis steer about, m: ski line to the tread's centroid. */
    base: 1.7,
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
    /** THE RIDER'S BODY ENGLISH ON THE ROLL: nothing in the controls rolls
     * a sled in the air, so the rider levels it himself, N·m per rad of
     * roll off level, with a damping on the roll rate, N·m·s — what keeps a
     * flight kicked a few degrees over off a lip from landing on one ski. */
    rollLevel: 900,
    rollDamp: 160,
    /** ...up to this roll off level, rad, fading out over the last 0.3. */
    rollGiveUp: 1.1,
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

  /** THE CHASSIS: points on the belly, the cowl, the bumper and the
   * rider's helmet that meet the snow when the suspension is not what is
   * touching it — a belly on a crest, a sled on its side, one upside down.
   * Resolved as impulses (`chassis.ts`). */
  hull: {
    /** Share of the speed into the snow a chassis point gets back. */
    restitution: 0.1,
    /** Friction of a chassis sliding on snow. */
    friction: 0.35,
    /** How fast a point already under the snow is pushed back out, 1/s of
     * its depth, and the most that push may be worth, m/s. */
    pushRate: 10,
    pushOut: 1.5,
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
    /** ...and the START LINE's first crossing, m more still: a field
     * jostling off the grid, or one coming onto the track out of the powder
     * on a hand-built map, has still started the race if it swings wide.
     * Every later crossing of the line is judged like any other checkpoint. */
    startGrace: 10,
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
