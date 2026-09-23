// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED CARD — which machine, on a screen of its own, and the last thing
// between the rider and the grid.
//
// A ROW OF NAMES CANNOT ASK THIS QUESTION. "HARE / FOX / IBEX / STOAT /
// BEAVER / BISON" asks a rider to choose between six machines they have
// never seen by picking one of six words, and the catalog is six answers to
// a kind of snow. So it takes a card, the way the sibling games give the car and
// the craft theirs: the machine turning on its stand, drawn by the builder
// the race draws with, with the numbers beside it.
//
// IT IS THE LAST CARD BEFORE THE SNOW, and RIDE is on it. The front door's
// RACE tile says where (the seed on it); this card says what with, and then
// goes — so the last picture a rider sees before the loading card is the
// machine they are about to stand on.
//
// TWO THINGS ARE ON IT: THE SLED, which is the decision, and the readings
// beside it — three figures and six bars (`sled-stats.ts`). The card's one
// line of prose is the catalog's own blurb, standing in the picture under
// the machine. It WRITES `settings.sled`; a race stood up from here and one
// a `?sled=` link boots into read the same machine the same way.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { sledById, type SledId } from "@engine";

import { COUNT_SECONDS, countAt } from "../lib/count.ts";
import { MenuHead } from "./menu-knobs.tsx";
import { SledPicker } from "./sled-picker.tsx";
import { LIVERIES } from "./sled-liveries.ts";
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

/** THE LIVERIES: a swatch for each way the machine is sold dressed — its
 * paint with its trim across it — and the one it is in, pressed. One stop on
 * a controller's walk, stepped sideways like the machine above it. */
function Liveries({
  sled,
  livery,
  onLivery,
}: {
  sled: SledId;
  livery: number;
  onLivery: (index: number) => void;
}) {
  const list = LIVERIES[sled];
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  return (
    <div class="sled-liveries" role="radiogroup" aria-label={STRINGS.sledLivery}>
      <span class="sled-livery-label">{STRINGS.sledLivery.toUpperCase()}</span>
      {list.map((l, i) => (
        <button
          key={l.name}
          type="button"
          role="radio"
          aria-checked={i === livery}
          class={`sled-livery${i === livery ? " is-on" : ""}`}
          data-menu={`livery-${i}`}
          title={l.name}
          aria-label={l.name}
          style={{ background: `linear-gradient(135deg, ${hex(l.body)} 58%, ${hex(l.trim)} 58%)` }}
          onClick={() => onLivery(i)}
        />
      ))}
      <span class="sled-livery-name">{list[livery]?.name.toUpperCase()}</span>
    </div>
  );
}

/** The readings beside the machine: the figures saying what it IS, and the
 * bars saying what it is against the others. */
function SledReadings({ sled, children }: { sled: SledId; children?: ComponentChildren }) {
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
      {children}
    </div>
  );
}

export function SledPage({
  sled,
  liveries,
  onPick,
  onLivery,
  onBack,
  onRide,
}: {
  sled: SledId;
  /** The liveries the rider has dressed each machine in (`Settings.liveries`). */
  liveries: Partial<Record<SledId, number>>;
  onPick: (id: SledId) => void;
  /** ...and the same, with this machine's changed. */
  onLivery: (liveries: Partial<Record<SledId, number>>) => void;
  /** Back to the front door, which is the way in. */
  onBack: () => void;
  /** The press that stands the race up — this card is the end of the flow. */
  onRide: () => void;
}) {
  const spec = sledById(sled);
  const livery = liveries[spec.id] ?? 0;
  const pick = (index: number) => onLivery({ ...liveries, [spec.id]: index });
  return (
    <div class="menu-card menu-card-sled">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.sledTitle} />
      <div class="sled-pick-body">
        {/* THE SLED takes the room: it is the only thing on this card that
            cannot be said in words. */}
        <div class="sled-stage-col">
          <SledPicker sled={sled} livery={livery} onPick={onPick} />
          <p class="sled-blurb">{spec.blurb}</p>
        </div>
        <SledReadings sled={sled}>
          <Liveries sled={spec.id} livery={livery} onLivery={pick} />
        </SledReadings>
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
