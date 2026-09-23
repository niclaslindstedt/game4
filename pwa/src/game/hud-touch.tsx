// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOUCH CONTROLS — the two thumb zones the phone rides the sled with:
// the HANDLEBAR on the lower left, the LEVER on the lower right — the
// throttle dragged DOWN from its anchor, the brake pushed UP from it. Both
// stop short of the top of the screen so the readouts and their presses keep
// their own glass; styles.css owns where the line falls.
//
// They are a HUD surface but not a HUD readout: everything here writes
// straight into the input manager between snapshots, at pointer rate,
// rather than being drawn from the ~12 Hz snapshot the rest of the HUD
// reads. That is the whole reason they sit in their own module — and it is
// what the two rules below protect.
//
// TWO THINGS EVERY ZONE HERE OWES:
//
// - It must LET GO. A control that trusts only its own pointerup is one
//   that eventually sticks, with the axis it wrote outliving the race.
//   `thumb-guard.ts` is every way a grip has to be able to end, and no zone
//   may hold a finger without one.
// - It must answer at POINTER rate. The bar's rotation and the lever's
//   position are written onto the DOM directly; nothing in here re-renders
//   to move, because a thumb feeling a 12 Hz handlebar is a thumb feeling
//   a broken game.
//
// The MATHS of both — how far a thumb goes for full lock, the lever's
// throw, the lean's dead band — is input-model.ts, which the tests read.

import { useEffect, useMemo, useRef } from "preact/hooks";

import {
  BAR_REACH_PX,
  LEVER_BRAKE_DEAD_PX,
  LEVER_BRAKE_PX,
  LEVER_FULL_PX,
  barLean,
  barSteer,
  leverBrake,
  leverThrottle,
} from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { createThumbGuard } from "./thumb-guard.ts";

/** Capture the pointer so a drag that leaves the zone keeps steering; a
 * pointer that cannot be captured (synthetic, already released) is fine —
 * the zone still tracks it by id. */
function capturePointer(e: { currentTarget: EventTarget | null; pointerId: number }): void {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* see above */
  }
}

/** Ask the DOM whether a finger is still on the glass. Capture is the only
 * one who knows: the browser drops it the moment a touch ends, whether or
 * not it ever told us the touch ended. */
function stillDown(zone: EventTarget | null): (pointerId: number) => boolean {
  const el = zone as HTMLElement | null;
  return (pointerId) => el?.hasPointerCapture(pointerId) ?? false;
}

/** Bar rotation at full lock, degrees. */
const BAR_LOCK_DEG = 28;
/** The bar's drawing is this many px across (styles.css `.hud-bar-svg`),
 * mapped onto a hundred-unit box — so the reach ring can be drawn at the
 * thumb's real travel. */
const BAR_SVG_PX = 200;
/** ...which puts the reach ring at this radius in the drawing's own units. */
const BAR_REACH_UNITS = (BAR_REACH_PX / BAR_SVG_PX) * 100;
/** Half the drawn bar's own height, units: the crossbar's top edge to the
 * base grip's bottom. The art is drawn CENTRED on the box (that is what the
 * −8 in every y below is for), so this one number bounds its travel in both
 * directions instead of one. */
const BAR_ART_HALF = 17;
/** ...so the bar slides this far at full lean: right up against the reach
 * ring and no further, at BOTH ends of the axis.
 *
 * The lean is the one axis of the two with nothing to SHOW for itself — a
 * turned bar is unmistakable, a leaning rider is a few degrees of pitch
 * behind a chase camera, and in the air it is the whole of the pitch
 * control — so the overlay carries the whole of its travel, and the end of
 * that travel is the ring the player can already see. */
const BAR_LEAN_SLIDE = BAR_REACH_UNITS - BAR_ART_HALF;

/** The left thumb: touching anywhere in the zone anchors a handlebar under
 * the finger; dragging sideways turns it, dragging up or down leans the
 * rider, and releasing centres both. Screen-space: right = +1
 * (input-model.ts flips the sign for the engine, once). */
