// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INPUT MATHS — what a held key ramps to, what a thumb on the glass is
// asking for, and the one sign flip between the screen and the engine
// (`pwa/src/game/input-model.ts`), plus the key table the listeners read
// (`settings-input.ts`). DOM-free, so the whole feel of the controls is
// held here without a browser.

import { describe, expect, it } from "vitest";

import { TUNING } from "@engine";

import {
  BAR_REACH_PX,
  KEY_AXIS_SNAP,
  LEAN_DEAD_PX,
  LEVER_BRAKE_DEAD_PX,
  LEVER_BRAKE_PX,
  LEVER_FULL_PX,
  NO_KEYS,
  SCREEN_TO_ENGINE,
  barLean,
  barReachPx,
  barSteer,
  createInputModel,
  leverBrake,
  leverThrottle,
  neutralTouch,
  rampToward,
  sampleInput,
  type KeysHeld,
} from "../pwa/src/game/input-model.ts";
import { DEFAULT_KEYS, isHeldAction, type KeyAction } from "../pwa/src/game/settings-input.ts";

const DT = TUNING.dt;

/** Hold `keys` for `seconds` of steps and hand back the last input. */
function hold(keys: Partial<KeysHeld>, seconds: number, model = createInputModel()) {
  const held = { ...NO_KEYS, ...keys };
  let input = sampleInput(model, held, neutralTouch(), DT, false);
  for (let t = DT; t < seconds; t += DT)
    input = sampleInput(model, held, neutralTouch(), DT, false);
  return { input, model };
}

describe("the keyboard's ramps", () => {
  it("eases a held key toward its target and snaps a released one to exactly zero", () => {
    let v = 0;
    for (let i = 0; i < 20; i++) v = rampToward(v, 1, DT, 6, 9);
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(1);
    for (let i = 0; i < 400; i++) v = rampToward(v, 0, DT, 6, 9);
    expect(v).toBe(0);
    expect(rampToward(KEY_AXIS_SNAP / 2, 0, DT, 6, 9)).toBe(0);
  });

  it("opens the throttle over a fraction of a second, not on the press", () => {
    const tap = hold({ throttle: true }, 0.05).input.throttle;
    const held = hold({ throttle: true }, 1.5).input.throttle;
    expect(tap).toBeGreaterThan(0);
    expect(tap).toBeLessThan(0.4);
    expect(held).toBeGreaterThan(0.95);
  });

  it("flips the steer onto the engine's sign once, and never hands out -0", () => {
    const right = hold({ right: true }, 1).input.steer;
    expect(Math.sign(right)).toBe(SCREEN_TO_ENGINE);
    expect(Math.abs(right)).toBeGreaterThan(0.95);
    const none = hold({}, 0.2).input.steer;
    expect(Object.is(none, -0)).toBe(false);
  });

  it("leans BACK (nose up, +1) on the lean-back key and forward on the other", () => {
    expect(hold({ leanBack: true }, 1).input.lean).toBeGreaterThan(0.95);
    expect(hold({ leanForward: true }, 1).input.lean).toBeLessThan(-0.95);
  });

  it("lets the brake WIN over the throttle", () => {
    const { input } = hold({ throttle: true, brake: true }, 1);
    expect(input.brake).toBeGreaterThan(0.9);
    expect(input.throttle).toBe(0);
  });

  it("hands the reset edge through on the step it was banked for", () => {
    const model = createInputModel();
    expect(sampleInput(model, NO_KEYS, neutralTouch(), DT, true).reset).toBe(true);
    expect(sampleInput(model, NO_KEYS, neutralTouch(), DT, false).reset).toBe(false);
  });
});

describe("the throttle lever (drag DOWN, brake UP)", () => {
  it("is shut at the anchor and wide open a full throw down the glass", () => {
    expect(leverThrottle(0)).toBe(0);
    expect(leverThrottle(-40)).toBe(0);
    expect(leverThrottle(LEVER_FULL_PX / 2)).toBeCloseTo(0.5);
    expect(leverThrottle(LEVER_FULL_PX)).toBe(1);
    expect(leverThrottle(LEVER_FULL_PX * 3)).toBe(1);
  });

  it("pulls the brake only past a dead band up the glass, and never with the throttle", () => {
    expect(leverBrake(0)).toBe(0);
    expect(leverBrake(-LEVER_BRAKE_DEAD_PX)).toBe(0);
    expect(leverBrake(-(LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX / 2))).toBeCloseTo(0.5);
    expect(leverBrake(-(LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX))).toBe(1);
    for (let dy = -200; dy <= 200; dy += 5) {
      expect(leverThrottle(dy) > 0 && leverBrake(dy) > 0, `dy ${dy}`).toBe(false);
    }
    expect(Object.is(leverBrake(10), -0)).toBe(false);
  });
});

