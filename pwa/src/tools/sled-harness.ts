// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED LAB's page (driven by `scripts/sled-preview.mjs`): every machine
// and its rider built with the game's own builder (`createSledModel`) and
// drawn onto one labelled CONTACT SHEET, a cell a view. It exists because a
// machine and a rider are judged by LOOKING, and neither the race (one frame
// of one camera) nor the world lab (a run the bot happened to ride) can hold
// the rider in an exact pose from an exact side. Three sheets:
//
//   machines   every machine, half standing on the move, from the side, the
//              front, the rear, three-quarters and the chase camera's place
//   poses      one machine (`sled=`) in every pose the rider takes — sat,
//              on the move, hung off either way, in the air, folded by a
//              landing, thrown back and forward, the tricks — by view
//   liveries   every machine in each of its liveries (`sled-liveries.ts`),
//              three-quarters on and from the side
//   rider      the rider CLOSE UP on one machine, in the poses that read
//              most (sat, on the move, hung off, in the air, landed), from
//              behind at the chase camera's height, the rear three-quarter,
//              the side and the front three-quarter — the man judged as a
//              man rather than as sixty pixels on a machine
//   landing    one machine landing: the rider's body on its legs
//              (`stepRiderSpring`) kicked by a sled stopped dead from
//              `vy` m/s, a frame every 60 ms, from the side and the rear
//
// The elevations (side, front, rear) are ORTHOGRAPHIC — a drawing, the
// scale the traced profiles in `sled-body.ts` are stated at — with a metre
// grid behind them; the three-quarter and chase views are the lens's.

import * as THREE from "three";
import { freshSled, SLED, SLEDS, sledById, type SledSpec, type SledState } from "@engine";

import { createRiderSpring, stepRiderSpring, type RiderSpring } from "../game/rider-pose.ts";
import {
  createSledModel,
  REST_SAG,
  SLED_STYLES,
  styleIn,
  type SledModel,
} from "../game/sled-body.ts";
import { LIVERIES } from "../game/sled-liveries.ts";

type Sheet = "machines" | "poses" | "landing" | "liveries" | "rider";
type View =
  "side" | "front" | "rear" | "three" | "chase" | "top" | "back" | "back3" | "near" | "front3";

declare global {
  interface Window {
    __sled?: { ready: Promise<void>; sheet(): { rows: number; cols: number; note: string } };
  }
}

const params = new URLSearchParams(location.search);
const sheet = (params.get("sheet") ?? "machines") as Sheet;
const cell = Number(params.get("cell") ?? 300);
const spec = sledById(params.get("sled") ?? SLED.id);
const slot = Number(params.get("slot") ?? 0) % SLED_STYLES.length;
const landVy = Number(params.get("vy") ?? 6);
const onlyViews = (params.get("views") ?? "").split(",").filter(Boolean) as View[];

/** The moments the rider sheet shows him close up in. */
const RIDER_POSES = ["sat", "on the move", "hung off left", "in the air", "landed, folded"];

/** A moment to pose the rider at: what the engine would report. */
type Moment = {
  name: string;
  steer?: number;
  lean?: number;
  airborne?: boolean;
  /** The body on its legs, stepped to this state. */
  stand?: number;
  bump?: number;
  trick?: "oneFoot" | "canCan" | "tuck";
  /** The machine rolled, rad (a hang is ridden rolled into the turn). */
  roll?: number;
};

const POSES: Moment[] = [
  { name: "sat", stand: 0 },
  { name: "on the move", stand: 0.62 },
  { name: "hung off left", stand: 0.62, steer: -1 },
  { name: "hung off right", stand: 0.62, steer: 1 },
  { name: "in the air", stand: 1, airborne: true, lean: 0.25 },
  { name: "landed, folded", stand: 1, bump: 0.2 },
  { name: "thrown back", stand: 0.62, lean: 1 },
  { name: "thrown forward", stand: 0.62, lean: -1 },
  { name: "one foot", stand: 1, airborne: true, trick: "oneFoot" },
  { name: "can-can", stand: 1, airborne: true, trick: "canCan" },
];

const VIEWS_OF: Record<Sheet, View[]> = {
  machines: ["side", "front", "rear", "three", "chase"],
  poses: ["side", "front", "rear", "chase"],
  landing: ["side", "rear"],
  liveries: ["three"],
  rider: ["back", "back3", "near", "front3"],
};

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const host = document.getElementById("sheet") as HTMLDivElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x8b95a3, 1.4));
const sun = new THREE.DirectionalLight(0xfff4e2, 2.4);
sun.position.set(4, 7, 3);
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
// A metre grid on the ground and, for the elevations, on a wall behind.
const grid = new THREE.GridHelper(40, 40, 0x9aa8b8, 0xc4ceda);
grid.position.y = 0.002;
scene.add(grid);
const wall = new THREE.GridHelper(40, 40, 0x9aa8b8, 0xc4ceda);
scene.add(wall);

