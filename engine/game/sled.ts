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
//   - the HULL: unsprung points that meet the snow when the suspension has
//     run out, which is how a sled lies on its side and how it rolls over;
//   - GRAVITY.
// The trees and the map's edge are `collision.ts`'s and are applied after.

import { approach, clamp } from "../lib/math.ts";
import { fromEuler, integrate, rotate, toEuler, unrotate, type Vec3 } from "../lib/quat.ts";
import { inertiaOf, totalMass, type SledSpec } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { airTorque, landingLoss } from "./flight.ts";
import { gripAt, powderFloor, sinkTarget, snowDrag, type Grip } from "./snow.ts";
import { hullOf, probesOf } from "./suspension.ts";
import { stepRpm, stepTread } from "./traction.ts";
import type { GameEvent, GameState, SledInput, SledState, SnowContact } from "./state.ts";

const dt = TUNING.dt;
const G = TUNING.grip;
const R = TUNING.rider;

/** The bump stop's rate and damping as multiples of the spring's own. */
const STOP_RATE = 25;
const STOP_DAMP = 4;
/** The body's down axis must point at least this far toward the ground for
 * a probe to be read at all — a sled on its side has no suspension. */
const PROBE_MIN_DOWN = 0.25;
/** Below this speed along its line a probe's resistance fades out, m/s, so
 * a sled at rest is not pushed back and forth through zero. */
