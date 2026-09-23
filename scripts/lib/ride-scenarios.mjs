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

const FULL = { steer: 0, throttle: 1, brake: 0, lean: 0, reset: false };
const IDLE = { steer: 0, throttle: 0, brake: 0, lean: 0, reset: false };

/** The first time a recorded run reached `kmh`, s, or null. */
function timeTo(run, kmh) {
  const f = run.frames.find((f) => f.speed * 3.6 >= kmh);
  return f ? f.t : null;
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
    input: (t, st) => ({ ...FULL, steer: 1, throttle: st.sled.speed * 3.6 < 60 ? 0.7 : 0.25 }),
    measure: turn,
  },
  {
    id: "turn-fast",
    title: "full lock at 100 km/h on packed snow",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 400, heading: 0, speed: 100 / 3.6 }),
    seconds: 6,
    view: "plan",
    input: (t, st) => ({ ...FULL, steer: 1, throttle: st.sled.speed * 3.6 < 100 ? 1 : 0.4 }),
    measure: turn,
  },
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
    input: (t, st) => ({ ...FULL, steer: 1, throttle: st.sled.speed * 3.6 < 50 ? 1 : 0.5 }),
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
    seconds: 5,
    view: "plan",
    input: () => FULL,
    measure: (run) => {
      const hit = run.events.find((e) => e.kind === "hit");
      const after = hit ? run.frames.find((f) => f.t > hit.t + 0.05) : null;
      return [
        ["hit km/h", hit ? fmt(hit.speed * 3.6, 1) : "—"],
        ["after km/h", after ? fmt(after.speed * 3.6, 1) : "—"],
        ["yaw after deg", after ? fmt(after.heading * 57.3, 1) : "—"],
      ];
    },
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
