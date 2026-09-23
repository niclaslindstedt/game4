// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PLAYER PRESSES: every action the game can be given from the
// keyboard, and the keys bound to each. Data only — reading a keyboard is
// `input.ts`'s, and the maths a held key ramps through is `input-model.ts`'s.
// `DEFAULT_KEYS` is the layout as it ships; OPTIONS ▸ KEYS (`menu-keys.tsx`)
// rebinds a row of it, `settings.ts` stores the answer, and the input
// manager rebuilds its index off whatever it is handed — nothing in
// `input.ts` knows any particular key.
//
// THE HELD SET IS NOT RESTATED. `HeldAction` is `keyof KeysHeld`, so a key
// the sled grows tomorrow is an action this table does not compile without.

import type { KeysHeld } from "./input-model.ts";
import { STRINGS } from "./strings.ts";

/** The actions a key is HELD for — the sled's own, and the only ones the
 * ramps in `input-model.ts` know about. */
export type HeldAction = keyof KeysHeld;

/** The presses the APP answers rather than the sled. `reset` is the one
 * edge that is not here: it reaches the engine as an input flag on the step
 * it arrives in, which is the whole difference between putting the sled
 * back and changing the camera. */
export type InputAction = "restart" | "camera" | "pause" | "shot" | "hud";

/** An action taken on the PRESS, not held. */
export type EdgeAction = "reset" | InputAction;

export type KeyAction = HeldAction | EdgeAction;

/** Bound `KeyboardEvent.code` values per action. */
export type KeyBindings = Record<KeyAction, readonly string[]>;

/** The rows of OPTIONS ▸ KEYS, in the order they are printed: the hand on
 * the throttle first, then the one on the bars, then the rider's weight,
 * then the presses that are about the RACE rather than the sled. */
export const KEY_ACTIONS: readonly { id: KeyAction; label: string }[] = [
  { id: "throttle", label: STRINGS.keyThrottle },
  { id: "brake", label: STRINGS.keyBrake },
  { id: "left", label: STRINGS.keyLeft },
  { id: "right", label: STRINGS.keyRight },
  { id: "leanBack", label: STRINGS.keyLeanBack },
  { id: "leanForward", label: STRINGS.keyLeanForward },
  { id: "trick", label: STRINGS.keyTrick },
  { id: "reset", label: STRINGS.keyReset },
  { id: "restart", label: STRINGS.keyRestart },
  { id: "camera", label: STRINGS.keyCamera },
  { id: "hud", label: STRINGS.keyHud },
  { id: "shot", label: STRINGS.keyShot },
  { id: "pause", label: STRINGS.keyPause },
];

/** Is this one of the sled's held actions? The table behind it is typed
 * `Record<HeldAction, true>`, so a new held key does not compile until it
 * is named here. */
const HELD: Record<HeldAction, true> = {
  throttle: true,
  brake: true,
  left: true,
  right: true,
  leanBack: true,
  leanForward: true,
  trick: true,
};

export function isHeldAction(action: KeyAction): action is HeldAction {
  return action in HELD;
}

/**
 * THE KEYBOARD AS IT SHIPS.
 *
 * TWO HANDS, EITHER CLUSTER: WASD and the arrows are the same machine, so
 * a player sits at whichever their hand already knows — W / ↑ is the thumb
 * throttle, S / ↓ the brake lever, A D / ← → the bars. SPACE is a second
 * brake because it is where a hand that has never played this reaches
 * first.
 *
 * THE LEAN is the rider's own body, and in the air it is the pitch control:
 * E or SHIFT leans BACK (nose up — the landing saved off a big kicker),
 * Q or Z leans forward (nose down). Shift and Z sit under the left hand of
 * an arrow player; Q and E either side of W for the WASD hand. Never Ctrl:
 * Ctrl held beside W is a closed tab.
 *
 * THE TRICK BUTTON, held in the air on a tricks run, takes the rider's
 * body off the controls and into a pose: F beside the WASD hand's lean
 * keys, X beside the arrow hand's Z.
 *
 * R puts the sled back on the track at the last checkpoint it took — the
 * press a rider makes with a sled upside down in a tree well. Standing the
 * WHOLE race back up on the grid is the rarer press and far more expensive
 * to make by accident, so it is B beside it rather than a key shared with
 * it. C walks the camera ladder; Escape holds the race under the pause card.
 */