const DRAG_FADE = 0.3;

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
    hitCooldown: 0,
    bumpCooldown: 0,
    sinks: probes.map(() => 0),
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
  c.skiAngle = approach(c.skiAngle, c.steer * lock, TUNING.steer.rate * dt);
  const k = Math.min(1, dt / R.lag);
  c.riderRight += (c.steer * spec.riderReach - c.riderRight) * k;
  c.riderAft += (c.lean * R.aftReach - c.riderAft) * k;

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
  const rollRel = Math.asin(clamp(-(right.x * normal.x + right.y * normal.y + right.z * normal.z), -1, 1));

  // ── The suspension and the grip, probe by probe ───────────────────────
  const probes = probesOf(spec);
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
      if (p.kind === "ski") {
        if (p.side < 0) skiL = 0;
        else skiR = 0;
      }
      continue;
    }
    const dx = -up.x;
    const dz = -up.z;
    const packed = level.packedAt(ax, az);
    const target = sinkTarget(packed, speed0, p.sinkScale);
    c.sinks[i] += (target - c.sinks[i]) * Math.min(1, dt / TUNING.snow.sinkLag);
    const sink = c.sinks[i];
    // Where the ray meets the support: one guess off the ground under the
    // attachment, one correction off the ground where that guess landed.
    let t = (ay - (level.groundAt(ax, az) - sink)) / -dy;
    let cx = ax + dx * t;
    let cz = az + dz * t;
    t += (ay + dy * t - (level.groundAt(cx, cz) - sink)) / -dy;
    cx = ax + dx * t;
    cz = az + dz * t;
    const cy = ay + dy * t;
    const comp = p.susp.travel - t;
    contact.compression = Math.max(0, comp);
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
    const gx = -normal.x / normal.y;
    const gz = -normal.z / normal.y;
    const closing = -(pvy - gx * pvx - gz * pvz);
    const rate = closing / -dy;
    const damp = rate > 0 ? p.susp.bump : p.susp.rebound;
    let spring = p.susp.rate * comp + damp * rate;
    if (comp > p.susp.travel) {
      spring += STOP_RATE * p.susp.rate * (comp - p.susp.travel) + STOP_DAMP * p.susp.bump * Math.max(0, rate);
    }
    if (spring <= 0) continue;
    touching += 1;
    const vn = pvx * normal.x + pvy * normal.y + pvz * normal.z;
    if (-vn > impact) impact = -vn;
    // The spring pushes the chassis up its own axis, at the attachment.
    push(ax, ay, az, up.x * spring, up.y * spring, up.z * spring);
    const load = spring * Math.max(0, up.x * normal.x + up.y * normal.y + up.z * normal.z);
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
    gripAt(packed, grip);
    let along = 0;
    let across = 0;
    if (p.kind === "tread") {
      const slip = c.treadSpeed - vf;
      const drive = grip.tread * load * Math.tanh(slip / G.slipRef);
      beltReaction += drive;
      slipSum += slip;
      along += drive;
      across -= grip.treadSide * load * Math.tanh(vl / G.sideRef);
      // THE CARVE: a tread rolled onto its edge in powder bites toward the
      // low side, once there is way on to carve with.
      across += load * R.carve * (1 - packed) * Math.sin(rollRel) * clamp(Math.abs(vf) / R.carveSpeed, 0, 1);
    } else {
      across -= grip.ski * load * Math.tanh(vl / G.sideRef);
    }
    const drag = snowDrag(packed, sink, p.ploughs ? p.width : 0, load, vf);
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

  // ── The belt and the engine ───────────────────────────────────────────
  c.treadSpeed = stepTread(spec, c.treadSpeed, c.rpm, c.throttle, c.brake, beltReaction, dt);
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

  // ── The hull: the chassis where the springs have run out ─────────────
  const H = TUNING.hull;
  let hullTouch = false;
  for (const h of hullOf(spec)) {
    const r = rotate(q, h);
    const px = c.x + r.x;
    const py = c.y + r.y;
    const pz = c.z + r.z;
    const floor = level.groundAt(px, pz) - powderFloor(level.packedAt(px, pz));
    const pen = floor - py;
    if (pen <= 0) continue;
    level.normalAt(px, pz, normal);
    const wv = cross(w.x, w.y, w.z, r.x, r.y, r.z);
    const pvx = c.vx + wv.x;
    const pvy = c.vy + wv.y;
    const pvz = c.vz + wv.z;
    const vn = pvx * normal.x + pvy * normal.y + pvz * normal.z;
    const fn = Math.max(0, H.rate * pen * normal.y - H.damp * vn);
    if (fn <= 0) continue;
    hullTouch = true;
    const tvx = pvx - vn * normal.x;
    const tvy = pvy - vn * normal.y;
    const tvz = pvz - vn * normal.z;
    const tv = Math.max(Math.hypot(tvx, tvy, tvz), DRAG_FADE);
    const ff = (H.friction * fn) / tv;
    push(
      px,
      py,
      pz,
      normal.x * fn - tvx * ff,
      normal.y * fn - tvy * ff,
      normal.z * fn - tvz * ff,
    );
    if (-vn > impact) impact = -vn;
  }

  // ── Into the body frame, with the rider's own torques ─────────────────
  const tb = unrotate(q, torque);
  if (grounded) {
    // THE LEAN INTO A TURN, held by rider and chassis together against the
    // ground: toward the roll the bars ask for, stiffly, and giving out past
    // a radian — a sled well over is going over and nothing holds it.
    const packed = c.packed;
    const target = c.steer * (R.rollPacked * packed + R.rollPowder * (1 - packed));
    const hold = clamp((1.3 - Math.abs(rollRel)) / 0.4, 0, 1);
    tb.z += clamp(R.rollStiff * (rollRel - target) - R.rollDamp * c.wz, -R.rollMax, R.rollMax) * hold;
  } else {
    airTorque(c, tb);
  }
  // Euler's equations with a diagonal inertia: τ − ω × Iω.
  const gx = (I.z - I.y) * c.wy * c.wz;
  const gy = (I.x - I.z) * c.wz * c.wx;
  const gz = (I.y - I.x) * c.wx * c.wy;
  c.wx += ((tb.x - gx) / I.x) * dt;
  c.wy += ((tb.y - gy) / I.y) * dt;
  c.wz += ((tb.z - gz) / I.z) * dt;

  // ── Integrate ─────────────────────────────────────────────────────────
  c.vx += (fx / m) * dt;
  c.vy += (fy / m) * dt;
  c.vz += (fz / m) * dt;
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
      const lost = landingLoss(impact);
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
  c.stuckFor =
    input.throttle > 0.5 && c.speed < TUNING.reset.stuckSpeed ? c.stuckFor + dt : 0;
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
