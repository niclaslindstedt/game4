// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MACHINES AS TRACED — each class of sled's silhouette, taken off a
// studio photograph of a real machine of that class seen square from the
// side (and its front and rear widths off the views beside it), traced
// point by point, drawn back over the photograph to check the line, and
// scaled by the class's published length. No make or model is kept: what
// is kept is the SHAPE of the class, in metres.
//
// Every side profile is stated in the TRACE'S OWN FRAME: z forward from the
// rearmost point of the tunnel (a flap may reach behind it, negative), y up
// from the snow under the belt. `lookFrame` carries that onto a machine's
// body frame (`defs/sled.ts`: x right, y up, z forward, the origin at the
// centre of gravity), pinning the traced ski's centre to the physics' ski
// line and the traced rear idler to the physics' tread end — so a drawn ski
// stands where the ski probe is and the drawn belt ends where the tread's
// does. The physics' ski line and belt run are themselves read off these
// traces (`defs/sled.ts`), so the map is a shift, stretched by next to
// nothing.
//
//   hood           the cowl as one closed outline: the nose at the bumper,
//                  over the hood to the screen, back along the dash, down
//                  the side panel, forward along the belly
//   screen         the windscreen's four corners (none on a mountain or a
//                  race sled), and its width
//   grip, post     the right grip and the steering post's foot
//   seat           the seat's top line, back to front, over `seatBase`
//   tailbox ...    what rides behind the rider: a tail pack, a cargo box and
//                  its rail, a passenger's backrest and grab handle, a trunk
//   tunnel*        the tunnel's top and bottom edges, and its width
//   ski, spindle   one ski's profile, tail to tip, and its spindle
//   trackUp        the belt's upper run climbing from the rear idler
//   idler, sprocket, contact   the rear wheel, the drive, the belt's run
//   boards         the running boards' stretch, and whether they are rails
//   lamps          the headlamps' pair: their spread, height and place
//
// Three-free: the builder (`sled-body.ts`, `sled-gear.ts`) reads it, and
// `tests/sled_look_test.ts` holds every machine's trace to its spec.

import type { SledId, SledSpec } from "@engine";

type P = [number, number];

export type SledLook = {
  hood: P[];
  hoodWidth: number;
  noseWidth: number;
  screen: { base: P; top: P; back: P; foot: P; width: number } | null;
  grip: P;
  post: P;
  barWidth: number;
  /** A mountain sled's loop over the bar's middle: its width and rise, m. */
  handle?: { width: number; height: number };
  seat: P[];
  seatBase: number;
  tailbox?: P[];
  backrest?: P[];
  cargo?: P[];
  rack?: P[];
  luggage?: P[];
  grabHandle?: P[];
  mirror?: P[];
  flap?: P[];
  tunnelTop: P[];
  tunnelBottom: P[];
  tunnelWidth: number;
  ski: P[];
  spindle: P[];
  trackUp: P[];
  /** The belt's run on the snow, rear and front, z. */
  contact: P;
  idler: { at: P; radius: number };
  sprocket: { at: P; radius: number };
  boards: { from: number; to: number; open: boolean };
  taillight: P[];
  lamps: { width: number; y: number; z: number };
  bumperWidth: number;
  /** Race number plates on the hood's flanks and nose. */
  plates?: true;
};