const plain = <M extends THREE.Material>(m: M): M => m;
const models = new Map<string, SledModel>();
/** A machine built once per livery it is shown in (-1: the slot's own). */
function modelOf(s: SledSpec, livery = -1): SledModel {
  const key = `${s.id}:${livery}`;
  let m = models.get(key);
  if (!m) {
    const style =
      livery < 0 ? SLED_STYLES[slot] : styleIn(SLED_STYLES[slot], LIVERIES[s.id][livery]);
    m = createSledModel(s, style, plain);
    scene.add(m.root);
    models.set(key, m);
  }
  return m;
}

/** The engine's state for a machine at a moment, at rest on the flat. */
function stateAt(s: SledSpec, at: Moment): SledState {
  const c = freshSled(s);
  c.skiCompression[0] = c.skiCompression[1] = REST_SAG;
  c.treadCompression = REST_SAG;
  c.steer = at.steer ?? 0;
  c.skiAngle = (at.steer ?? 0) * s.skiLock * 0.6;
  c.lean = at.lean ?? 0;
  c.riderRight = (at.steer ?? 0) * s.riderReach;
  c.riderAft = (at.lean ?? 0) * 0.35;
  c.airborne = at.airborne ?? false;
  c.landing = 5;
  c.speed = 15;
  return c;
}

/** Pose one machine for a moment, the rider's legs at `legs`. */
function posed(s: SledSpec, at: Moment, legs: RiderSpring | null, livery = -1): SledModel {
  const m = modelOf(s, livery);
  for (const other of models.values()) other.root.visible = other === m;
  const c = stateAt(s, at);
  const roll = at.roll ?? 0;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
  // Pose with dt 0, so the model's own spring holds; then lay the rider by
  // hand at the moment's stand and fold.
  m.pose(c, { x: 0, y: s.cogHeight, z: 0, q: { x: q.x, y: q.y, z: q.z, w: q.w } }, 0, at.trick);
  m.poseRider({
    stand: legs ? legs.stand : (at.stand ?? 0.62),
    bump: legs ? legs.bump : (at.bump ?? 0),
    riderRight: c.riderRight,
    riderAft: c.riderAft,
    lean: c.lean,
    steer: c.steer,
    airborne: c.airborne,
    landing: c.landing,
    trick: at.trick ?? null,
  });
  return m;
}

const ortho = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 50);
const lens = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

/** The camera for a view of a machine, and where the wall grid stands. */
function camera(view: View, s: SledSpec): THREE.Camera {
  // The elevations are 5.2 m across (a machine is 3–3.6 m long, and a
  // rider hung off reaches past its width), centred on the machine's middle.
  const half = 2.6;
  const set = (x: number, y: number, z: number) => {
    ortho.left = -half;
    ortho.right = half;
    ortho.top = half * 0.75;
    ortho.bottom = -half * 0.75;
    ortho.position.set(x, y, z);
    ortho.lookAt(0, y, x === 0 ? (z > 0 ? -1 : 1) : -0.1);
    ortho.updateProjectionMatrix();
    return ortho;
  };
  wall.visible = view === "side" || view === "front" || view === "rear";
  if (view === "side") {
    wall.rotation.set(0, 0, Math.PI / 2);
    wall.position.set(-3, 0, 0);
    return set(10, 0.75, -0.1);
  }
  if (view === "front") {
    wall.rotation.set(Math.PI / 2, 0, 0);
    wall.position.set(0, 0, -4);
    return set(0, 0.75, 10);
  }
  if (view === "rear") {
    wall.rotation.set(Math.PI / 2, 0, 0);
    wall.position.set(0, 0, 4);
    return set(0, 0.75, -10);
  }
  lens.aspect = 4 / 3;
  // THE CLOSE-UPS, aimed at the rider's chest (about 0.7 m over the CoG).
  const chest = s.cogHeight + 0.7;
  if (view === "near") {
    // The side at a metre and a half across, centred on the rider.
    ortho.left = -0.95;
    ortho.right = 0.95;
    ortho.top = 0.71;
    ortho.bottom = -0.71;
    ortho.position.set(10, chest - 0.1, -0.2);
    ortho.lookAt(0, chest - 0.1, -0.2);
    ortho.updateProjectionMatrix();
    return ortho;
  }
  if (view === "back" || view === "back3" || view === "front3") {
    lens.fov = 30;
    const at = { back: [0, 1.75, -3.6], back3: [2.2, 1.55, -2.9], front3: [2.4, 1.5, 2.6] }[view];
    lens.position.set(at[0], s.cogHeight + at[1], at[2]);
    lens.lookAt(0, chest - 0.15, -0.2);
    lens.updateProjectionMatrix();
    return lens;
  }
  if (view === "three") {
    lens.fov = 32;
    lens.position.set(5.2, 2.6, 5.4);
    lens.lookAt(0, 0.55, -0.15);
  } else if (view === "top") {
    lens.fov = 32;
    lens.position.set(0, 11, -0.2);
    lens.lookAt(0, 0, -0.2);
  } else {
    // THE CHASE CAMERA's place (`camera-rigs.ts`: 5.2 m back, 1.9 m up,
    // aimed 7 m ahead at 0.7 m) — the view the machine is judged from.
    lens.fov = 62;
    lens.position.set(0, 1.9, -5.2 + s.treadRear - SLED.treadRear);
    lens.lookAt(0, 0.7, 7);
  }
  lens.updateProjectionMatrix();
  return lens;
}

