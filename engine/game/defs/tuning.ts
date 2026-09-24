// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every sled
// (the machine's own numbers live in `defs/sled.ts`). Grouped by subject:
// the clock, the air, the SNOW (how far it lets a sled sink and what it
// costs to push through it), GRIP, the TREAD and its drive, the STEERING,
// the RIDER, the AIR, the HULL contacts, the trees, the course and the
// reset. Every number carries its unit; every model it feeds names its
// source at the function that implements it. Tweak here, verify with
// `npm run ride` and `npm run sim`; the render layer never reads these.
// The score and the strokes are stated next door (`defs/tricks.ts`) and
// folded in as `TUNING.tricks`.

import { TRICKS } from "./tricks.ts";

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
     * of the probe's load per m/s — gone on packed snow. Set so the
     * crossover runs about four fifths of its groomer top in powder once it
     * is planing (the mountain and snocross sleds more, the trail and
     * touring sleds less — their lugs are the answer to other snow). */
    powderDrag: 0.003,
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
    lugSide: 0.35,
    /** The belt's own losses go as the lug height to this power, beside
     * its length — a tall paddle is more rubber flexed round every idler. */
    lugLoss: 0.8,
    /** The tread's packed grip gained per hundred studs through the belt,
     * as a share — a studded belt drives, stops and holds a groomed bend a
     * twelfth harder than a bare one. */
    studGrip: 0.08,
    /** The skis' packed grip goes as the carbide's length to this power: a
     * runner twice as long cuts a groove half again as hard. */
    carbideExp: 0.6,
    /** The skis' powder grip goes as their width to this power. */
    skiFloat: 0.8,
    /** The belt's mass goes as its lugs' height to this power, beside its
     * area. */
    lugMass: 0.3,
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
    /** BLUE ICE (R21's frozen river): the share of the groomer's grip left
     * on bare ice — the tread's studs still find some drive, a carbide
     * keel scratches a line and little more. Rubber on ice at 0.1–0.2 against
     * packed snow's 0.3–0.5, the studs lifting the tread's share. */
    ice: { tread: 0.45, side: 0.35, ski: 0.3 },
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
    yawHold: 8000,
    slipHold: 5000,
    yawHoldMax: 5000,
    pathShare: 0.9,
    slipFrom: 3,
    /** THE SCRUB: a carbide keel or a lug holding the sled sideways cuts a
     * groove through the groomer, and a sled leaned hard over a bend is
     * cutting one under every ski and along the belt — a drag against the
     * travel of this share of the bend's own acceleration (the rate the skis
     * ask for, times the way), on the packed share of the snow; powder
     * charges for its own shoving through the plough. Why a bend taken flat
     * out costs the way rather than being free at full throttle: a full-lock
     * bend at 100 km/h with the lever pinned about holds its speed. */
    scrub: 0.35,
    /** The base the skis steer about, m: ski line to the tread's centroid. */
    base: 1.7,
  },

  /** THE ARCADE'S HANDS — dials that model nothing, stated as such, and the
   * reason the game FEELS like a sled rather than measuring like one. Each is
   * a multiplier on a measured quantity, so 1 is the bare physics and the
   * distance from 1 is how far the game leans on the rider's side. Real
   * machines corner at about their static tipping point on a groomed trail
   * (0.9–1.1 g) and lift the inside ski doing it; a racer at the arcade's pace
   * wants a little more than that and never the ski lift. */
  arcade: {
    /** Every SIDEWAYS grip on the snow — the skis' keels and the tread's
     * lugs, on the groomer and in powder alike. */
    sideGrip: 1.35,
    /** The tipping point: the rider hung off the inside is worth this many
     * times the static stability factor, which is what lets a sled carry the
     * grip above without lifting a ski. Read by `tipLimit`, and by the roll
     * the rider and the chassis hold (`rider.rollMax`, scaled). */
    hangOff: 1.3,
    /** THE RIDER'S THUMB on the brake: a lever held pinned never slows the
     * belt more than this far below the way, m/s — where its drag is near
     * its peak (`grip.slipRef` twice over) and some sideways hold is left.
     * A real rider modulates to just short of lock; the arcade does it for
     * him, so a locked belt's slew is never what a pinned lever buys. */
    brakeSlip: 2.8,
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
    rollStiff: 8000,
    rollDamp: 560,
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
    /** ARCADE GRAVITY IN FLIGHT, as a multiple of `g` — models nothing,
     * and says so. At the real 9.81 a kicker taken at race speed hangs the
     * sled 8 m up for 2.3 s, and a hang that long on a chase camera reads
     * as slow motion rather than weight (the sibling rally game flies at
     * 1.6 g for the same reason). Only a sled genuinely FLYING feels it —
     * no probe and no chassis point on the snow since the step before —
     * so the ground holds a sled over a crest at exactly the real g and
     * where a sled leaves the snow is a fact about the shape and the
     * speed; what this sets is how soon the air gives it back. The bot's
     * ballistics read it through `limits.ts`'s `flightGravity`. */
    gravity: 1.5,
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
    /** THE ARCADE'S HAND ON THE PITCH (`flight.ts`): with the lean left
     * alone the rider's body eases the nose toward half the flight path,
     * never more than `pitchAim` rad either way, at `pitchLevel` N·m per rad
     * off it and never past `pitchLevelMax` N·m — both on the reference
     * machine, scaled by each one's pitch inertia — under two thirds of the
     * lean's authority, so a lean still flies the sled, and not once it is
     * `pitchGiveUp` rad off (a flip carried round). Models nothing: a real
     * rider does it with his whole body and not every time. */
    pitchLevel: 520,
    pitchLevelMax: 320,
    pitchAim: 0.35,
    pitchGiveUp: 1.0,
    /** ...and over the last this many seconds before the snow comes back
     * (`flight.ts`'s `landingAhead`), s, the nose is eased from half the
     * flight path onto the slope it will land on instead. */
    landLook: 0.8,
    /** How long off the snow before it counts as air, s — anything shorter
     * is a sled skipping over a bump. */
    counts: 0.15,
    /** A LANDING: the speed INTO the slope, m/s, past which the suspension
     * cannot take it all and the sled pays for it — a share of its way per
     * m/s over, up to `harshMax`. */
    harshSpeed: 10,
    harshLoss: 0.03,
    harshMax: 0.2,
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

  /** THE WIPEOUT — the rider off the sled (`crash.ts`). Three ways off,
   * each a threshold no clean ride comes near: the bot over every seed on
   * every machine lands at most 6° nose-down and 9 m/s into the slope,
   * never goes past half over, and meets no trunk. */
  crash: {
    /** A trunk met at this closing speed or more throws him, m/s (29 km/h):
     * the sled stops and he does not. */
    treeSpeed: 8,
    /** A landing taken this far nose-down against the slope, rad (34°),
     * at this speed into it or more, m/s, goes over the bars — the landing
     * that ends a real flight of `noseAir` s or more. The hop a sled makes
     * rebounding off its own touchdown (0.15–0.22 s up) is the springs
     * handing back that landing, not a second one: a stock kicker overshot
     * lands tail-first and slaps down onto its nose 37° down a hop later,
     * and an arcade racer forgives that. */
    noseAngle: 0.6,
    noseImpact: 5,
    noseAir: 0.3,
    /** A sled going over (`reset.overUp`) at this speed or more, m/s, puts
     * him off; slower, he hangs on and the reset's own clock stands it up. */
    rollSpeed: 8,
    /** ...once it has lain over ON THE SNOW (`SledState.rolledFor`) this long,
     * s: a sled turning over in the air, or clipping a side on the way round
     * and coming back onto its skis, has not rolled. */
    rollHold: 0.2,
    /** What he leaves with: this share of the sled's velocity before the
     * blow, and a climb, m/s — the pitch of a body off a seat. */
    keep: 0.85,
    throwUp: 2.4,
    /** THE BODY: its radius, m; how far into powder it settles, m; the
     * share of the speed into the snow it gets back; its friction on the
     * groomer and in powder (a sprawled body ploughs fresh snow). */
    radius: 0.3,
    sink: 0.12,
    restitution: 0.25,
    frictionPacked: 0.5,
    frictionPowder: 0.8,
    /** THE TUMBLE: head over heels at the speed over this rolling radius,
     * m, no faster than `maxSpin` rad/s; on the snow the spin chases the
     * roll at `spinGrip` 1/s, and at rest he settles flat. */
    tumbleRadius: 0.5,
    maxSpin: 12,
    spinGrip: 4,
    /** THE SLED, riderless: the nose-over a nose-in landing puts into it,
     * rad/s per m/s of impact, capped. */
    sledKick: 0.35,
    sledKickMax: 5,
    /** How long he lies before the reset stands them up, s: at least
     * `lieMin` off the sled and `lieStill` lain still (under `restSpeed`
     * m/s, on the snow) — the beat the death cam rises over him on — and
     * never past `lieMax`. */
    lieMin: 1.8,
    restSpeed: 0.6,
    lieStill: 1,
    lieMax: 6.5,
  },

  /** STUCK IN DEEP POWDER (`trench.ts`). A tread spinning with the sled
   * going nowhere digs itself down until the belly is on the snow and the
   * belt has nothing under it; the way out is to rock it — the rider
   * throwing his weight fore and aft, side to side — or the reset. */
  trench: {
    /** Seconds BOGGED before it starts to dig — over half throttle in
     * powder, the belt slipping past half `slipRef`, and under `creep` m/s
     * along the nose: a launch out of the powder never gets there. */
    after: 1,
    /** How fast it digs, m/s, with the tread slipping `slipRef` m/s or
     * more, and the deepest it gets, m, on top of the sink. */
    dig: 0.14,
    slipRef: 6,
    max: 0.3,
    /** The share of the tread's drive lost at the deepest trench. */
    grip: 0.75,
    /** ROCKING IT OUT: trench packed back per metre the rider's weight
     * moves (`riderAft`, `riderRight`), m/m — and cleared as the sled
     * drives out of its hole, m per m of way past `creep` m/s (creeping
     * about in the hole is not driving out of it). */
    rock: 0.04,
    clear: 0.4,
    creep: 1,
    /** Past this depth it is trenched and `stuck` fires, m. From its first
     * centimetre the automatic reset waits `holdFor` s of trench instead of
     * `reset.stuckFor`, so the rider has the time to rock it out. */
    stuckAt: 0.06,
    holdFor: 8,
  },

  /** DAMAGE (`damage.ts`) — only on a run that asked for it. */
  damage: {
    /** A trunk bends the ski on its side past this closing speed, m/s, by
     * `treeRate` per m/s over. */
    treeFrom: 4,
    treeRate: 0.06,
    /** A harsh landing hurts the suspension by `landRate` per m/s past the
     * machine's harsh speed. */
    landRate: 0.05,
    /** A wipeout's own share, on the parts its cause reaches. */
    wipeout: 0.2,
    /** Below this much in one blow nothing is reported. */
    report: 0.04,
    /** A BENT SKI: the pull it puts on the bars at fully bent, rad toward
     * its own side, and the share of its bite lost. */
    skiToe: 0.07,
    skiGrip: 0.4,
    /** A HURT SUSPENSION: the shares of spring rate, damping and harsh
     * speed lost at fully wrecked. */
    springSoft: 0.4,
    dampSoft: 0.5,
    harshSoft: 0.45,
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

  /** THE SCORE AND THE STROKES (`defs/tricks.ts`). */
  tricks: TRICKS,
} as const;