describe("the handlebar", () => {
  it("reaches full lock at the ring, symmetrically, and eases in off centre", () => {
    expect(barSteer(BAR_REACH_PX)).toBe(1);
    expect(barSteer(-BAR_REACH_PX)).toBe(-1);
    expect(barSteer(BAR_REACH_PX * 2)).toBe(1);
    expect(barSteer(BAR_REACH_PX / 2)).toBeLessThan(0.5);
    expect(barSteer(BAR_REACH_PX / 2)).toBeCloseTo(-barSteer(-BAR_REACH_PX / 2));
  });

  it("does not lean inside the dead band, and leans fully at the ring", () => {
    expect(barLean(LEAN_DEAD_PX)).toBe(0);
    expect(barLean(-LEAN_DEAD_PX + 1)).toBe(0);
    expect(barLean(BAR_REACH_PX)).toBe(1);
    expect(barLean(-BAR_REACH_PX)).toBe(-1);
  });

  it("owns steer and lean outright while a thumb is on it", () => {
    const touch = { ...neutralTouch(), bar: true, steer: 0.5, lean: -0.25 };
    const input = sampleInput(createInputModel(), { ...NO_KEYS, left: true }, touch, DT, false);
    expect(input.steer).toBeCloseTo(0.5 * SCREEN_TO_ENGINE);
    expect(input.lean).toBeCloseTo(-0.25);
  });

  it("takes the deeper of key and lever for the throttle", () => {
    const touch = { ...neutralTouch(), lever: true, throttle: 0.7 };
    const input = sampleInput(createInputModel(), NO_KEYS, touch, DT, false);
    expect(input.throttle).toBeCloseTo(0.7);
    const braking = sampleInput(
      createInputModel(),
      { ...NO_KEYS, throttle: true },
      { ...neutralTouch(), lever: true, brake: 0.6 },
      DT,
      false,
    );
    expect(braking.throttle).toBe(0);
    expect(braking.brake).toBeCloseTo(0.6);
  });
});

describe("the thumbs' feel (OPTIONS ▸ CONTROLS)", () => {
  it("shortens every throw by the sensitivity, and the ring with it", () => {
    const quick = { sensitivity: 1.5, invertLean: false };
    expect(barSteer(BAR_REACH_PX / 1.5, quick)).toBeCloseTo(1);
    expect(barSteer(BAR_REACH_PX / 1.5)).toBeLessThan(1);
    expect(barReachPx(quick)).toBeCloseTo(BAR_REACH_PX / 1.5);
    expect(leverThrottle(LEVER_FULL_PX / 1.5, quick)).toBeCloseTo(1);
    expect(leverBrake(-(LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX) / 1.5, quick)).toBeCloseTo(1);
  });

  it("turns the lean round when inverted, and nothing else", () => {
    const flipped = { sensitivity: 1, invertLean: true };
    expect(barLean(BAR_REACH_PX, flipped)).toBeCloseTo(-barLean(BAR_REACH_PX));
    expect(barLean(-BAR_REACH_PX, flipped)).toBeGreaterThan(0);
    expect(barSteer(40, flipped)).toBe(barSteer(40));
    expect(leverThrottle(45, flipped)).toBe(leverThrottle(45));
  });
});

describe("the key table (settings-input.ts)", () => {
  it("binds every action, and every held action is one the ramps know", () => {
    for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
      expect(codes.length, action).toBeGreaterThan(0);
    }
    for (const held of Object.keys(NO_KEYS) as KeyAction[]) {
      expect(isHeldAction(held)).toBe(true);
      expect(DEFAULT_KEYS[held].length).toBeGreaterThan(0);
    }
    for (const edge of ["reset", "restart", "camera", "pause"] as KeyAction[]) {
      expect(isHeldAction(edge)).toBe(false);
    }
  });

  it("puts WASD and the arrows on the same machine, and nothing on Ctrl", () => {
    expect(DEFAULT_KEYS.throttle).toEqual(expect.arrayContaining(["KeyW", "ArrowUp"]));
    expect(DEFAULT_KEYS.brake).toEqual(expect.arrayContaining(["KeyS", "ArrowDown"]));
    expect(DEFAULT_KEYS.left).toEqual(expect.arrayContaining(["KeyA", "ArrowLeft"]));
    expect(DEFAULT_KEYS.right).toEqual(expect.arrayContaining(["KeyD", "ArrowRight"]));
    expect(DEFAULT_KEYS.reset).toEqual(["KeyR"]);
    expect(DEFAULT_KEYS.restart).toEqual(["KeyB"]);
    expect(DEFAULT_KEYS.camera).toEqual(["KeyC"]);
    expect(DEFAULT_KEYS.pause).toEqual(["Escape"]);
    for (const codes of Object.values(DEFAULT_KEYS)) {
      for (const code of codes) expect(code).not.toMatch(/Control|Meta|Alt/);
    }
  });

  it("gives no key two held jobs that fight each other", () => {
    const seen = new Map<string, KeyAction>();
    for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
      for (const code of codes) {
        expect(seen.get(code), `${code} is on ${seen.get(code)} and ${action}`).toBeUndefined();
        seen.set(code, action);
      }
    }
  });
});
