// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SCENARIOS — each a map, a moment to stand the sled at
// (`placeRun`), a scripted input and the numbers that say how it went.
// Staged on the SYNTHETIC maps (`tests/support/synthetic.ts`), so what is
// measured is the sled and nothing the generator happened to build: a drag
// strip of packed snow or of powder, and the stadium with its kicker, its
// hills and its lone tree.
//
// A scenario is:
//   id, title       the name on the command line and over the picture
//   level(S)        the map, off the synthetic module `S`
//   place(S)        the moment (`RunMoment`)
//   seconds         how long it is ridden
//   input(t, st)    the controls at run time t, s since the start
//   view            "profile" (distance along the way against height) or
//                   "plan" (the path from above)
//   measure(run)    the scenario's own numbers, as [label, value] pairs,
//                   off the recorded run (see `ride-lab.mjs`'s `record`)
//   mode            optional: the mode whose rules the run is dealt — the
//                   trick scenarios ride "tricks", so the strokes are read
//   snow            optional: the run's snow dial (`SNOW_DIAL`) — the deep
//                   scenarios ride a metre of fresh snow (2.5)

const FULL = { steer: 0, throttle: 1, brake: 0, lean: 0, reset: false };
const IDLE = { steer: 0, throttle: 0, brake: 0, lean: 0, reset: false };

/** The first time a recorded run reached `kmh`, s, or null. */
function timeTo(run, kmh) {
  const f = run.frames.find((f) => f.speed * 3.6 >= kmh);
  return f ? f.t : null;
}

/** THE GOVERNOR: throttle and brake that hold a sled at `kmh` — a firm
 * proportional hand on the lever, with the brake only for a real overshoot.
 * A turn measured at "60 km/h" on a fixed throttle drifts to whatever speed
 * that throttle finds in the bend, and the radius goes as the speed squared,
 * so a figure taken without it is a figure about the throttle. */
function hold(st, kmh) {
  const err = kmh / 3.6 - st.sled.speed;
  return {
    throttle: Math.min(1, Math.max(0, 0.35 + 0.5 * err)),
    brake: Math.min(1, Math.max(0, -0.5 * err - 0.4)),
  };
}

/** The mean of `f` over the frames from `from` s to the end. */
function tail(run, from, f) {
  const fs = run.frames.filter((x) => x.t >= from);
  return fs.reduce((s, x) => s + f(x), 0) / Math.max(1, fs.length);
}

const fmt = (v, d = 2) => (v === null || v === undefined ? "—" : Number(v).toFixed(d));

function accel(run) {
  const top = Math.max(...run.frames.map((f) => f.speed));
  const t100 = timeTo(run, 100);
  const at100 = run.frames.find((f) => f.speed * 3.6 >= 100);
  return [
    ["0-50 km/h s", fmt(timeTo(run, 50))],
    ["0-100 km/h s", fmt(t100)],
    ["to 100 m", at100 ? fmt(at100.dist, 0) : "—"],
    ["top km/h", fmt(top * 3.6, 1)],
    ["slip at top m/s", fmt(run.frames[run.frames.length - 1].slip, 2)],
  ];
}

function turn(run) {
  // The radius off the last three seconds of the path: the circle through
  // three points a second and a half apart.
  const fs = run.frames;
  const pick = (t) => fs.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
  const end = fs[fs.length - 1].t;
  const a = pick(end - 3);
  const b = pick(end - 1.5);
  const c = pick(end);
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  const ux =
    ((a.x ** 2 + a.z ** 2) * (b.z - c.z) +
      (b.x ** 2 + b.z ** 2) * (c.z - a.z) +
      (c.x ** 2 + c.z ** 2) * (a.z - b.z)) /
    d;
  const uz =
    ((a.x ** 2 + a.z ** 2) * (c.x - b.x) +
      (b.x ** 2 + b.z ** 2) * (a.x - c.x) +
      (c.x ** 2 + c.z ** 2) * (b.x - a.x)) /
    d;
  const radius = Math.hypot(a.x - ux, a.z - uz);
  const v = c.speed;
  return [
    ["radius m", fmt(radius, 1)],
    ["speed km/h", fmt(v * 3.6, 1)],
    ["lateral g", fmt((v * v) / radius / 9.81, 2)],
    ["roll deg", fmt(c.roll * 57.3, 1)],
    ["resets", run.events.filter((e) => e.kind === "reset").length],
  ];
}