type Cell = {
  spec: SledSpec;
  at: Moment;
  legs: RiderSpring | null;
  view: View;
  label: string;
  livery?: number;
};

function cells(): { rows: number; cols: number; list: Cell[] } {
  const views = VIEWS_OF[sheet].filter((v) => !onlyViews.length || onlyViews.includes(v));
  const list: Cell[] = [];
  if (sheet === "machines") {
    for (const s of SLEDS) {
      for (const view of views) {
        list.push({
          spec: s,
          at: POSES[1],
          legs: null,
          view,
          label: `${s.name} · ${s.kind} · ${view}`,
        });
      }
    }
    return { rows: SLEDS.length, cols: views.length, list };
  }
  if (sheet === "liveries") {
    const cols = Math.max(...SLEDS.map((s) => LIVERIES[s.id].length));
    for (const s of SLEDS) {
      for (let i = 0; i < cols; i++) {
        const l = LIVERIES[s.id][i];
        list.push({
          spec: s,
          at: POSES[1],
          legs: null,
          view: views[0] ?? "three",
          label: `${s.name} · ${l.name} · ${l.pattern}`,
          livery: i,
        });
      }
    }
    return { rows: SLEDS.length, cols, list };
  }
  if (sheet === "poses" || sheet === "rider") {
    const moments = sheet === "poses" ? POSES : POSES.filter((p) => RIDER_POSES.includes(p.name));
    for (const at of moments) {
      for (const view of views) {
        list.push({ spec, at, legs: null, view, label: `${spec.name} · ${at.name} · ${view}` });
      }
    }
    return { rows: moments.length, cols: views.length, list };
  }
  // THE LANDING: the body on its legs, stepped at 120 Hz through a sled
  // stopped dead from `landVy` m/s down, a frame every 60 ms.
  const frames: RiderSpring[] = [];
  const legs = createRiderSpring();
  legs.stand = 1;
  stepRiderSpring(legs, -landVy, 15, true, 1 / 120);
  for (let i = 0; i < 12; i++) {
    frames.push({ ...legs });
    for (let k = 0; k < 7; k++) stepRiderSpring(legs, 0, 15, false, 1 / 120);
  }
  for (const view of views) {
    frames.forEach((f, i) => {
      list.push({
        spec,
        at: { name: "landing" },
        legs: f,
        view,
        label: `${(i * 58).toString().padStart(3)} ms · fold ${(f.bump * 100).toFixed(0)} cm`,
      });
    });
  }
  return { rows: views.length, cols: frames.length, list };
}

function draw(): { rows: number; cols: number; note: string } {
  const { rows, cols, list } = cells();
  const w = cell;
  const h = Math.round(cell * 0.75);
  renderer.setSize(cols * w, rows * h, false);
  canvas.style.width = `${cols * w}px`;
  canvas.style.height = `${rows * h}px`;
  for (const old of host.querySelectorAll(".label")) old.remove();
  list.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * w;
    const y = (rows - 1 - row) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setClearColor(row % 2 === col % 2 ? 0x51606f : 0x5b6a79);
    posed(c.spec, c.at, c.legs, c.livery ?? -1);
    renderer.render(scene, camera(c.view, c.spec));
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = c.label;
    label.style.left = `${x + 6}px`;
    label.style.top = `${row * h + 4}px`;
    host.appendChild(label);
  });
  return { rows, cols, note: `${sheet}${sheet === "machines" ? "" : ` · ${spec.name}`}` };
}

window.__sled = { ready: Promise.resolve(), sheet: draw };
