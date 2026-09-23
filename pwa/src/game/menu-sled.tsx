// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED CARD — which machine, on a screen of its own, and the last thing
// between the rider and the grid.
//
// A ROW OF NAMES CANNOT ASK THIS QUESTION. "TRAIL / CROSSOVER / MOUNTAIN /
// CROSS" asks a rider to choose between four machines they have never seen
// by picking one of four words, and the catalog is four answers to a kind
// of snow. So it takes a card, the way the sibling games give the car and
// the craft theirs: the machine turning on its stand, drawn by the builder
// the race draws with, with the numbers beside it.
//
// IT IS THE LAST CARD BEFORE THE SNOW, and RIDE is on it. The front door's
// RACE tile says where (the seed on it); this card says what with, and then
// goes — so the last picture a rider sees before the loading card is the
// machine they are about to stand on.
//
// TWO THINGS ARE ON IT: THE SLED, which is the decision, and the readings
// beside it — three figures and five bars (`sled-stats.ts`). The card's one
// line of prose is the catalog's own blurb, standing in the picture under
// the machine. It WRITES `settings.sled`; a race stood up from here and one
// a `?sled=` link boots into read the same machine the same way.

import { useEffect, useRef, useState } from "preact/hooks";
import { sledById, type SledId } from "@engine";

import { COUNT_SECONDS, countAt } from "../lib/count.ts";
import { MenuHead } from "./menu-knobs.tsx";
import { SledPicker } from "./sled-picker.tsx";
import { sledBars, sledFacts, type SledFact } from "./sled-stats.ts";
import { STRINGS } from "./strings.ts";

/** ONE FIGURE, WHICH COUNTS. A number that swaps between two frames is one
 * the rider has to notice changed; one that rolls to its new value is one
 * they watch change. Its own component, so the frames it asks for repaint a
 * number and not the card. */
function Figure({ fact }: { fact: SledFact }) {
  const shown = useRef(fact.value);
  const [, tick] = useState(0);
  useEffect(() => {
    const from = shown.current;
    if (from === fact.value) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number): void => {
      const at = (now - start) / 1000;
      shown.current = countAt(from, fact.value, at);
      tick((n) => n + 1);
      if (at < COUNT_SECONDS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fact.value]);
  return (
    <div class="sled-figure">
      <span class="sled-figure-label">{fact.label}</span>
      <span class="sled-figure-value">
        {shown.current.toFixed(fact.places)}
        <span class="sled-figure-unit">{fact.unit}</span>
      </span>
    </div>
  );
}

/** The readings beside the machine: the figures saying what it IS, and the
 * bars saying what it is against the other three. */
function SledReadings({ sled }: { sled: SledId }) {
  const spec = sledById(sled);
  return (
    <div class="sled-spec">
      <div class="sled-figures">
        {sledFacts(spec).map((fact) => (
          <Figure key={fact.key} fact={fact} />
        ))}
      </div>
      <div class="sled-bars">
        {sledBars(spec).map((bar) => (
          <div key={bar.key} class="sled-bar">
            <span class="sled-bar-label">{bar.label}</span>
            <span class="sled-bar-track">
              <span class="sled-bar-fill" style={{ width: `${(bar.value * 100).toFixed(1)}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SledPage({
  sled,
  onPick,
  onBack,
  onRide,
}: {
  sled: SledId;
  onPick: (id: SledId) => void;
  /** Back to the front door, which is the way in. */
  onBack: () => void;
  /** The press that stands the race up — this card is the end of the flow. */
  onRide: () => void;
}) {
  const spec = sledById(sled);
  return (
    <div class="menu-card menu-card-sled">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.sledTitle} />
      <div class="sled-pick-body">
        {/* THE SLED takes the room: it is the only thing on this card that
            cannot be said in words. */}
        <div class="sled-stage-col">
          <SledPicker sled={sled} onPick={onPick} />
          <p class="sled-blurb">{spec.blurb}</p>
        </div>
        <SledReadings sled={sled} />
      </div>
      {/* The press that rides, wearing the way-on's weight and marked as this
          surface's `next`, so START from anywhere on the card is the grid. */}
      <button
        type="button"
        class="menu-item menu-item-start sled-done"
        data-menu="ride"
        data-nav-next
        onClick={onRide}
      >
        <span class="menu-item-name">{STRINGS.sledRide}</span>
      </button>
    </div>
  );
}
