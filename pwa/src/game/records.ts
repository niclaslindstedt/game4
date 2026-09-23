// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORD BOOK — the best time this machine has seen on each map, on each
// sled, in each mode, over each length.
//
// ONE ROW PER (SEED, SLED, MODE, LAPS). The seed is the map: the generator
// is a pure function of it, so two runs on one seed are two runs round the
// same loop. The sled is in the key rather than merely written on the row,
// because the four machines are four answers to the snow — a trail sled's
// time on a groomed loop is not a mountain sled's to beat — and the laps
// are, because a one-lap trial and a three-lap one are two different
// stopwatches. The date the row was set is written on it, and so are the
// clock at every crossing of the run that set it (`splits`), which is what
// the HUD's split is read against at each checkpoint of the next run.
//
// WHICH MODES KEEP A BOOK is `keepsRecords` — both of the modes this slice
// has; a mode whose runs are not comparable (a free ride in a wind of the
// rider's own choosing) is the case the predicate exists for.
//
// Two halves, the way `settings.ts` is split: everything above the storage
// line is PURE — a key, a comparison, a book laid over a book — so
// `tests/records_test.ts` holds the policy without a browser, and the two
// functions under it are the skin over `localStorage`. A machine with no
// storage still keeps this session's book in memory; a row is never
// load-bearing.
//
// A TIE IS NOT A RECORD. The row stands until it is beaten outright.

import { isGameMode, isSledId, type GameMode, type SledId } from "@engine";

/** What names a row. */
export type RecordKey = {
  seed: number;
  sled: SledId;
  mode: GameMode;
  laps: number;
};

/** One row: the time, s; the sled it was set on; when, as a unix ms stamp;
 * and the clock at each crossing of the loop, in order — the start line's
 * first crossing first (`Progress.passed` less one indexes it). */
export type RunRecord = {
  value: number;
  sled: SledId;
  at: number;
  splits: number[];
};

export type RecordBook = Readonly<Record<string, RunRecord>>;

/** WHAT A RUN IS MEASURED AGAINST, as the HUD reads it: the mode it is
 * ridden in, and the row that stood when it began — held for the whole run,
 * so the finish plate can say whether the run beat it after the book has
 * already been rewritten. */
export type RunLedger = { mode: GameMode; standing: RunRecord | null };

/** The row's id. */
export function recordId(key: RecordKey): string {
  return `${key.mode}/${key.seed}/${key.sled}/${key.laps}`;
}

/** WHETHER A MODE KEEPS A BOOK AT ALL (see the header). */
export function keepsRecords(mode: GameMode): boolean {
  return isGameMode(mode);
}

/** Whether `value` beats the row standing — outright, never on a tie — or
 * stands where there is none. A figure that is not a figure beats nothing. */
export function beats(mode: GameMode, value: number, standing: RunRecord | null): boolean {
  if (!keepsRecords(mode)) return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  return standing === null || value < standing.value;
}

export function bestFor(book: RecordBook, key: RecordKey): RunRecord | null {
  return book[recordId(key)] ?? null;
}

/** The book with this run in it, if it earned a row — and whether it did.
 * Pure: the book handed in is never written. */
export function noteRecord(
  book: RecordBook,
  key: RecordKey,
  run: RunRecord,
): { book: RecordBook; record: boolean } {
  const standing = bestFor(book, key);
  if (!beats(key.mode, run.value, standing)) return { book, record: false };
  const row: RunRecord = { ...run, splits: [...run.splits] };
  return { book: { ...book, [recordId(key)]: row }, record: true };
}

/** THE GAP AT A CROSSING: the clock at crossing `index` of this run less
 * the record's at the same crossing, s — negative is ahead. Null where the
 * record has no such crossing or either clock is not a number. */
export function splitGap(record: RunRecord | null, index: number, time: number): number | null {
  if (record === null || index < 0 || index >= record.splits.length) return null;
  const then = record.splits[index];
  return Number.isFinite(then) && Number.isFinite(time) ? time - then : null;
}

/** A stored blob as a book, one row at a time — every row checked, and any
 * that is not a row a run could have set dropped: a time that is not
 * positive and finite, a sled the catalog no longer has. The same rule
 * `mergeSettings` applies, for the same reason. */
export function mergeRecords(parsed: unknown): RecordBook {
  const book: Record<string, RunRecord> = {};
  if (!parsed || typeof parsed !== "object") return book;
  for (const [id, row] of Object.entries(parsed as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<Record<keyof RunRecord, unknown>>;
    if (typeof r.value !== "number" || !Number.isFinite(r.value) || r.value <= 0) continue;
    if (typeof r.sled !== "string" || !isSledId(r.sled)) continue;
    const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
    const splits = Array.isArray(r.splits)
      ? r.splits.filter((s): s is number => typeof s === "number" && Number.isFinite(s))
      : [];
    book[id] = { value: r.value, sled: r.sled, at, splits };
  }
  return book;
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

export const RECORDS_KEY = "powderrun.records.v1";

export function loadRecords(): RecordBook {
  try {
    const stored = localStorage.getItem(RECORDS_KEY);
    return mergeRecords(stored === null ? null : JSON.parse(stored));
  } catch {
    // Storage unavailable, or not JSON — an empty book is a good book.
    return {};
  }
}

export function saveRecords(book: RecordBook): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(book));
  } catch {
    // Storage unavailable — the row still stands for this session.
  }
}
