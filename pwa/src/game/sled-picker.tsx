// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLED PICKER: the machine itself, turning on its stand, with an arrow
// either side of it. A row of names tells a rider nothing about what they
// are about to take out — the shape does: how long the tail is, how far the
// skis stand apart, how tall the lugs are — so the shape is the control.
//
// The turntable's three.js lives in `sled-turntable.ts` and is pulled in
// dynamically: this component is on the app shell's static import chain.
// Until the chunk lands the pane is the backdrop it will be drawn on, which
// is why the name and the arrows are markup rather than anything the canvas
// paints.

import { useEffect, useRef } from "preact/hooks";
import { SLEDS, sledById, type SledId } from "@engine";

import type { SledTurntable } from "./sled-turntable.ts";
import { STRINGS } from "./strings.ts";

export function SledPicker({
  sled,
  livery,
  onPick,
}: {
  sled: SledId;
  /** The livery it is shown in (`sled-liveries.ts`). */
  livery: number;
  onPick: (id: SledId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const standRef = useRef<SledTurntable | null>(null);
  const spec = sledById(sled);
  const index = Math.max(
    0,
    SLEDS.findIndex((s) => s.id === spec.id),
  );
  const step = (by: number): void => onPick(SLEDS[(index + by + SLEDS.length) % SLEDS.length].id);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    // The modelled machines, when this build draws them, are fetched before
    // the stand is built, so it turns the same machine the race will draw.
    void import("./sled-turntable.ts").then(async ({ createSledTurntable, loadModels }) => {
      await loadModels();
      if (disposed) return;
      standRef.current = createSledTurntable(canvas);
      standRef.current.setSled(
        sledById(canvas.dataset.sled ?? spec.id),
        Number(canvas.dataset.livery ?? livery),
      );
    });
    const onResize = (): void => standRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      standRef.current?.dispose();
      standRef.current = null;
    };
    // Built once; the chosen machine flows in through the effect below, so a
    // pick swaps the sled on the stand instead of tearing the canvas down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The id also rides on the canvas, so a stand that finishes loading after
  // a pick has already happened picks it up.
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.dataset.sled = spec.id;
      canvasRef.current.dataset.livery = String(livery);
    }
    standRef.current?.setSled(spec, livery);
  }, [spec, livery]);

  return (
    <div class="sled-pick-row">
      {/* The arrows and the machine between them are ONE stop on a
          controller's walk (`data-nav-steps`, menu-nav.ts): sideways changes
          the sled and leaves the cursor where it is. */}
      <div class="sled-pick" data-nav-steps data-nav-focus>
        <button
          type="button"
          class="sled-pick-step"
          data-nav-step="left"
          data-menu="sled-prev"
          onClick={() => step(-1)}
          aria-label={STRINGS.sledPrev}
        >
          ‹
        </button>
        <div class="sled-pick-stage" role="presentation">
          <canvas ref={canvasRef} class="sled-pick-canvas" />
        </div>
        <button
          type="button"
          class="sled-pick-step"
          data-nav-step="right"
          data-menu="sled-next"
          onClick={() => step(1)}
          aria-label={STRINGS.sledNext}
        >
          ›
        </button>
      </div>
      {/* The name, the kind of machine it is, and where it stands in the
          catalog, as ONE plate across the head of the picture: six machines
          turning one at a time is a carousel with no edges, and `2 / 6` is
          the whole catalog in five characters. */}
      <div class="sled-pick-id">
        <span class="sled-pick-name">{spec.name.toUpperCase()}</span>
        <span class="sled-pick-kind">{spec.kind.toUpperCase()}</span>
        <span class="sled-pick-count">{STRINGS.sledOf(index + 1, SLEDS.length)}</span>
      </div>
    </div>
  );
}