function flight(run) {
  const lands = run.events.filter((e) => e.kind === "land");
  const air = run.events.find((e) => e.kind === "air");
  const first = lands[0];
  const launch = run.frames.find((f) => f.airborne);
  const touch = launch ? run.frames.find((f) => f.t > launch.t && !f.airborne) : null;
  const peak = run.frames.reduce((m, f) => Math.max(m, f.y - f.ground), 0);
  return [
    ["launch km/h", air ? fmt(air.speed * 3.6, 1) : "—"],
    ["air s", first ? fmt(first.airTime) : "—"],
    ["carry m", launch && touch ? fmt(touch.dist - launch.dist, 1) : "—"],
    ["peak m", fmt(peak - 0.55, 2)],
    ["impact m/s", first ? fmt(first.impact) : "—"],
    ["harsh", first ? (first.harsh ? `yes -${Math.round(first.lost * 100)}%` : "no") : "—"],
    ["land pitch deg", touch ? fmt(touch.pitch * 57.3, 1) : "—"],
    ["out km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 1)],
  ];
}

/** THE WIPEOUT's numbers: what put him off and when, how fast the sled was
 * going, how far he slid from where he left it, the sled's own way on after
 * it, and when the reset stood them up. */
function wipeout(run) {
  const off = run.events.find((e) => e.kind === "wipeout");
  const reset = run.events.find((e) => e.kind === "reset" && (!off || e.t > off.t));
  const lying = off ? run.frames.filter((f) => f.t > off.t && f.thrown) : [];
  const last = lying[lying.length - 1];
  return [
    ["wipeout", off ? `${off.cause} at ${fmt(off.t)} s` : "no"],
    ["at km/h", off ? fmt(off.speed * 3.6, 1) : "—"],
    ["rider slid m", last ? fmt(Math.hypot(last.rx - off.x, last.rz - off.z), 1) : "—"],
    ["tumbled turns", last ? fmt(Math.abs(last.tumble) / (2 * Math.PI), 1) : "—"],
    ["reset at s", reset ? fmt(reset.t) : "—"],
  ];
}

/** A sled rocked back and forth: the lean thrown fore and aft and the
 * bars side to side, `hz` times a second, on `throttle`. */
function rock(t, hz, throttle) {
  const s = Math.sin(2 * Math.PI * hz * t) >= 0 ? 1 : -1;
  return { steer: s, throttle, brake: 0, lean: s, reset: false };
}

/** Which phase of the rocking scenario a run is in, per run. */
const dug = new WeakMap();

/** THE TRENCH's numbers: when it was trenched, how deep it got, when it was
 * out and moving again, and whether the engine had to reset it. */
function trench(run) {
  const stuck = run.events.find((e) => e.kind === "stuck");
  const deepest = run.frames.reduce((m, f) => Math.max(m, f.trench), 0);
  // Two moments, because they are two different things: the hole PACKED
  // BACK by the rocking (the trench's own mechanic), and the sled RIDDEN
  // OFF — which also asks whether the face it nosed into lets it turn away.
  const packed = stuck ? run.frames.find((f) => f.t > stuck.t && f.trench === 0) : null;
  const out = stuck ? run.frames.find((f) => f.t > stuck.t && f.trench === 0 && f.speed > 2) : null;
  return [
    ["trenched at s", stuck ? fmt(stuck.t) : "—"],
    ["deepest m", fmt(deepest, 3)],
    ["packed back at s", packed ? fmt(packed.t) : "—"],
    ["rode off at s", out ? fmt(out.t) : "—"],
    ["resets", run.events.filter((e) => e.kind === "reset").length],
  ];
}

/** THE SCORE's numbers (`tricks.ts`): what was won, how the flight ended,
 * and what the combo came to. */
function tricked(run) {
  const land = run.events.find((e) => e.kind === "land");
  const won = run.events.filter((e) => e.kind === "trick").map((e) => e.trick);
  const combo = run.events.find((e) => e.kind === "combo");
  const bail = run.events.find((e) => e.kind === "bail");
  const touch = land ? run.frames.find((f) => f.t >= land.t) : null;
  return [
    ["air s", land ? fmt(land.airTime) : "—"],
    ["won", won.length ? won.join("+") : "nothing"],
    ["land pitch deg", touch ? fmt(touch.pitch * 57.3, 1) : "—"],
    ["impact m/s", land ? `${fmt(land.impact)}${land.harsh ? " harsh" : ""}` : "—"],
    [
      "combo",
      bail
        ? `lost ${bail.lost} (${bail.cause})`
        : combo
          ? `${combo.base} × ${combo.mult} = ${combo.points}${combo.sketchy ? " sketchy" : ""}`
          : "—",
    ],
  ];
}

/** A METRE OF FRESH SNOW: the snow dial at its deepest (`SNOW_DIAL.max`,
 * `snow.deep.full`), where the powder is bottomless. */
const DEEP = 2.5;

/** The first time after `from` s that the tread's sink came up under
 * `under` m — the moment the sled climbed onto the top of the snow — as
 * [time, speed], or null. */
function planedAfter(run, from, under = 0.05) {
  const f = run.frames.find((x) => x.t >= from && x.sink < under);
  return f ? [f.t, f.speed] : null;
}

/** A deep run's numbers: the speed at 10 s and at the end, when it came
 * up onto the top, and the deepest it sank on the way. */
function deepAccel(run) {
  const at = (t) => run.frames.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
  const planed = planedAfter(run, 0);
  return [
    ["at 10 s km/h", fmt(at(10).speed * 3.6, 0)],
    ["at end km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 0)],
    ["planed at s", planed ? fmt(planed[0], 1) : "—"],
    ["planed km/h", planed ? fmt(planed[1] * 3.6, 0) : "—"],
  ];
}

/** Held at `kmh` on the lever, as a rider would on a traverse. */
function cruise(st, kmh) {
  return { ...FULL, ...hold(st, kmh) };
}

/** The balance's numbers: the worst roll off the snow's plane, whether it
 * went over and when, and how far it got. */
function balance(run) {
  const over = run.frames.find((f) => Math.abs(f.roll) > 1.2);
  const upright = over ? run.frames.filter((f) => f.t < over.t) : run.frames;
  const worst = upright.reduce((m, f) => Math.max(m, Math.abs(f.roll)), 0);
  const last = (over ?? run.frames[run.frames.length - 1]).dist;
  return [
    ["worst roll deg", fmt(worst * 57.3, 0)],
    ["over at s", over ? fmt(over.t, 1) : "no"],
    ["ridden m", fmt(last, 0)],
  ];
}

/** A flight a kicker would have thrown, staged in the air over packed snow:
 * 1.2 m up, climbing 8.5 m/s, at 80 km/h — about 1.9 s up. */
const LAUNCH = { x: 1500, z: 200, heading: 0, speed: 22, height: 1.2, vy: 8.5 };

/** A trick scenario: the staged launch, ridden in a tricks run. */
function trick(id, title, input) {
  return {
    id,
    title,
    mode: "tricks",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => LAUNCH,
    seconds: 4,
    view: "profile",
    input: (t) => ({ ...FULL, ...input(t) }),
    measure: tricked,
  };
}

export const SCENARIOS = [
  {
    id: "rest",
    title: "at rest on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["ski comp m", fmt(f.skiComp, 3)],
        ["tread comp m", fmt(f.treadComp, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
        ["drift m/s", fmt(f.speed, 3)],
      ];
    },
  },
  {
    id: "rest-powder",
    title: "at rest in powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
      ];
    },
  },
  {
    id: "accel",
    title: "full throttle from rest on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 150, heading: 0 }),
    seconds: 20,
    view: "profile",
    input: () => FULL,
    measure: accel,
  },
  {
    id: "accel-powder",
    title: "full throttle from rest in powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({ x: 1500, z: 150, heading: 0 }),
    seconds: 25,
    view: "profile",
    input: () => FULL,
    measure: (run) => {
      const rows = accel(run);
      const planed = run.frames.find((f) => f.sink < 0.05);
      rows.push(["planed at km/h", planed ? fmt(planed.speed * 3.6, 0) : "—"]);
      return rows;
    },
  },
  {
    id: "brake",
    title: "full brake from 100 km/h on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 100 / 3.6 }),
    seconds: 6,
    view: "profile",
    input: () => ({ ...IDLE, brake: 1 }),
    measure: (run) => {
      const stop = run.frames.find((f) => f.speed < 0.3);
      return [
        ["stop s", stop ? fmt(stop.t) : "—"],
        ["stop m", stop ? fmt(stop.dist, 1) : "—"],
        ["mean g", stop ? fmt(100 / 3.6 / stop.t / 9.81, 2) : "—"],
      ];
    },
  },
  {
    id: "turn",
    title: "full lock at 60 km/h on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 60 / 3.6 }),
    seconds: 8,
    view: "plan",
    input: (t, st) => ({ ...FULL, steer: 1, ...hold(st, 60) }),
    measure: turn,
  },
  {
    id: "turn-fast",
    title: "full lock at 100 km/h on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 100 / 3.6 }),
    seconds: 6,
    view: "plan",
    input: (t, st) => ({ ...FULL, steer: 1, ...hold(st, 100) }),
    measure: turn,
  },
  {
    id: "turn-in",
    title: "the bars thrown to full lock at 80 km/h on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 80 / 3.6 }),
    seconds: 5,
    view: "plan",
    input: (t, st) => ({ ...FULL, steer: t >= 0.5 ? 1 : 0, ...hold(st, 80) }),
    // HOW QUICKLY IT ANSWERS THE BARS: the time from the bars going over to
    // nine tenths of the yaw rate it settles at, how far round it has come a
    // second after, and the lateral g it settles at — the three numbers that
    // separate a sled that darts from one that pushes.
    measure: (run) => {
      const settled = tail(run, 3.5, (f) => f.wy);
      const at = run.frames.find((f) => f.t >= 0.5 && Math.abs(f.wy) >= 0.9 * Math.abs(settled));
      const h0 = run.frames.find((f) => f.t >= 0.5).heading;
      const h1 = run.frames.find((f) => f.t >= 1.5).heading;
      let turned = h1 - h0;
      turned = Math.atan2(Math.sin(turned), Math.cos(turned));
      const v = tail(run, 3.5, (f) => f.speed);
      return [
        ["to 90% yaw s", at ? fmt(at.t - 0.5) : "—"],
        ["turned in 1 s deg", fmt(Math.abs(turned) * 57.3, 0)],
        ["settled g", fmt((v * Math.abs(settled)) / 9.81, 2)],
        ["radius m", fmt(v / Math.abs(settled), 1)],
        ["roll deg", fmt(tail(run, 3.5, (f) => f.roll) * 57.3, 1)],
      ];
    },
  },
  ...[
    ["turn-power", "full throttle", { throttle: 1, brake: 0 }],
    ["turn-lift", "the throttle shut", { throttle: 0, brake: 0 }],
    ["turn-brake", "the brake on", { throttle: 0, brake: 1 }],
  ].map(([id, what, lever]) => ({
    id,
    title: `settled in a 70 km/h bend at 0.6 lock, then ${what}`,
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 70 / 3.6 }),
    seconds: 5,
    view: "plan",
    // THE LEVER IN A BEND: three seconds settled at a governed speed, then
    // the lever for a second and a half. Throttle unloads the skis and
    // spends the belt's grip driving, so the nose pushes and the tail
    // walks; the throttle shut and the brake load the skis, and a LOCKED
    // belt slides whichever way the sled is going. What moved is read at
    // the end of the lever against the settled bend.
    input: (t, st) => ({ ...FULL, steer: 0.6, ...(t < 3 ? hold(st, 70) : lever) }),
    measure: (run) => {
      const before = run.frames.filter((f) => f.t > 2.5 && f.t <= 3);
      const after = run.frames.filter((f) => f.t > 3 && f.t <= 4.5);
      const mean = (fs, g) => fs.reduce((sum, f) => sum + g(f), 0) / Math.max(1, fs.length);
      let slip = 0;
      for (let i = 1; i < after.length; i++) {
        const a = after[i - 1];
        const b = after[i];
        const way = Math.atan2(b.x - a.x, b.z - a.z);
        const d = Math.atan2(Math.sin(b.heading - way), Math.cos(b.heading - way));
        if (Math.abs(d) > Math.abs(slip)) slip = d;
      }
      const ski0 = mean(before, (f) => f.skiLoad);
      const ski1 = mean(after.slice(-60), (f) => f.skiLoad);
      const yaw0 = mean(before, (f) => f.wy);
      const yaw1 = mean(after.slice(-60), (f) => f.wy);
      const v1 = mean(after.slice(-60), (f) => f.speed);
      return [
        ["ski load %", `${fmt(ski0 * 100, 0)}→${fmt(ski1 * 100, 0)}`],
        ["yaw deg/s", `${fmt(yaw0 * 57.3, 0)}→${fmt(yaw1 * 57.3, 0)}`],
        ["radius m", `${fmt(70 / 3.6 / Math.abs(yaw0), 0)}→${fmt(v1 / Math.abs(yaw1), 0)}`],
        ["worst tail slip deg", fmt(slip * 57.3, 0)],
        ["speed km/h", fmt(v1 * 3.6, 0)],
      ];
    },
  })),
  {
    id: "brake-turn",
    title: "braking hard into a turn from 100 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 100 / 3.6 }),
    seconds: 5,
    view: "plan",
    input: (t) => ({ ...IDLE, brake: 1, steer: t > 0.3 ? 0.6 : 0 }),
    measure: (run) => {
      // THE SLIP ANGLE: how far the nose has come round off the way the sled
      // is actually going, while it is still going anywhere.
      let slip = 0;
      for (let i = 1; i < run.frames.length; i++) {
        const a = run.frames[i - 1];
        const b = run.frames[i];
        if (b.speed < 3) continue;
        const way = Math.atan2(b.x - a.x, b.z - a.z);
        let d = Math.abs(b.heading - way) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > slip) slip = d;
      }
      const stop = run.frames.find((f) => f.speed < 0.3);
      return [
        ["worst slip deg", fmt(slip * 57.3, 0)],
        ["spun", slip > Math.PI / 3 ? "YES" : "no"],
        ["stop m", stop ? fmt(stop.dist, 1) : "—"],
      ];
    },
  },
  {
    id: "turn-powder",
    title: "full lock at 50 km/h in powder",
    level: (S) => S.flatLevel({ packed: 0 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 50 / 3.6 }),
    seconds: 8,
    view: "plan",
    input: (t, st) => ({ ...FULL, steer: 1, ...hold(st, 50) }),
    measure: turn,
  },
  {
    id: "kicker",
    title: "the stadium's kicker at 75 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({
      x: S.STADIUM.kickerX + 70,
      z: S.STADIUM.zMid + S.STADIUM.radius,
      heading: -Math.PI / 2,
      speed: 75 / 3.6,
    }),
    seconds: 6,
    view: "profile",
    input: () => FULL,
    measure: flight,
  },
  {
    id: "kicker-slow",
    title: "the stadium's kicker at 45 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({
      x: S.STADIUM.kickerX + 50,
      z: S.STADIUM.zMid + S.STADIUM.radius,
      heading: -Math.PI / 2,
      speed: 45 / 3.6,
    }),
    seconds: 6,
    view: "profile",
    input: (t, st) => ({ ...FULL, throttle: st.sled.speed * 3.6 < 45 ? 0.6 : 0.2 }),
    measure: flight,
  },
  {
    id: "drop",
    title: "dropped from 3 m at 70 km/h onto flat packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 3.55 }),
    seconds: 4,
    view: "profile",
    input: () => FULL,
    measure: flight,
  },
  {
    id: "climb",
    title: "a 30-degree powder slope taken at 70 km/h",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.58, slopeFrom: 400 }),
    place: () => ({ x: 1500, z: 250, heading: 0, speed: 70 / 3.6 }),
    seconds: 12,
    view: "profile",
    input: () => FULL,
    measure: (run) => {
      const top = run.frames.reduce((b, f) => (f.y > b.y ? f : b));
      return [
        ["highest m", fmt(top.ground, 1)],
        ["stalled at s", fmt(run.frames.find((f) => f.t > 1 && f.speed < 1)?.t ?? null)],
        ["resets", run.events.filter((e) => e.kind === "reset").length],
      ];
    },
  },
  {
    id: "wall",
    title: "a 45-degree powder face taken at 90 km/h",
    level: (S) => S.flatLevel({ packed: 0, grade: 1, slopeFrom: 400 }),
    place: () => ({ x: 1500, z: 250, heading: 0, speed: 90 / 3.6 }),
    seconds: 10,
    view: "profile",
    input: () => FULL,
    measure: (run) => {
      const top = run.frames.reduce((b, f) => (f.y > b.y ? f : b));
      return [
        ["highest m", fmt(top.ground, 1)],
        ["stalled at s", fmt(run.frames.find((f) => f.t > 1 && f.speed < 1)?.t ?? null)],
        ["resets", run.events.filter((e) => e.kind === "reset").length],
      ];
    },
  },
  {
    id: "sidehill",
    title: "across a 40-degree slope at 40 km/h",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.84, slopeFrom: 400 }),
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 40 / 3.6 }),
    seconds: 6,
    view: "plan",
    input: () => ({ ...FULL, throttle: 0.5 }),
    measure: (run) => {
      const worst = run.frames.reduce((m, f) => Math.max(m, Math.abs(f.roll)), 0);
      return [
        ["worst roll deg", fmt(worst * 57.3, 0)],
        ["over", worst > 1.4 ? "yes" : "no"],
        ["slid down m", fmt(440 - run.frames[run.frames.length - 1].z, 1)],
      ];
    },
  },
  {
    id: "tree",
    title: "a trunk met at 50 km/h",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x + 0.4, z: S.LONE_TREE.z - 40, heading: 0, speed: 50 / 3.6 }),
    seconds: 7,
    view: "plan",
    input: () => FULL,
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      const after = hit ? run.frames.find((f) => f.t > hit.t + 0.05) : null;
      return [
        ["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"],
        ["after km/h", after ? fmt(after.speed * 3.6, 1) : "—"],
        ["yaw after deg", after ? fmt(after.heading * 57.3, 1) : "—"],
        ...wipeout(run).filter(([k]) => k !== "at km/h"),
      ];
    },
  },
  {
    id: "tree-glance",
    title: "a trunk clipped at 25 km/h — held on to",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({ x: S.LONE_TREE.x + 0.7, z: S.LONE_TREE.z - 20, heading: 0, speed: 25 / 3.6 }),
    seconds: 4,
    view: "plan",
    input: (t, st) => ({ ...FULL, throttle: st.sled.speed * 3.6 < 25 ? 0.5 : 0.1 }),
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      return [["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "nose-in",
    title: "a landing taken 40 degrees nose-down at 60 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -0.7,
    }),
    seconds: 6,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const land = run.events.find((e) => e.kind === "land");
      return [["impact m/s", land ? fmt(land.impact) : "—"], ...wipeout(run)];
    },
  },
  {
    id: "rollover",
    title: "thrown onto its side at 70 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 1.6, roll: 1.35 }),
    seconds: 6,
    view: "plan",
    input: () => FULL,
    measure: wipeout,
  },
  {
    id: "stuck",
    title: "nosed into a powder bank, then rocked out",
    level: (S) => S.flatLevel({ packed: 0, grade: 1, slopeFrom: 400 }),
    place: () => ({ x: 1500, z: 397, heading: 0.5 }),
    seconds: 12,
    view: "profile",
    // Pinned until it has dug itself 15 cm in, then rocked on a part
    // throttle until the hole is packed back, then turned away and ridden.
    input: (t, st) => {
      const c = st.sled;
      if (!dug.has(st) && c.trench >= 0.15) dug.set(st, "rock");
      if (dug.get(st) === "rock" && c.trench === 0) dug.set(st, "away");
      const phase = dug.get(st);
      return phase === "rock"
        ? rock(t, 1.2, 0.35)
        : phase === "away"
          ? { ...FULL, steer: 1 }
          : FULL;
    },
    measure: trench,
  },
  {
    id: "stuck-held",
    title: "nosed into a powder bank, throttle pinned",
    level: (S) => S.flatLevel({ packed: 0, grade: 1, slopeFrom: 400 }),
    place: () => ({ x: 1500, z: 397, heading: 0 }),
    seconds: 14,
    view: "profile",
    input: () => FULL,
    measure: trench,
  },
  {
    id: "rest-deep",
    title: "at rest in a metre of fresh snow",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    view: "profile",
    input: () => IDLE,
    measure: (run) => {
      const f = run.frames[run.frames.length - 1];
      return [
        ["CoG over snow m", fmt(f.y - f.ground, 3)],
        ["sink m", fmt(f.sink, 3)],
        ["pitch deg", fmt(f.pitch * 57.3, 2)],
      ];
    },
  },
  {
    id: "accel-deep",
    title: "full throttle from rest in a metre of fresh snow",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 150, heading: 0 }),
    seconds: 20,
    view: "profile",
    input: () => FULL,
    measure: deepAccel,
  },
  {
    id: "accel-deep-back",
    title: "full throttle from rest in a metre, leaning back to lift the nose",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 150, heading: 0 }),
    seconds: 20,
    view: "profile",
    input: () => ({ ...FULL, lean: 1 }),
    measure: deepAccel,
  },
  {
    id: "bog-deep",
    title: "planing through a metre at 70 km/h, off the throttle 4 s, then pinned",
    level: (S) => S.flatLevel({ packed: 0 }),
    snow: DEEP,
    place: () => ({ x: 1500, z: 150, heading: 0, speed: 70 / 3.6 }),
    seconds: 16,
    view: "profile",
    input: (t) => (t >= 2 && t < 6 ? IDLE : FULL),
    measure: (run) => {
      const low = run.frames.filter((f) => f.t >= 6).reduce((b, f) => (f.speed < b.speed ? f : b));
      const deepest = run.frames.reduce((m, f) => Math.max(m, f.sink), 0);
      const planed = planedAfter(run, 6);
      return [
        ["slowest km/h", fmt(low.speed * 3.6, 0)],
        ["deepest sink m", fmt(deepest, 2)],
        ["back on top at s", planed ? fmt(planed[0], 1) : "—"],
        ["at end km/h", fmt(run.frames[run.frames.length - 1].speed * 3.6, 0)],
      ];
    },
  },
  {
    id: "sidehill-deep",
    title: "across a 10-degree slope in a metre at 20 km/h, hands off",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 }),
    snow: DEEP,
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 }),
    seconds: 8,
    view: "plan",
    input: (t, st) => cruise(st, 20),
    measure: balance,
  },
  {
    id: "sidehill-deep-held",
    title: "the same traverse, the rider's weight on the uphill board",
    level: (S) => S.flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 }),
    snow: DEEP,
    place: () => ({ x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 }),
    seconds: 8,
    view: "plan",
    // Heading +x the slope rises to the left, and a sled rolled right is
    // rolled downhill: the rider hangs his weight uphill (the bars toward
    // it) as far as the sled is leaning over, to keep it level.
    input: (t, st) => ({
      ...cruise(st, 20),
      steer: Math.max(-1, Math.min(1, -3 * st.sled.roll - 0.3 * st.sled.wz)),
    }),
    measure: balance,
  },
  trick("backflip", "a backflip off a staged launch over flat snow", (t) => ({
    lean: t < 1.2 ? 1 : 0,
  })),
  trick("frontflip", "a front flip over flat snow: the lean forward, a stab of brake", (t) => ({
    lean: t < 1 ? -1 : 0,
    throttle: 0,
    brake: t < 0.55 ? 1 : 0,
  })),
  trick("spin", "a 360 over flat snow: the bars thrown over", (t) => ({ steer: t < 0.4 ? 1 : 0 })),
  trick("pose", "a can-can over flat snow, let go before the landing", (t) => ({
    trick: t < 0.8,
    lean: t < 0.8 ? 1 : 0,
  })),
  {
    id: "kicker-flip",
    title: "the stadium's kicker at 75 km/h, a backflip off it",
    mode: "tricks",
    level: (S) => S.syntheticLevel(),
    place: (S) => ({
      x: S.STADIUM.kickerX + 70,
      z: S.STADIUM.zMid + S.STADIUM.radius,
      heading: -Math.PI / 2,
      speed: 75 / 3.6,
    }),
    seconds: 6,
    view: "profile",
    // The lean held from the foot of the ramp — one stroke at the lip — and
    // let go past half a turn; the brake's gyro checks the last quarter.
    input: (t, st) => {
      const turned = st.tricks.rotation;
      return { ...FULL, lean: turned < 3.5 && t < 3.2 ? 1 : 0, brake: turned > 5 ? 1 : 0 };
    },
    measure: tricked,
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