export const DEFAULT_KEYS: KeyBindings = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown", "Space"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  leanBack: ["KeyE", "ShiftLeft", "ShiftRight"],
  leanForward: ["KeyQ", "KeyZ"],
  trick: ["KeyF", "KeyX"],
  reset: ["KeyR"],
  restart: ["KeyB"],
  camera: ["KeyC"],
  // H FOR THE READOUTS, beside C for what the camera looks at: the two
  // presses about the PICTURE rather than the sled. The same switch as
  // OPTIONS ▸ HUD, so the snow can be cleared for a photograph mid-race.
  hud: ["KeyH"],
  // ENTER IS THE SHUTTER (`screenshots.ts`): a picture is the press a rider
  // makes while everything is still going well, on the key the hand beside
  // the arrows is already resting near.
  shot: ["Enter"],
  pause: ["Escape"],
};

/** How many keys one action may carry. The defaults' longest is three; the
 * ceiling is only here so a hand-written blob cannot hand the manager a
 * thousand codes to walk on every keystroke. */
export const KEYS_PER_ACTION = 4;

/** A `KeyboardEvent.code` as the player reads it off the keyboard in front
 * of them. Anything outside the families below is its own code in capitals,
 * which for the keys a sled is likely to be bound to is already what is
 * printed on the cap. */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `NUM ${code.slice(6)}`;
  if (code.startsWith("Arrow")) return `${code.slice(5).toUpperCase()} ARROW`;
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft") return "L SHIFT";
  if (code === "ShiftRight") return "R SHIFT";
  if (code === "ControlLeft") return "L CTRL";
  if (code === "ControlRight") return "R CTRL";
  if (code === "AltLeft") return "L ALT";
  if (code === "AltRight") return "R ALT";
  return code.toUpperCase();
}

/** What an action's row reads: its keys, or the word for an action with
 * none — an empty box would read as a row that failed to draw. */
export function boundLabel(codes: readonly string[]): string {
  return codes.length === 0 ? STRINGS.keysUnbound : codes.map(keyLabel).join(" / ");
}

/** The OTHER actions a code of this one's is on. One key may serve two, and
 * the manager applies every action a code carries — but a key quietly doing
 * two jobs is the one thing a binding page must not hide. */
export function clashesWith(keys: KeyBindings, action: KeyAction): KeyAction[] {
  const mine = new Set(keys[action]);
  if (mine.size === 0) return [];
  return (Object.keys(keys) as KeyAction[]).filter(
    (other) => other !== action && keys[other].some((code) => mine.has(code)),
  );
}

/** One action rebound to one key. The whole list is REPLACED rather than
 * added to: a row that grew a key every time it was pressed would be a row
 * nobody could take a key off. */
export function bindKey(keys: KeyBindings, action: KeyAction, code: string): KeyBindings {
  return { ...keys, [action]: [code] };
}

/** The shipped bindings as lists nothing else shares a reference with —
 * what a first visit loads and what RESET KEYS puts back. */
export function freshKeys(): KeyBindings {
  const keys = {} as Record<KeyAction, string[]>;
  for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
    keys[action] = [...codes];
  }
  return keys;
}

/** A stored blob's bindings, checked against the actions THIS build has,
 * the `mergeSettings` rule: an action this build dropped is dropped, a code
 * that is not a string is dropped, and anything left over is the default. */
export function mergeKeys(parsed: unknown): KeyBindings {
  const keys = freshKeys() as Record<KeyAction, string[]>;
  if (!parsed || typeof parsed !== "object") return keys;
  const blob = parsed as Partial<Record<KeyAction, unknown>>;
  for (const action of Object.keys(keys) as KeyAction[]) {
    const codes = blob[action];
    if (!Array.isArray(codes)) continue;
    const clean = codes.filter(
      (code): code is string => typeof code === "string" && code.length > 0,
    );
    keys[action] = [...new Set(clean)].slice(0, KEYS_PER_ACTION);
  }
  return keys;
}

/** A code as the front door's key line prints it: short, because six of
 * them share one line — the arrows as arrows, everything else its cap. */
function capOf(code: string): string {
  const arrows: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return arrows[code] ?? keyLabel(code);
}

/** THE FRONT DOOR'S LINE OF KEYS, off the bindings in force — so a rider
 * who has moved the throttle reads where they moved it to. The first key of
 * each action; a pair where one line stands for two (steer, lean). */
export function keysLine(keys: KeyBindings): string {
  const first = (action: KeyAction): string => (keys[action][0] ? capOf(keys[action][0]) : "–");
  const W = STRINGS.menuKeyWords;
  return STRINGS.menuKeys([
    { cap: first("throttle"), does: W.throttle },
    { cap: first("brake"), does: W.brake },
    { cap: `${first("left")} ${first("right")}`, does: W.steer },
    { cap: `${first("leanForward")}/${first("leanBack")}`, does: W.lean },
    { cap: first("reset"), does: W.reset },
    { cap: first("camera"), does: W.camera },
  ]);
}
