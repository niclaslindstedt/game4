// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The seam between the app shell and the three.js world: everything App.tsx
// may ask of the renderer, and nothing else. The shell owns WHEN a frame is
// drawn and WHICH state it shows; the renderer owns how it looks, and never
// writes a `GameState`.
import type { GameState } from "@engine";

/** The camera ladder, nearest first. */
export type CameraRung = "hood" | "bars" | "chase" | "far" | "high" | "orbit";

export interface WorldRenderer {
  /** Build (or rebuild, for a new level) everything that depends on the map.
   * Heavy: the loading card calls it behind a frame so the card can paint. */
  load(state: GameState): Promise<void>;
  /** Draw one frame of `state`. `alpha` is the accumulator's leftover share of
   * a step (0..1) for interpolation; `dt` is wall seconds since the last frame. */
  draw(state: GameState, alpha: number, dt: number): void;
  /** Which camera a RUN is seen through; menus use "orbit". */
  setCamera(rung: CameraRung): void;
  camera(): CameraRung;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}