export function BarZone({ touch }: { touch: InputManager["touch"] }) {
  const barRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<SVGGElement>(null);
  const originRef = useRef({ x: 0, y: 0 });

  const write = (steer: number, lean: number): void => {
    touch.steer = steer;
    touch.lean = lean;
    const rotor = rotorRef.current;
    if (rotor) {
      // A bar seen from the saddle: it turns with the steer and slides
      // toward the rider (down) with the lean back, the whole way to the
      // ring at the ends of its travel.
      rotor.setAttribute(
        "transform",
        `translate(0 ${(lean * BAR_LEAN_SLIDE).toFixed(1)}) rotate(${(steer * BAR_LOCK_DEG).toFixed(1)} 50 50)`,
      );
    }
  };

  /** Centre the bar and put it away. Everything it touches is a ref, so
   * the guard can call it from a window event or an unmount just as safely
   * as the pointerup does. */
  const letGo = (): void => {
    touch.bar = false;
    write(0, 0);
    if (barRef.current) barRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class="hud-zone hud-zone-left"
      data-touch="bar"
      onPointerDown={(e) => {
        // The first finger owns the bar; a second touch on this half is
        // ignored rather than re-anchoring the steering under the first —
        // unless the first is a finger the browser never told us about,
        // which is what the guard refuses to keep believing in.
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = { x: e.clientX, y: e.clientY };
        const bar = barRef.current;
        if (bar) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          bar.style.left = `${e.clientX - box.left}px`;
          bar.style.top = `${e.clientY - box.top}px`;
          bar.style.display = "block";
        }
        touch.bar = true;
        write(0, 0);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        write(barSteer(e.clientX - originRef.current.x), barLean(e.clientY - originRef.current.y));
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      // Capture taken away mid-drag: whatever the browser does with the rest
      // of that touch, this zone is no longer hearing about it.
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={barRef} class="hud-bar" aria-hidden="true">
        <svg class="hud-bar-svg" viewBox="0 0 100 100">
          {/* The reach ring: how far the thumb can go for full lock. */}
          <circle cx="50" cy="50" r={(BAR_REACH_PX / BAR_SVG_PX) * 100} class="hud-bar-reach" />
          <g ref={rotorRef}>
            {/* The bar itself: a crossbar with two grips and a column down
                to the deck, seen from the saddle — drawn CENTRED on the box
                (every y is 8 up from where the bar was first drawn), so that
                a lean slides it the same distance each way and reaches the
                ring at both ends. It still turns about the column, which is
                on the box's centre wherever the art sits. */}
            <path d="M 14 40 Q 50 32 86 40" class="hud-bar-tube" />
            <rect x="6" y="35" width="16" height="9" rx="4" class="hud-bar-grip" />
            <rect x="78" y="35" width="16" height="9" rx="4" class="hud-bar-grip" />
            <path d="M 50 38 L 50 58" class="hud-bar-tube" />
            <rect x="42" y="56" width="16" height="10" rx="3" class="hud-bar-grip" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** The lever's drawing: the throttle's throw below the anchor, the brake's
 * above it, with room round the track for the knob and its stroke, px. */
const LEVER_UP_PX = LEVER_BRAKE_DEAD_PX + LEVER_BRAKE_PX;
const LEVER_PAD_PX = 22;
const LEVER_TOP_PX = -LEVER_UP_PX - LEVER_PAD_PX;
const LEVER_BOX_PX = LEVER_UP_PX + LEVER_FULL_PX + LEVER_PAD_PX * 2;

/** The right thumb: touching anywhere in the zone anchors the LEVER, SHUT,
 * under the finger. Dragging DOWN toward the palm opens the throttle over
 * `LEVER_FULL_PX`; pushing UP past a small dead band pulls the BRAKE over
 * `LEVER_BRAKE_PX`. Analogue the whole way, held while the finger is down
 * and let go on the lift. `input-model.ts` states the maths once. */
export function LeverZone({ touch }: { touch: InputManager["touch"] }) {
  const leverRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<SVGGElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const originRef = useRef(0);

  const write = (throttle: number, brake: number): void => {
    touch.throttle = throttle;
    touch.brake = brake;
    // The knob rides the thumb: the anchor at 0 is shut, the throttle's
    // travel runs down from it and the brake's up. The fill spans the anchor
    // to the knob either way — downward it is the throttle that is open,
    // upward the brake, drawn in the alarm colour so a thumb never has to
    // ask which half of the throw it is in.
    const px =
      throttle > 0
        ? throttle * LEVER_FULL_PX
        : brake > 0
          ? -(LEVER_BRAKE_DEAD_PX + brake * LEVER_BRAKE_PX)
          : 0;
    knobRef.current?.setAttribute("transform", `translate(0 ${px.toFixed(1)})`);
    const fill = fillRef.current;
    if (!fill) return;
    fill.setAttribute("y", Math.min(0, px).toFixed(1));
    fill.setAttribute("height", Math.abs(px).toFixed(1));
    fill.classList.toggle("hud-lever-fill-reverse", brake > 0);
  };
  const letGo = (): void => {
    touch.lever = false;
    write(0, 0);
    if (leverRef.current) leverRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class="hud-zone hud-zone-right"
      data-touch="lever"
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = e.clientY;
        const lever = leverRef.current;
        if (lever) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          lever.style.left = `${e.clientX - box.left}px`;
          lever.style.top = `${e.clientY - box.top}px`;
          lever.style.display = "block";
        }
        touch.lever = true;
        write(0, 0);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        const dy = e.clientY - originRef.current;
        write(leverThrottle(dy), leverBrake(dy));
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={leverRef} class="hud-lever" aria-hidden="true">
        <svg
          class="hud-lever-svg"
          width="44"
          height={LEVER_BOX_PX}
          viewBox={`${-LEVER_PAD_PX} ${LEVER_TOP_PX} 44 ${LEVER_BOX_PX}`}
          // The drawing is anchored at the thumb, so the box's top edge has
          // to sit exactly where its own viewBox says it starts — one
          // expression for both rather than a number in styles.css that
          // silently stops agreeing the day a throw changes length.
          style={{ top: `${LEVER_TOP_PX}px` }}
        >
          <rect
            class="hud-lever-track"
            x="-6"
            y={-LEVER_UP_PX}
            width="12"
            height={LEVER_UP_PX + LEVER_FULL_PX}
            rx="6"
          />
          <rect ref={fillRef} class="hud-lever-fill" x="-6" y="0" width="12" height="0" rx="6" />
          {/* The SHUT mark at the anchor: above it the brake, below it the
              throttle, so the two read as two levers rather than one. */}
          <line class="hud-lever-neutral" x1="-11" y1="0" x2="11" y2="0" />
          <g ref={knobRef}>
            <circle class="hud-lever-knob" cx="0" cy="0" r="15" />
          </g>
        </svg>
      </div>
    </div>
  );
}
