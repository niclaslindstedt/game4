// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED AS A RIGID BODY — one step of it. Every force the machine feels
// is summed here in the world frame, the torques are taken about the centre
// of gravity and turned into the body frame, and the whole is integrated
// once, semi-implicitly, at 120 Hz: velocity first, then position; body
// rates first, then the orientation quaternion.
//
// The forces, and where each is modelled:
//   - the SUSPENSION: every probe a spring-damper along the body's down axis
//     against the snow's SUPPORT, which is the surface less the sink the
//     speed allows (`suspension.ts`, `snow.ts`), with a bump stop past its
//     travel;
//   - the GRIP at each contact, in the ground's tangent plane: the tread
//     driving along its length off the belt's slip, and holding sideways;
//     the skis holding sideways along their own steered line; every probe's
//     rolling resistance, plough and powder drag against the way it is going
//     (`snow.ts`);
//   - the DRIVE, through the belt as a mass of its own (`traction.ts`);
//   - the RIDER: his weight moved off-centre by the bars and the lean, and
//     the roll he and the chassis settle at into a turn, which in powder is
//     the CARVE — a sled rolled onto its tread's edge turns toward the low
//     side;
//   - the AIR, against the whole machine's drag area; and in flight the
//     rider's levers (`flight.ts`);
//   - the CHASSIS: unsprung points that meet the snow when the suspension
//     has run out, which is how a sled lies on its side and how it rolls
//     over — resolved as impulses after the forces (`chassis.ts`);
//   - GRAVITY.
// The trees and the map's edge are `collision.ts`'s and are applied after.

