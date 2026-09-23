// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RUNNING SNOWMOBILE, AS SEVEN LAYERS THAT NEVER STOP.
//
// The engine is not made of events. It is a handful of oscillators and two
// noise sources built once for the race and STEERED — pitch, level, cutoff
// and saturation moved every frame on the audio thread (`Synth.layer`).
// Nothing here is scheduled, tiled or phase-aligned; a frame that arrives
// late leaves the engine holding its last note rather than leaving a hole.
//
// WHAT A SLED IS MADE OF, in the order the ear finds them:
//
//   MOTOR    the BLOCK, heard through the chassis — the machine's own hum,
//            under everything, at idle and at the limiter alike
//   HUM      the firing note — the one layer whose pitch says the revs, a
//            detuned triangle pair folded through the saturation curve,
//            harder the more work the engine is doing
//   OCTAVE   the same note an octave up, carrying it at idle where 50 Hz is
//            a thing a phone cannot reproduce, fading as the crank climbs
//   RASP     the EXPANSION CHAMBER — the two-stroke's own voice, a driven
//            sawtooth in a band that climbs with the revs: the ring-a-ding
//            everyone on a hill knows a sled by, and the layer that comes up
//            hardest when the engine is on the pipe
//   BASS     a sine an octave under the note: the mass of the machine
//   INTAKE   the airbox under the hood — pink noise in a mid band that opens
//            with the throttle; what a rider hears of their own engine
//   BELT     the DRIVE — the CVT belt and the track's lugs passing the
//            drivers, a thin driven whine whose pitch is the TRACK's speed,
//            not the crank's: the one layer that tells a sled holding its
//            revs while it gathers speed from one bogging in powder
//
// A CVT IS WHY THIS SOUNDS LIKE A SLED AND NOT A CAR. The clutch holds the
// engine near its power peak while the belt walks up the sheaves, so under
// full throttle the NOTE barely moves while the sled runs from rest to
// ninety — and all the acceleration is in the belt's whine climbing under
// it. A layer set that tied everything to the revs would drone.
//
// AND THE AIR IS PART OF THE ENGINE'S VOICE. Off a kicker the tread unloads
// and the crank runs free to the limiter — the physics does that, this only
// hears it: the note climbs, the belt spins up to a scream with nothing to
// push against.
//
// This is a pure function of the state: `engineTargets` says where every
// layer should be, and the scheduler (`ride-bed.ts`) steers the real ones
// there. Being a pure function is what makes it testable and what lets the
// audition page drive it from sliders.

import type { LayerSpec, LayerTarget } from "../../lib/voice.ts";

/**
 * FIRINGS PER REVOLUTION — how the crank becomes a pitch. The sled is a
 * TWIN-CYLINDER TWO-STROKE, and a two-stroke fires every cylinder every
 * revolution: two a revolution, so the note is `rpm / 60 × 2` — idle (1500)
 * a 50 Hz chug, the limiter (8400) 280 Hz of a small engine screaming. That
 * is what makes it higher and angrier than a four-stroke of the same size.
 */
export const FIRINGS_PER_REV = 2;

/**
 * WHAT THE DRIVE WHINES AT, per metre of track: the LUG PITCH. A track is
 * a belt of lugs on a pitch of about six and a half centimetres, and every
 * lug that passes the drive sprocket is a pulse — so the whine is the
 * track's surface speed over that pitch, 460 Hz at thirty metres a second.
 */
export const LUG_PITCH_M = 0.065;

/** Which harmonic of the lug tone the belt's band sits on — high enough to
 * read as a whine rather than a second hum, low enough to stay under the
 * snow's hiss instead of on top of it. */
const BELT_HARMONIC = 3;

/** The firing note these revs make, Hz. */
export function noteHz(rpm: number): number {
  return (rpm / 60) * FIRINGS_PER_REV;
}

/** The drive's lug tone at this track speed, Hz. */
export function beltHz(treadSpeed: number): number {
  return Math.abs(treadSpeed) / LUG_PITCH_M;
}

/** How far up the band the crank is, 0..1 (a shade over 1 on the limiter),
 * measured against the sled's OWN idle and redline. */
export function revOf(rpm: number, idleRpm: number, maxRpm: number): number {
  return Math.min(1.06, Math.max(0, (rpm - idleRpm) / Math.max(1, maxRpm - idleRpm)));
}

/** Revs from a share of the band — the audition page's slider, inverted. */
export function rpmAt(rev: number, idleRpm: number, maxRpm: number): number {
  return idleRpm + Math.min(1.06, Math.max(0, rev)) * (maxRpm - idleRpm);
}

/** How low the BASS may go, Hz. Below about here a phone gives you nothing
 * and a desktop gives you cabinet noise. */
const BASS_FLOOR_HZ = 44;

/** THE BAND THE BLOCK HUMS IN, Hz — where the motor's lowpass sits at idle,
 * and how far it opens by the limiter. A square at the firing note puts its
 * odd harmonics where a phone can play them; the lowpass keeps it a hum. */
const MOTOR_BAND_HZ = 220;
const MOTOR_BAND_OPENS_HZ = 200;

/** Above this share of the band the pipe starts to sing at all — the
 * two-stroke coming ON the pipe, which is the moment it stops sounding like
 * a lawnmower. */
const PIPE_FROM = 0.35;

/** The track speed at which the belt is as loud as it gets, m/s. */
const BELT_FULL = 30;

