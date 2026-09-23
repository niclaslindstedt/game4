// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S BODY ON ITS LEGS (`rider-pose.ts`): sat at a crawl, half up on
// the move, stood tall in the air; a landing folds him down and he comes
// back up; hung off into a turn, his hips go past the seat and his upper
// body further, his head held nearer level than his shoulders.

import { describe, expect, it } from "vitest";

import { createRiderSpring, riderPose, stepRiderSpring } from "../pwa/src/game/rider-pose.ts";

const base = { riderRight: 0, riderAft: 0, lean: 0, steer: 0, airborne: false, landing: 5 };

describe("the body on its legs", () => {
  it("sits at a crawl, stands half up on the move and tall in the air", () => {
    const s = createRiderSpring();
    for (let i = 0; i < 120; i++) stepRiderSpring(s, 0, 0, false, 1 / 60);
    const sat = s.stand;
    for (let i = 0; i < 120; i++) stepRiderSpring(s, 0, 20, false, 1 / 60);
    const moving = s.stand;
    for (let i = 0; i < 60; i++) stepRiderSpring(s, 0, 20, true, 1 / 60);
    expect(sat).toBeLessThan(0.05);
    expect(moving).toBeGreaterThan(0.5);
    expect(s.stand).toBeGreaterThan(0.95);
    expect(riderPose({ ...base, stand: 1 }).hips.y).toBeGreaterThan(
      riderPose({ ...base, stand: 0 }).hips.y + 0.15,
    );
  });

  it("folds on a landing and springs back up", () => {
    const s = createRiderSpring();
    stepRiderSpring(s, -6, 15, true, 1 / 60);
    let deepest = 0;
    for (let i = 0; i < 90; i++) {
      stepRiderSpring(s, 0, 15, false, 1 / 60);
      deepest = Math.max(deepest, s.bump);
    }
    expect(deepest).toBeGreaterThan(0.1);
    expect(Math.abs(s.bump)).toBeLessThan(0.02);
    const folded = riderPose({ ...base, stand: 1, bump: 0.2 });
    expect(folded.hips.y).toBeLessThan(riderPose({ ...base, stand: 1 }).hips.y - 0.15);
  });

  it("hangs off the inside of a turn, the head nearer level than the shoulders", () => {
    const hung = riderPose({ ...base, stand: 0.6, riderRight: -0.3, steer: -1 });
    expect(hung.hips.x).toBeLessThan(-0.25);
    expect(hung.neck.x).toBeLessThan(hung.hips.x);
    const tilt = Math.atan2(hung.neck.x - hung.hips.x, hung.neck.y - hung.hips.y);
    const head = Math.atan2(hung.head.x - hung.neck.x, hung.head.y - hung.neck.y);
    expect(Math.abs(head)).toBeLessThan(Math.abs(tilt));
  });
});