import { angleDiff, approach, clamp } from "../lib/math.ts";
import { fromEuler, integrate, rotate, toEuler, unrotate, type Vec3 } from "../lib/quat.ts";
import { SLED, inertiaOf, totalMass, type SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { airTorque, landingAhead, landingLoss } from "./flight.ts";
import { chassisContacts } from "./chassis.ts";
import { gripAt, onIce, sinkTarget, snowDrag, type Grip } from "./snow.ts";
import { cornerGrip, flightGravity, harshSpeedOf } from "./limits.ts";
import { footprintOf } from "./footprint.ts";
import { probesOf } from "./suspension.ts";
import { stepRpm, stepTread } from "./traction.ts";
import { dampShare, harshShare, skiBite, skiPull, springShare } from "./damage.ts";
import { stepTrench, trenchGrip } from "./trench.ts";
import type { GameEvent, GameState, SledInput, SledState, SnowContact } from "./state.ts";

const dt = TUNING.dt;
const G = TUNING.grip;
const R = TUNING.rider;
const ARC = TUNING.arcade;

/** The bump stop's rate and damping as multiples of the spring's own, and
 * the most any one probe may ever push, as a multiple of the load it
 * carries at rest. The cap is the physics' fuse rather than a model: a strut
 * bottomed on a steep face sees its compression grow with every centimetre
 * the sled slides, and a spring that followed it would fire the machine off
 * the slope. Fifteen of its rest load is fifteen g on that corner. */
const STOP_RATE = 12;
const STOP_DAMP = 4;
const MAX_LOAD = 15;
/** THE STOP IS A BUMPER, NOT A SPRING: a bottoming bumper of foam and
 * rubber loads at its full rate and gives back only this share of it on
 * the way out — the hysteresis that makes it swallow a slam. Returned
 * whole, the stop's stored energy alone was ~2 m/s of rebound on a
 * kicker's landing: the whole sled thrown back off the snow for 0.4 s. */
const STOP_RELEASE = 0.2;
/** BOTTOMING CONTROL: the compression damping rises over the last
 * `BOTTOM_ZONE` of the stroke, to `1 + BOTTOM_DAMP` times its own at the
 * end — the position-sensitive valving a sled's shocks carry for landings,
 * so a big hit is slowed before the stop has to catch it. */
const BOTTOM_ZONE = 0.3;
const BOTTOM_DAMP = 2;
/** The fastest the body may turn about any axis, rad/s — a second fuse,
 * over the explicit gyroscopic term, which a tumble would otherwise feed. */
const MAX_SPIN = 25;
/** The body's down axis must point at least this far toward the ground for
 * a probe to be read at all — a sled on its side has no suspension. */
const PROBE_MIN_DOWN = 0.25;
/** Below this speed along its line a probe's resistance fades out, m/s, so
 * a sled at rest is not pushed back and forth through zero. */
const DRAG_FADE = 0.3;
/** Newton steps along a probe's ray, and how steeply it must meet the snow
 * (the vertical closing per metre of ray) to count as meeting it. */
const RAY_STEPS = 3;
const RAY_GRAZE = 0.15;
/** The least cosine between a strut and the snow's normal the normal force
 * is resolved through — a strut lying along the snow carries it nothing. */
const TILT_MIN = 0.5;

/** A sled at rest with nothing read yet; `standSled` puts it somewhere. */
export function freshSled(spec: SledSpec): SledState {
  const probes = probesOf(spec);
  const contacts: SnowContact[] = probes.map((p) => ({
    kind: p.kind,
    side: p.side,
    x: 0,
    y: 0,
    z: 0,
    sink: 0,
    width: p.width,
    compression: 0,
    load: 0,
    touching: false,
  }));
  return {
    spec,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    q: fromEuler(0, 0, 0),
    wx: 0,
    wy: 0,
    wz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    way: 0,
    rpm: spec.idleRpm,
    throttle: 0,
    brake: 0,
    steer: 0,
    lean: 0,
    skiAngle: 0,
    riderRight: 0,
    riderAft: 0,
    treadSpeed: 0,
    slip: 0,
    packed: 0,
    contacts,
    skiCompression: [0, 0],
    treadCompression: 0,
    airborne: false,
    airTime: 0,
    launchVy: 0,
    airReported: false,
    landing: 1e6,
    overFor: 0,
    stuckFor: 0,
    trench: 0,
    trenchFor: 0,
    boggedFor: 0,
    rolledFor: 0,
    thrown: null,
    damage: { ski: [0, 0], suspension: 0 },
    hitCooldown: 0,
    bumpCooldown: 0,
    sinks: probes.map(() => 0),
    comps: probes.map(() => 0),
  };
}

/** The full ski lock at `speed` m/s, rad: the spec's at a standstill,
 * halved by `steer.fadeSpeed`. Read by the physics AND the bot. */
export function skiLockAt(spec: SledSpec, speed: number): number {
  return spec.skiLock / (1 + Math.abs(speed) / TUNING.steer.fadeSpeed);
}

// Scratch, reused every step: the engine allocates nothing per probe.
const grip: Grip = { tread: 0, treadSide: 0, ski: 0 };
const normal: Vec3 = { x: 0, y: 1, z: 0 };
const torque: Vec3 = { x: 0, y: 0, z: 0 };

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): Vec3 {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

/** Advance one sled by one step under `input`. Events land on `events`. */
export function stepSled(state: GameState, input: SledInput, events: GameEvent[]): void {
  const c = state.sled;
  const spec = c.spec;
  const level = state.level;
  const m = totalMass(spec);
  const I = inertiaOf(spec);
  const g = TUNING.g;

  // ── The controls, through their lags ──────────────────────────────────
  c.throttle = approach(c.throttle, clamp(input.throttle, 0, 1), TUNING.tread.throttleRate * dt);
  c.brake = approach(c.brake, clamp(input.brake, 0, 1), TUNING.tread.throttleRate * dt);
  c.steer = clamp(input.steer, -1, 1);
  c.lean = approach(c.lean, clamp(input.lean, -1, 1), dt / R.lag);
  const speed0 = Math.hypot(c.vx, c.vy, c.vz);
  const lock = skiLockAt(spec, speed0);
  // A bent ski (`damage.ts`) pulls the line the bars ask for toward its side.
  c.skiAngle = approach(c.skiAngle, c.steer * lock + skiPull(c), TUNING.steer.rate * dt);
  const k = Math.min(1, dt / R.lag);
  const right0 = c.riderRight;
  const aft0 = c.riderAft;
  c.riderRight += (c.steer * spec.riderReach - c.riderRight) * k;
  c.riderAft += (c.lean * R.aftReach - c.riderAft) * k;
  const moved = Math.abs(c.riderRight - right0) + Math.abs(c.riderAft - aft0);

  // ── The frame ─────────────────────────────────────────────────────────
  const q = c.q;
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const w = rotate(q, { x: c.wx, y: c.wy, z: c.wz });
  const vx0 = c.vx;
  const vy0 = c.vy;
  const vz0 = c.vz;

  let fx = 0;
  let fy = -m * g;
  let fz = 0;
  torque.x = 0;
  torque.y = 0;
  torque.z = 0;
  const push = (px: number, py: number, pz: number, Fx: number, Fy: number, Fz: number): void => {
    fx += Fx;
    fy += Fy;
    fz += Fz;
    const t = cross(px - c.x, py - c.y, pz - c.z, Fx, Fy, Fz);
    torque.x += t.x;
    torque.y += t.y;
    torque.z += t.z;
  };

  // The ground under the CoG: the roll the rider holds is measured against
  // it, and the carve reads it.
  level.normalAt(c.x, c.z, normal);
  const rollRel = Math.asin(
    clamp(-(right.x * normal.x + right.y * normal.y + right.z * normal.z), -1, 1),
  );

  // ── The suspension and the grip, probe by probe ───────────────────────
  const probes = probesOf(spec);
  const fit = footprintOf(spec);
  // What the machine has taken (`damage.ts`) and the hole it has dug
  // (`trench.ts`) — each exactly 1 on a sound sled out of any hole.
  const soft = springShare(c);
  const dampen = dampShare(c);
  const bite = trenchGrip(c.trench);
  let touching = 0;
  let beltReaction = 0;
  let loadSum = 0;
  let packedLoad = 0;
  let impact = 0;
  let skiL = 0;
  let skiR = 0;
  let treadComp = 0;
  let treadN = 0;
  let slipSum = 0;
  const skiDir = rotate(q, { x: Math.sin(c.skiAngle), y: 0, z: Math.cos(c.skiAngle) });
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const contact = c.contacts[i];
    contact.touching = false;
    contact.load = 0;
    const a = rotate(q, { x: p.bx, y: p.by, z: p.bz });
    const ax = c.x + a.x;
    const ay = c.y + a.y;
    const az = c.z + a.z;
    // The ray: straight down the body's own axis from the attachment.
    const dy = -up.y;
    if (dy > -PROBE_MIN_DOWN) {
      c.comps[i] = 0;
      if (p.kind === "ski") {
        if (p.side < 0) skiL = 0;
        else skiR = 0;
      }
      continue;
    }
    const dx = -up.x;
    const dz = -up.z;
    const packed = level.packedAt(ax, az);
    const ice = level.iceAt ? level.iceAt(ax, az) : 0;
    // A trenched tread (`trench.ts`) hangs in the hole it has dug.
    const target =
      sinkTarget(packed, speed0, p.sinkScale, p.planeScale, state.snowDepth) +
      (p.kind === "tread" ? c.trench : 0);
    c.sinks[i] += (target - c.sinks[i]) * Math.min(1, dt / TUNING.snow.sinkLag);
    const sink = c.sinks[i];
    // Where the ray meets the support: Newton's method along the ray, off
    // the slope of the snow wherever the last guess landed — a ray at a
    // grazing angle to a face converges where a vertical guess would
    // overshoot it. A ray running along the snow meets nothing.
    let t = (ay - (level.groundAt(ax, az) - sink)) / -dy;
    let cx = ax + dx * t;
    let cz = az + dz * t;
    let grazing = false;
    for (let it = 0; it < RAY_STEPS; it++) {
      level.normalAt(cx, cz, normal);
      const slope = dy + (normal.x * dx + normal.z * dz) / normal.y;
      if (slope > -RAY_GRAZE) {
        grazing = true;
        break;
      }
      const gap = ay + dy * t - (level.groundAt(cx, cz) - sink);
      t -= gap / slope;
      cx = ax + dx * t;
      cz = az + dz * t;
    }
    if (grazing) {
      c.comps[i] = 0;
      continue;
    }
    const cy = ay + dy * t;
    const comp = p.susp.travel - t;
    contact.compression = Math.max(0, comp);
    if (comp <= 0) c.comps[i] = 0;
    if (p.kind === "ski") {
      if (p.side < 0) skiL = Math.max(0, comp);
      else skiR = Math.max(0, comp);
    } else {
      treadComp += Math.max(0, comp);
      treadN += 1;
    }
    if (comp <= 0) continue;
    level.normalAt(cx, cz, normal);
    // The contact point's own velocity, and how fast it is closing on the
    // slope under it — what the damper reads.
    const rx = cx - c.x;
    const ry = cy - c.y;
    const rz = cz - c.z;
    const wv = cross(w.x, w.y, w.z, rx, ry, rz);
    const pvx = c.vx + wv.x;
    const pvy = c.vy + wv.y;
    const pvz = c.vz + wv.z;
    // THE DAMPER'S RATE is the compression's own change since the last step
    // — read off the very surface the spring is, so a crease in the snow is
    // a crease in both. A probe just arriving has no last step: its rate is
    // the contact point's speed into the slope.
    const was = c.comps[i];
    const rate =
      was > 0
        ? (comp - was) / dt
        : Math.max(0, -(pvx * normal.x + pvy * normal.y + pvz * normal.z)) /
          Math.max(0.3, up.x * normal.x + up.y * normal.y + up.z * normal.z);
    c.comps[i] = comp;
    const deep = clamp((comp / p.susp.travel - (1 - BOTTOM_ZONE)) / BOTTOM_ZONE, 0, 1);
    const damp = rate > 0 ? p.susp.bump * (1 + BOTTOM_DAMP * deep) : p.susp.rebound;
    let spring = p.susp.rate * soft * comp + damp * dampen * rate;
    if (comp > p.susp.travel) {
      spring +=
        STOP_RATE * p.susp.rate * (comp - p.susp.travel) * (rate > 0 ? 1 : STOP_RELEASE) +
        STOP_DAMP * p.susp.bump * Math.max(0, rate);
    }
    if (spring <= 0) continue;
    if (spring > MAX_LOAD * p.rest) spring = MAX_LOAD * p.rest;
    touching += 1;
    const vn = pvx * normal.x + pvy * normal.y + pvz * normal.z;
    if (-vn > impact) impact = -vn;
    // THE SNOW ANSWERS ALONG ITS OWN NORMAL. What it can push with is a
    // normal force, and what the strut carries is that force's share along
    // the strut — the linkage takes the rest — so the normal force is the
    // spring over the cosine between the two, and nothing sideways: holding
    // sideways is the grip's, below. Pushed up the body's own axis instead,
    // a chassis rolled out of a turn on its springs was shoved out of the
    // turn by the tilt — a tenth of its weight, sideways, that no grip had
    // paid for — and every sled pushed wide at 0.9 g whatever its skis held.
    const tilt = up.x * normal.x + up.y * normal.y + up.z * normal.z;
    const load = Math.min(spring / Math.max(TILT_MIN, tilt), MAX_LOAD * p.rest);
    push(ax, ay, az, normal.x * load, normal.y * load, normal.z * load);
    contact.touching = true;
    contact.load = load;
    loadSum += load;
    packedLoad += load * packed;

    // The tangent frame along this probe's line of travel.
    const dir = p.kind === "ski" ? skiDir : fwd;
    const dn = dir.x * normal.x + dir.y * normal.y + dir.z * normal.z;
    let tx = dir.x - dn * normal.x;
    let ty = dir.y - dn * normal.y;
    let tz = dir.z - dn * normal.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const side = cross(normal.x, normal.y, normal.z, tx, ty, tz);
    const vf = pvx * tx + pvy * ty + pvz * tz;
    const vl = pvx * side.x + pvy * side.y + pvz * side.z;
    gripAt(packed, grip, fit);
    if (ice > 0) onIce(grip, ice);
    let along = 0;
    let across = 0;
    if (p.kind === "tread") {
      // COMBINED SLIP: the belt slipping along its length and the snow
      // sliding across it are one slip, and the grip is one budget spent
      // along that slip's direction (the friction ellipse — the belt's shear
      // on snow saturating with how far it has been sheared, Janosi and
      // Hanamoto, in its velocity form). So a belt spinning under full
      // throttle has little left to hold the tail with and the tail walks
      // out — the power slide a rider steers with — and a belt LOCKED by the
      // brake slides whichever way the sled is going, so the tail comes
      // round; with neither, all of it holds.
      const slip = c.treadSpeed - vf;
      const sx = slip / G.slipRef;
      const sy = vl / G.sideRef;
      const sheared = Math.hypot(sx, sy);
      const share = sheared > 1e-6 ? Math.tanh(sheared) / sheared : 1;
      const drive = grip.tread * bite * load * sx * share;
      beltReaction += drive;
      slipSum += slip;
      along += drive;
      across -= grip.treadSide * ARC.sideGrip * load * sy * share;
      // THE CARVE: a tread rolled onto its edge in powder bites toward the
      // low side, once there is way on to carve with.
      across +=
        load *
        R.carve *
        (1 - packed) *
        Math.sin(rollRel) *
        clamp(Math.abs(vf) / R.carveSpeed, 0, 1);
    } else {
      across -= grip.ski * ARC.sideGrip * skiBite(c, p.side) * load * Math.tanh(vl / G.sideRef);
    }
    const drag = snowDrag(
      packed,
      sink,
      p.ploughs ? p.width : 0,
      load,
      vf,
      (p.kind === "tread" ? fit.sink : 1) * state.snowDepth,
    );
    along -= drag * Math.tanh(vf / DRAG_FADE);
    push(
      cx,
      cy,
      cz,
      tx * along + side.x * across,
      ty * along + side.y * across,
      tz * along + side.z * across,
    );
    contact.x = cx;
    contact.z = cz;
    contact.y = level.groundAt(cx, cz);
    contact.sink = sink;
  }
  c.skiCompression[0] = skiL;
  c.skiCompression[1] = skiR;
  c.treadCompression = treadN > 0 ? treadComp / treadN : 0;
  c.packed = loadSum > 0 ? packedLoad / loadSum : level.packedAt(c.x, c.z);
  const grounded = touching > 0;
  // THE ARCADE'S GRAVITY (`air.gravity`): a sled that was flying at the end
  // of the last step and has found no snow under a probe this one is pulled
  // down harder than the ground ever holds it — the hang shortened, never
  // where it left the snow.
  if (!grounded && c.airborne) fy -= m * (flightGravity(state.rules) - g);

  // ── The belt and the engine ───────────────────────────────────────────
  // THE RIDER'S THUMB (`arcade.brakeSlip`): a pinned lever holds the belt
  // just short of lock, still turning at the way less the slip it brakes
  // hardest at, rather than locking it — a locked belt has no sideways
  // hold left, and a heavy tail on one comes round. On the snow only; in
  // the air the brake stops the belt dead, which is the gyro's nose-down.
  const floor = grounded ? Math.max(0, c.way - ARC.brakeSlip) : 0;
  c.treadSpeed = stepTread(spec, c.treadSpeed, c.rpm, c.throttle, c.brake, beltReaction, dt, floor);
  c.rpm = stepRpm(spec, c.rpm, c.throttle, c.treadSpeed, dt);
  c.slip = grounded ? slipSum / Math.max(1, probes.length - 2) : 0;

  // ── The rider's weight, off-centre ────────────────────────────────────
  const shift = rotate(q, { x: c.riderRight, y: 0, z: -c.riderAft });
  const riderW = spec.riderMass * g;
  // r × (0, −W, 0) = (r.z·W, 0, −r.x·W)
  torque.x += shift.z * riderW;
  torque.z += -shift.x * riderW;

  // ── The air ───────────────────────────────────────────────────────────
  const v = Math.hypot(c.vx, c.vy, c.vz);
  const drag = 0.5 * TUNING.airDensity * spec.cdA * v;
  fx -= drag * c.vx;
  fy -= drag * c.vy;
  fz -= drag * c.vz;

  // ── Into the body frame, with the rider's own torques ─────────────────
  const tb = unrotate(q, torque);
  if (grounded) {
    // THE LEAN INTO A TURN, held by rider and chassis together against the
    // ground: toward the roll the bars ask for, stiffly, and giving out past
    // a radian — a sled well over is going over and nothing holds it.
    const packed = c.packed;
    const target = c.steer * (R.rollPacked * packed + R.rollPowder * (1 - packed));
    const hold = clamp((1.3 - Math.abs(rollRel)) / 0.4, 0, 1);
    // Stated on the reference machine and scaled by this one's weight
    // times its height: the moment a bend puts on a machine goes as both,
    // so the same hold on a heavier, taller one was a rider who let the
    // touring sled over at 113 km/h on a bend the crossover took flat.
    const heave = (m * spec.cogHeight) / (totalMass(SLED) * SLED.cogHeight);
    tb.z +=
      clamp(
        R.rollStiff * (rollRel - target) - R.rollDamp * c.wz,
        -R.rollMax * ARC.hangOff,
        R.rollMax * ARC.hangOff,
      ) *
      heave *
      hold;
    // THE YAW HELD (`steer.yawHold`): toward the rate the skis ask for, no
    // more than the grip can turn the way at, and the nose held to the way
    // the sled is actually going.
    const S = TUNING.steer;
    const way = c.way;
    const flat = Math.hypot(c.vx, c.vz);
    const reach = Math.abs(way) > 1 ? (cornerGrip(spec, packed) * S.pathShare) / Math.abs(way) : 0;
    const asked = clamp((way * Math.tan(c.skiAngle)) / S.base, -reach, reach);
    const slip = flat > S.slipFrom && way > 0 ? angleDiff(Math.atan2(c.vx, c.vz), c.heading) : 0;
    // Stated in N·m on the reference machine and scaled by this one's yaw
    // inertia: a hand on the yaw is an ACCELERATION, and the same torque on
    // a heavier machine is a weaker hand — the touring sled spun where the
    // crossover held.
    const heft = I.y / inertiaOf(SLED).y;
    // THE SCRUB (`steer.scrub`): the bend the skis ask for on the groomer
    // is paid out of the way — the grooves the keels and the lugs cut
    // through it — at the CoG, so it turns nothing. Powder already charges
    // for what it is shoved aside by (the plough). Read off the rate asked
    // rather than the grip's own sideways forces, which chatter step to step
    // as a ski meets a kicker's face and would brake a sled going straight.
    if (flat > 1) {
      const scrub = S.scrub * packed * m * Math.abs(asked * way);
      fx -= (scrub * c.vx) / flat;
      fz -= (scrub * c.vz) / flat;
    }
    tb.y +=
      clamp(-S.yawHold * (c.wy - asked) - S.slipHold * slip, -S.yawHoldMax, S.yawHoldMax) *
      heft *
      hold *
      state.assist.yaw;
  } else {
    airTorque(c, tb, state.assist.air, landingAhead(c, level, flightGravity(state.rules)));
  }
  // Euler's equations with a diagonal inertia: τ − ω × Iω.
  const gx = (I.z - I.y) * c.wy * c.wz;
  const gy = (I.x - I.z) * c.wz * c.wx;
  const gz = (I.y - I.x) * c.wx * c.wy;
  c.wx += ((tb.x - gx) / I.x) * dt;
  c.wy += ((tb.y - gy) / I.y) * dt;
  c.wz += ((tb.z - gz) / I.z) * dt;
  const spin = Math.hypot(c.wx, c.wy, c.wz);
  if (spin > MAX_SPIN) {
    c.wx *= MAX_SPIN / spin;
    c.wy *= MAX_SPIN / spin;
    c.wz *= MAX_SPIN / spin;
  }

  // ── Integrate: velocities, then the chassis's impulses, then position ─
  c.vx += (fx / m) * dt;
  c.vy += (fy / m) * dt;
  c.vz += (fz / m) * dt;
  const chassis = chassisContacts(c, level, state.snowDepth);
  const hullTouch = chassis > 0;
  if (chassis > impact) impact = chassis;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  c.q = integrate(c.q, c.wx, c.wy, c.wz, dt);

  // ── Air and landing ───────────────────────────────────────────────────
  c.landing += dt;
  if (!grounded && !hullTouch) {
    if (!c.airborne) {
      c.airborne = true;
      c.airTime = 0;
      c.launchVy = vy0;
      c.airReported = false;
    }
    c.airTime += dt;
    if (!c.airReported && c.airTime >= TUNING.air.counts) {
      c.airReported = true;
      events.push({ kind: "air", t: state.t, vy: c.launchVy, speed: Math.hypot(vx0, vy0, vz0) });
    }
  } else if (c.airborne) {
    const flew = c.airTime;
    c.airborne = false;
    c.airTime = 0;
    if (flew >= TUNING.air.counts) {
      const lost = landingLoss(impact, harshSpeedOf(spec) * harshShare(c));
      if (lost > 0) {
        // The bottomed suspension takes it out of the way along the slope.
        level.normalAt(c.x, c.z, normal);
        const vn = c.vx * normal.x + c.vy * normal.y + c.vz * normal.z;
        c.vx = (c.vx - vn * normal.x) * (1 - lost) + vn * normal.x;
        c.vy = (c.vy - vn * normal.y) * (1 - lost) + vn * normal.y;
        c.vz = (c.vz - vn * normal.z) * (1 - lost) + vn * normal.z;
      }
      c.landing = 0;
      events.push({
        kind: "land",
        t: state.t,
        airTime: flew,
        impact,
        speed: Math.hypot(c.vx, c.vy, c.vz),
        harsh: lost > 0,
        lost,
      });
    }
  }

  derive(c);
  // ── The automatic reset's clocks (`run.ts` acts on them) ──────────────
  const upright = rotate(c.q, { x: 0, y: 1, z: 0 }).y;
  c.overFor = upright < TUNING.reset.overUp ? c.overFor + dt : 0;
  c.stuckFor = input.throttle > 0.5 && c.speed < TUNING.reset.stuckSpeed ? c.stuckFor + dt : 0;
  stepTrench(state, moved, events);
  if (c.hitCooldown > 0) c.hitCooldown -= dt;
  if (c.bumpCooldown > 0) c.bumpCooldown -= dt;
}

/** The readouts derived from the body's state — written once at the end
 * of a step (and by anything that stands a sled somewhere). */
export function derive(c: SledState): void {
  const e = toEuler(c.q);
  c.heading = e.heading;
  c.pitch = e.pitch;
  c.roll = e.roll;
  c.speed = Math.hypot(c.vx, c.vy, c.vz);
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  const fl = Math.hypot(f.x, f.z) || 1;
  c.way = (c.vx * f.x + c.vz * f.z) / fl;
}