/** One engine at one instant — everything the layers need. */
export type EngineVoice = {
  rpm: number;
  /** How far up the band the crank is, 0..1. */
  rev: number;
  /** The throttle as the machine has it, 0..1. */
  throttle: number;
  /** How hard the engine is WORKING, 0..1: the throttle with snow under the
   * track to push against. Zero in the air however wide the throttle is,
   * which is what makes a free-revving jump sound thin rather than loud. */
  load: number;
  /** The track's surface speed, m/s — the belt's pitch. */
  treadSpeed: number;
  /** How much faster the track is running than the snow under it, m/s —
   * the drive spinning in powder. */
  slip: number;
};

/** What the seat does to the engine — three of the listener's numbers. */
export type EngineMix = {
  engine: number;
  /** The pipe and the belt, heard from BEHIND. */
  exhaust: number;
  /** 0..1, how bright: the hum's cutoff is scaled by it. */
  tone: number;
};

export type EngineLayer = "motor" | "hum" | "octave" | "rasp" | "bass" | "intake" | "belt";

/** What each layer is BUILT from — decided once. */
export const ENGINE_LAYERS: Record<EngineLayer, LayerSpec> = {
  motor: {
    kind: "tone",
    type: "square",
    detuneCents: 7,
    drive: 1,
    filter: { type: "lowpass", q: 0.8 },
  },
  hum: {
    kind: "tone",
    type: "triangle",
    detuneCents: 12,
    drive: 1,
    filter: { type: "lowpass", q: 0.9 },
  },
  octave: { kind: "tone", type: "triangle", detuneCents: 8, drive: 1 },
  rasp: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 20,
    drive: 1,
    filter: { type: "bandpass", q: 1.3 },
  },
  bass: { kind: "tone", type: "sine", detuneCents: 5 },
  intake: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  belt: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 6,
    drive: 1,
    filter: { type: "bandpass", q: 3 },
  },
};

/** How fast each layer follows, s. Pitch layers move quickly (a rev that
 * lags the needle reads as a slow engine); the intake takes a moment. */
export const ENGINE_GLIDE: Record<EngineLayer, number> = {
  motor: 0.05,
  hum: 0.03,
  octave: 0.03,
  rasp: 0.04,
  bass: 0.03,
  intake: 0.08,
  belt: 0.06,
};

/**
 * Where every layer of the engine should be for `voice`, heard from `mix`.
 * The motor and the hum at full load are a landing's size between them,
 * the bass under them a little less, and everything else is texture.
 */
export function engineTargets(
  voice: EngineVoice,
  mix: EngineMix,
): Record<EngineLayer, LayerTarget> {
  const rev = Math.min(1, Math.max(0, voice.rev));
  const throttle = Math.min(1, Math.max(0, voice.throttle));
  const load = Math.min(1, Math.max(0, voice.load));
  const hz = noteHz(voice.rpm);
  const pipe = Math.max(0, (rev - PIPE_FROM) / (1 - PIPE_FROM));
  const tread = Math.min(1, Math.abs(voice.treadSpeed) / BELT_FULL);
  const spin = Math.min(1, Math.max(0, voice.slip) / 8);
  const belt = beltHz(voice.treadSpeed);
  return {
    // THE MACHINE IN THE BACKGROUND — as present at idle on the grid as at
    // the limiter in the air.
    motor: {
      level: (0.016 + 0.012 * load + 0.006 * rev) * mix.engine,
      hz,
      cutoff: (MOTOR_BAND_HZ + MOTOR_BAND_OPENS_HZ * rev) * (0.7 + 0.3 * mix.tone),
      grit: 0.25 + 0.4 * load,
    },
    // The body of the note, brighter with the revs, pushed harder into the
    // curve the more work it is doing — which is why the sled sounds like it
    // is WORKING up a powder face and free off a lip at the same revs.
    hum: {
      level: (0.02 + 0.028 * load + 0.008 * throttle) * mix.engine,
      hz,
      cutoff: (700 + 3000 * rev) * (0.45 + 0.55 * mix.tone),
      grit: 0.3 + 0.5 * load + 0.15 * throttle,
    },
    octave: {
      level: (0.014 - 0.01 * rev) * mix.engine,
      hz: hz * 2,
      grit: 0.3 + 0.2 * load,
    },
    // ON THE PIPE: nothing below the band's lower third, then the ring
    // coming up with the revs and the throttle together.
    rasp: {
      level: pipe * (0.006 + 0.022 * throttle) * mix.exhaust,
      hz,
      cutoff: 1100 + 2600 * rev,
      grit: 0.6 + 0.35 * throttle,
    },
    bass: {
      level: (0.018 + 0.016 * load) * mix.engine,
      hz: Math.max(BASS_FLOOR_HZ, hz * 0.5),
    },
    intake: {
      level: (0.003 + 0.011 * throttle) * (0.6 + 0.4 * mix.tone) * mix.engine,
      cutoff: 300 + 520 * rev,
    },
    // THE DRIVE: silent at a standstill, climbing with the track — and a
    // little louder when the track is spinning faster than the sled, which
    // is the sound of a sled digging itself into powder.
    belt: {
      level: tread * (0.003 + 0.006 * throttle + 0.005 * spin) * mix.exhaust,
      hz: Math.max(20, belt),
      cutoff: Math.max(60, belt * BELT_HARMONIC),
      grit: 0.2 + 0.3 * throttle,
    },
  };
}