export const SLED_LOOKS: Record<SledId, SledLook> = {
  fox: {
    hood: [
      [2.767, 0.64],
      [2.584, 0.823],
      [2.235, 0.933],
      [1.859, 0.887],
      [1.765, 0.798],
      [1.722, 0.527],
      [1.727, 0.266],
      [2.181, 0.265],
      [2.223, 0.463],
      [2.427, 0.38],
      [2.651, 0.384],
      [2.709, 0.515],
      [2.808, 0.541],
    ],
    hoodWidth: 0.78,
    noseWidth: 0.5,
    screen: {
      base: [2.584, 0.828],
      top: [2.418, 1.053],
      back: [2.303, 1.032],
      foot: [2.235, 0.938],
      width: 0.38,
    },
    grip: [1.922, 1.117],
    post: [1.968, 0.918],
    barWidth: 0.74,
    seat: [
      [1.07, 0.889],
      [1.243, 0.873],
      [1.399, 0.851],
      [1.556, 0.83],
      [1.712, 0.809],
      [1.765, 0.788],
    ],
    seatBase: 0.606,
    tailbox: [
      [0.814, 0.571],
      [0.825, 0.753],
      [1.06, 0.774],
      [1.07, 0.883],
    ],
    flap: [
      [0.016, 0.687],
      [-0.063, 0.515],
      [-0.09, 0.285],
      [-0.064, 0.217],
    ],
    tunnelTop: [
      [0.0, 0.729],
      [0.146, 0.697],
      [0.459, 0.644],
      [0.825, 0.571],
    ],
    tunnelBottom: [
      [0.13, 0.598],
      [0.824, 0.44],
      [1.451, 0.334],
    ],
    tunnelWidth: 0.42,
    ski: [
      [2.076, 0.067],
      [2.113, 0.015],
      [2.781, 0.013],
      [2.938, 0.086],
      [3.084, 0.201],
    ],
    spindle: [
      [2.426, 0.145],
      [2.354, 0.327],
    ],
    trackUp: [
      [0.26, 0.248],
      [0.652, 0.477],
    ],
    contact: [0.223, 1.528],
    idler: { at: [0.26, 0.149], radius: 0.099 },
    sprocket: { at: [1.607, 0.345], radius: 0.094 },
    boards: { from: 1.085, to: 1.738, open: true },
    taillight: [
      [0.162, 0.635],
      [0.37, 0.592],
    ],
    lamps: { width: 0.29, y: 0.64, z: 2.71 },
    bumperWidth: 0.5,
  },
  hare: {
    hood: [
      [2.657, 0.619],
      [2.612, 0.684],
      [2.436, 0.819],
      [2.055, 0.958],
      [1.919, 0.958],
      [1.719, 0.847],
      [1.634, 0.777],
      [1.605, 0.506],
      [1.655, 0.256],
      [2.046, 0.241],
      [2.397, 0.307],
      [2.597, 0.498],
      [2.682, 0.519],
    ],
    hoodWidth: 0.75,
    noseWidth: 0.5,
    screen: {
      base: [2.436, 0.819],
      top: [2.275, 1.034],
      back: [2.02, 1.018],
      foot: [2.055, 0.958],
      width: 0.38,
    },
    grip: [1.844, 1.048],
    post: [1.834, 0.913],
    barWidth: 0.74,
    seat: [
      [0.907, 0.856],
      [1.093, 0.836],
      [1.293, 0.816],
      [1.494, 0.802],
      [1.619, 0.777],
    ],
    seatBase: 0.596,
    tailbox: [
      [0.662, 0.574],
      [0.682, 0.715],
      [0.852, 0.74],
      [0.907, 0.851],
    ],
    flap: [
      [0.02, 0.643],
      [-0.04, 0.462],
      [-0.059, 0.267],
      [-0.029, 0.197],
    ],
    tunnelTop: [
      [0.0, 0.673],
      [0.1, 0.658],
      [0.391, 0.614],
      [0.667, 0.574],
    ],
    tunnelBottom: [
      [0.09, 0.568],
      [0.642, 0.419],
      [0.893, 0.354],
      [1.394, 0.325],
    ],
    tunnelWidth: 0.4,
    ski: [
      [1.876, 0.101],
      [2.032, 0.016],
      [2.638, 0.022],
      [2.799, 0.098],
      [2.954, 0.258],
    ],
    spindle: [
      [2.322, 0.122],
      [2.252, 0.362],
    ],
    trackUp: [
      [0.277, 0.202],
      [0.492, 0.288],
      [0.758, 0.389],
    ],
    contact: [0.242, 1.42],
    idler: { at: [0.277, 0.102], radius: 0.083 },
    sprocket: { at: [1.52, 0.315], radius: 0.09 },
    boards: { from: 0.993, to: 1.655, open: false },
    taillight: [
      [0.156, 0.588],
      [0.341, 0.554],
    ],
    lamps: { width: 0.29, y: 0.64, z: 2.6 },
    bumperWidth: 0.5,
  },
  ibex: {
    hood: [
      [2.86, 0.629],
      [2.604, 0.867],
      [2.494, 0.991],
      [2.397, 1.045],
      [2.277, 1.044],
      [1.827, 0.896],
      [1.654, 0.792],
      [1.684, 0.336],
      [1.885, 0.283],
      [2.281, 0.285],
      [2.323, 0.475],
      [2.59, 0.357],
      [2.903, 0.581],
    ],
    hoodWidth: 0.65,
    noseWidth: 0.4,
    screen: null,
    grip: [1.978, 1.135],
    post: [2.044, 0.978],
    barWidth: 0.74,
    handle: { width: 0.14, height: 0.09 },
    seat: [
      [1.144, 0.817],
      [1.302, 0.807],
      [1.464, 0.796],
      [1.649, 0.792],
    ],
    seatBase: 0.623,
    tailbox: [
      [0.852, 0.593],
      [0.857, 0.783],
      [1.139, 0.8],
    ],
    tunnelTop: [
      [0.0, 0.665],
      [0.081, 0.736],
      [0.434, 0.667],
      [0.852, 0.593],
    ],
    tunnelBottom: [
      [0.201, 0.617],
      [0.798, 0.506],
      [1.412, 0.351],
      [1.684, 0.336],
    ],
    tunnelWidth: 0.42,
    ski: [
      [2.157, 0.111],
      [2.228, 0.035],
      [2.787, 0.032],
      [3.014, 0.098],
      [3.22, 0.208],
    ],
    spindle: [
      [2.536, 0.14],
      [2.481, 0.34],
    ],
    trackUp: [
      [0.083, 0.291],
      [0.668, 0.478],
    ],
    contact: [0.22, 1.522],
    idler: { at: [0.084, 0.182], radius: 0.109 },
    sprocket: { at: [1.711, 0.364], radius: 0.098 },
    boards: { from: 1.195, to: 1.928, open: true },
    taillight: [
      [0.217, 0.644],
      [0.472, 0.613],
    ],
    lamps: { width: 0.27, y: 0.74, z: 2.76 },
    bumperWidth: 0.4,
  },
  stoat: {
    hood: [
      [2.583, 0.592],
      [2.182, 0.936],
      [2.062, 0.966],
      [1.815, 0.911],
      [1.642, 0.839],
      [1.503, 0.766],
      [1.466, 0.633],
      [1.507, 0.339],
      [1.686, 0.217],
      [2.019, 0.222],
      [2.039, 0.348],
      [2.403, 0.307],
      [2.645, 0.514],
    ],
    hoodWidth: 0.7,
    noseWidth: 0.45,
    screen: {
      base: [2.177, 0.934],
      top: [2.074, 0.971],
      back: [2.03, 0.963],
      foot: [2.03, 0.956],
      width: 0.25,
    },
    grip: [1.762, 0.998],
    post: [1.798, 0.893],
    barWidth: 0.78,
    seat: [
      [0.762, 0.816],
      [0.899, 0.813],
      [1.024, 0.803],
      [1.145, 0.787],
      [1.29, 0.763],
      [1.391, 0.73],
    ],
    seatBase: 0.563,
    tailbox: [
      [0.731, 0.563],
      [0.739, 0.737],
      [0.762, 0.816],
    ],
    flap: [
      [0.094, 0.582],
      [0.057, 0.562],
      [-0.332, 0.173],
    ],
    tunnelTop: [
      [0.0, 0.608],
      [0.117, 0.627],
      [0.412, 0.597],
      [0.697, 0.562],
    ],
    tunnelBottom: [
      [0.118, 0.577],
      [0.471, 0.448],
      [1.295, 0.432],
    ],
    tunnelWidth: 0.4,
    ski: [
      [1.968, 0.047],
      [2.04, -0.005],
      [2.741, 0.006],
      [2.873, 0.052],
      [2.958, 0.124],
    ],
    spindle: [
      [2.284, 0.077],
      [2.232, 0.253],
    ],
    trackUp: [
      [0.225, 0.204],
      [0.577, 0.384],
    ],
    contact: [0.198, 1.28],
    idler: { at: [0.226, 0.113], radius: 0.091 },
    sprocket: { at: [1.373, 0.313], radius: 0.098 },
    boards: { from: 0.955, to: 1.592, open: true },
    taillight: [
      [0.18, 0.574],
      [0.399, 0.525],
    ],
    lamps: { width: 0.24, y: 0.62, z: 2.53 },
    bumperWidth: 0.45,
    plates: true,
  },
  bison: {
    hood: [
      [2.75, 0.635],
      [2.546, 0.828],
      [2.238, 0.961],
      [1.98, 0.964],
      [1.685, 0.89],
      [1.641, 0.607],
      [1.689, 0.296],
      [1.853, 0.227],
      [2.126, 0.224],
      [2.144, 0.394],
      [2.489, 0.349],
      [2.661, 0.481],
      [2.776, 0.583],
    ],
    hoodWidth: 0.8,
    noseWidth: 0.5,
    screen: {
      base: [2.546, 0.828],
      top: [2.011, 1.428],
      back: [1.985, 1.408],
      foot: [2.12, 1.014],
      width: 0.66,
    },
    grip: [1.879, 1.104],
    post: [1.861, 0.934],
    barWidth: 0.74,
    seat: [
      [0.757, 0.947],
      [0.948, 0.934],
      [1.117, 0.86],
      [1.36, 0.837],
      [1.566, 0.824],
      [1.685, 0.89],
    ],
    seatBase: 0.636,
    backrest: [
      [0.638, 0.917],
      [0.606, 1.264],
      [0.642, 1.279],
      [0.744, 1.195],
      [0.767, 0.916],
    ],
    luggage: [
      [0.08, 0.872],
      [0.07, 0.909],
      [0.107, 0.96],
      [0.535, 0.955],
      [0.586, 0.918],
      [0.635, 0.68],
      [0.156, 0.717],
    ],
    grabHandle: [
      [0.947, 0.862],
      [0.99, 1.042],
      [1.104, 1.026],
      [1.102, 0.86],
    ],
    mirror: [
      [1.994, 1.232],
      [2.101, 1.107],
    ],
    flap: [
      [-0.001, 0.564],
      [-0.023, 0.419],
      [0.011, 0.238],
    ],
    tunnelTop: [
      [0.0, 0.636],
      [0.325, 0.622],
      [0.686, 0.607],
    ],
    tunnelBottom: [
      [0.154, 0.598],
      [0.684, 0.473],
      [1.56, 0.36],
    ],
    tunnelWidth: 0.4,
    ski: [
      [1.945, 0.118],
      [2.021, 0.024],
      [2.666, 0.017],
      [2.899, 0.102],
      [3.071, 0.229],
    ],
    spindle: [
      [2.399, 0.144],
      [2.386, 0.366],
    ],
    trackUp: [
      [0.305, 0.219],
      [0.684, 0.422],
    ],
    contact: [0.318, 1.505],
    idler: { at: [0.304, 0.121], radius: 0.098 },
    sprocket: { at: [1.638, 0.338], radius: 0.093 },
    boards: { from: 1.147, to: 1.818, open: false },
    taillight: [
      [0.119, 0.66],
      [0.17, 0.639],
    ],
    lamps: { width: 0.3, y: 0.7, z: 2.65 },
    bumperWidth: 0.5,
  },
  beaver: {
    hood: [
      [2.694, 0.601],
      [2.579, 0.655],
      [2.476, 0.788],
      [2.024, 0.92],
      [1.882, 0.911],
      [1.617, 0.772],
      [1.572, 0.562],
      [1.664, 0.266],
      [1.858, 0.227],
      [2.295, 0.222],
      [2.471, 0.377],
      [2.629, 0.391],
      [2.71, 0.548],
    ],
    hoodWidth: 0.82,
    noseWidth: 0.55,
    screen: {
      base: [2.476, 0.788],
      top: [1.993, 1.357],
      back: [1.939, 1.279],
      foot: [1.988, 0.92],
      width: 0.62,
    },
    grip: [1.805, 1.07],
    post: [1.882, 0.911],
    barWidth: 0.8,
    seat: [
      [0.787, 0.882],
      [1.002, 0.88],
      [1.197, 0.846],
      [1.46, 0.8],
      [1.617, 0.772],
    ],
    seatBase: 0.619,
    backrest: [
      [0.685, 0.784],
      [0.688, 1.015],
      [0.741, 1.03],
      [0.788, 1.014],
      [0.785, 0.782],
    ],
    cargo: [
      [-0.001, 1.055],
      [0.552, 1.033],
      [0.656, 0.963],
      [0.685, 0.768],
      [0.001, 0.776],
    ],
    rack: [
      [-0.057, 0.766],
      [0.579, 0.706],
      [0.72, 0.573],
      [0.786, 0.44],
    ],
    mirror: [
      [1.975, 1.157],
      [2.057, 1.03],
    ],
    flap: [
      [0.02, 0.644],
      [-0.097, 0.53],
      [-0.204, 0.421],
    ],
    tunnelTop: [
      [-0.0, 0.708],
      [0.668, 0.657],
    ],
    tunnelBottom: [
      [0.019, 0.55],
      [0.649, 0.363],
      [1.454, 0.321],
    ],
    tunnelWidth: 0.66,
    ski: [
      [1.925, 0.142],
      [2.013, 0.025],
      [2.608, 0.002],
      [2.82, 0.094],
      [2.995, 0.224],
    ],
    spindle: [
      [2.399, 0.131],
      [2.333, 0.311],
    ],
    trackUp: [
      [0.148, 0.301],
      [0.47, 0.386],
    ],
    contact: [0.187, 1.555],
    idler: { at: [0.147, 0.206], radius: 0.095 },
    sprocket: { at: [1.559, 0.336], radius: 0.095 },
    boards: { from: 1.032, to: 1.769, open: false },
    taillight: [
      [0.062, 0.607],
      [0.283, 0.578],
    ],
    lamps: { width: 0.36, y: 0.71, z: 2.56 },
    bumperWidth: 0.8,
  },
};

/** THE LOOK'S FRAME: where a traced point lands in the machine's own body
 * frame. `z` is the linear map that pins the traced ski centre to
 * `skiForward` and the traced rear idler to `treadRear`; `y` puts
 * the traced snow line at the machine's own (`cogHeight` under the
 * origin). `stretch` is how much longer the machine is than the photograph
 * between those two pins — near 1, and the lab says when it is not. */
export function lookFrame(spec: SledSpec, look: SledLook = SLED_LOOKS[spec.id]) {
  const skiAt = look.spindle[0][0];
  const tailAt = look.idler.at[0];
  const stretch = (spec.skiForward - spec.treadRear) / (skiAt - tailAt);
  const z = (t: number) => spec.treadRear + (t - tailAt) * stretch;
  const y = (t: number) => t - spec.cogHeight;
  return { z, y, stretch, point: (p: P): P => [z(p[0]), y(p[1])] };
}
