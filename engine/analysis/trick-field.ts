// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TRICK FIELD, held on the finished map: read off the kickers the
// level publishes (`Kicker.trick`), never off the plan that laid them. A map
// with no field is not a fault — only a map built for a tricks run carries
// one — so every check here is of a field that is there.

import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Kicker, Level } from "../mapgen/types.ts";
import type { Severity } from "./index.ts";

type Add = (rule: string, severity: Severity, message: string) => void;

/** Hold the field's kickers to R20: how many, their sizes in turn, the lead
 * either side of the start line, and the gap between one and the next and
 * between any of them and R9's. `onTrack` is every kicker on the loop. */
export function checkTrickField(level: Level, onTrack: readonly Kicker[], add: Add): void {
  const F = R.trick;
  const field = onTrack.filter((k) => k.trick).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
  if (field.length === 0) return;
  const L = level.track.length;
  if (!withinBand(field.length, F.count)) {
    add("R20", "error", `${field.length} trick kicker(s) (band ${F.count.min}–${F.count.max})`);
  }
  const span = (k: Kicker): [number, number] => [(k.s ?? 0) - k.ramp, (k.s ?? 0) + k.landing];
  field.forEach((k, i) => {
    const want = F.heights[i % F.heights.length];
    if (Math.abs(k.height - want) > 1e-6) {
      add("R20", "error", `${k.id} stands ${k.height.toFixed(1)} m (its turn is ${want} m)`);
    }
    const [from, to] = span(k);
    if (from < F.lead - 1 || to > L - F.lead + 1) {
      add("R20", "error", `${k.id} stands inside the lead either side of the start line`);
    }
    const next = field[i + 1];
    if (next && span(next)[0] - to < F.gap - 1) {
      add("R20", "error", `${k.id} and ${next.id} leave ${(span(next)[0] - to).toFixed(0)} m`);
    }
    for (const c of onTrack) {
      if (c.trick) continue;
      const [a, b] = span(c);
      if (from < b + F.gap - 1 && to > a - F.gap + 1) {
        add("R20", "error", `${k.id} crowds ${c.id}`);
      }
    }
  });
}
