import type { ActDefinition } from "../core/act";
import { conditionsFor, type ConditionStates } from "./prompts";
import { runDiegoEliza } from "./run";
import { tally, type RunRecord, type TallyCounts } from "./export";

// Batch sweep: run every cell of a condition design N times, so a whole results
// table can be produced in one go instead of toggling by hand.
//
//  • "paper" — baseline plus each condition violated on its own (1 + k cells).
//    This is the design behind the paper's uptake tables.
//  • "full"  — every true/false combination of the conditions (2^k cells).

export type SweepScope = "paper" | "full";

export interface SweepCell {
  states: ConditionStates;
  /** Condition keys set to false in this cell. */
  violated: string[];
  /** Human label, e.g. "none violated" or "convention + standing". */
  label: string;
}

export function enumerateCells(act: ActDefinition, scope: SweepScope): SweepCell[] {
  const keys = conditionsFor(act).map((c) => c.key);
  const allTrue = () => Object.fromEntries(keys.map((k) => [k, true])) as ConditionStates;

  if (scope === "paper") {
    const cells: SweepCell[] = [{ states: allTrue(), violated: [], label: "none violated" }];
    for (const k of keys) {
      cells.push({ states: { ...allTrue(), [k]: false }, violated: [k], label: k });
    }
    return cells;
  }

  // Full factorial: bit i of n decides whether keys[i] is violated.
  const cells: SweepCell[] = [];
  for (let n = 0; n < 2 ** keys.length; n++) {
    const states = allTrue();
    const violated: string[] = [];
    keys.forEach((k, i) => {
      if (n & (1 << i)) {
        states[k] = false;
        violated.push(k);
      }
    });
    cells.push({
      states,
      violated,
      label: violated.length ? violated.join(" + ") : "none violated",
    });
  }
  return cells;
}

export interface SweepProgress {
  cellIndex: number; // 0-based
  cellTotal: number;
  cellLabel: string;
  runsDone: number;
  runsTotal: number;
  behaviouralUp: number;
  denialUp: number;
  errors: number;
  /** Most recent run error, so a failing sweep says why. */
  lastError?: string;
}

export interface SweepOutcome {
  cells: CellResult[];
  /** 0-based index of the first cell NOT completed — where to resume. */
  nextIndex: number;
  /** Set when the sweep gave up because a whole cell failed. */
  abortedReason?: string;
}

export interface CellResult {
  cell: SweepCell;
  runs: RunRecord[];
  behavioural: TallyCounts;
  denial: TallyCounts;
}

/** Parallel dialogues per cell — the API tolerates this comfortably. */
const CONCURRENCY = 4;

/**
 * A quota/rate-limit refusal won't clear by pressing on, and a long sweep is
 * exactly what triggers it. Bail out at once and keep the resume point.
 */
function isQuotaFailure(message?: string): boolean {
  return !!message && /quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(message);
}

export async function runSweep(opts: {
  act: ActDefinition;
  scope: SweepScope;
  n: number;
  model: string;
  /** 0-based cell to begin at, so an interrupted sweep can be resumed. */
  startAt?: number;
  onProgress: (p: SweepProgress) => void;
  onCellDone: (c: CellResult) => void;
  shouldStop: () => boolean;
  /** Injectable for tests; defaults to a real dialogue. */
  runOne?: typeof runDiegoEliza;
}): Promise<SweepOutcome> {
  const { act, scope, n, model, onProgress, onCellDone, shouldStop } = opts;
  const runOne = opts.runOne ?? runDiegoEliza;
  const cells = enumerateCells(act, scope);
  const from = Math.max(0, Math.min(opts.startAt ?? 0, cells.length - 1));
  const done: CellResult[] = [];
  let quotaError: string | undefined;
  let ci = from;

  for (; ci < cells.length; ci++) {
    if (shouldStop()) return { cells: done, nextIndex: ci };
    const cell = cells[ci];
    const runs: RunRecord[] = [];
    let behaviouralUp = 0;
    let denialUp = 0;
    let errors = 0;
    let lastError: string | undefined;

    const report = () =>
      onProgress({
        cellIndex: ci,
        cellTotal: cells.length,
        cellLabel: cell.label,
        runsDone: runs.length + errors,
        runsTotal: n,
        behaviouralUp,
        denialUp,
        errors,
        lastError,
      });
    report();

    let next = 0;
    const worker = async () => {
      while (!shouldStop() && !quotaError) {
        const i = next++;
        if (i >= n) return;
        const r = await runOne(act, cell.states, model);
        if (r.status === "error") {
          errors++;
          lastError = r.error;
          if (isQuotaFailure(r.error)) quotaError = r.error;
        } else {
          runs.push({
            at: new Date().toISOString(),
            status: r.status,
            behavioural: r.behavioural,
            denial: r.denial,
            turns: r.turns,
          });
          if (r.behavioural.uptake === true) behaviouralUp++;
          if (r.denial.uptake === true) denialUp++;
        }
        report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, n) }, worker));

    // The API is refusing us — stop now and leave this cell for the resume.
    if (quotaError) {
      return { cells: done, nextIndex: ci, abortedReason: quotaError };
    }

    // Stopped mid-cell: leave this cell for the resume rather than writing a
    // short file, so every file on disk holds a full n runs.
    if (runs.length < n) {
      return {
        cells: done,
        nextIndex: ci,
        ...(shouldStop() ? {} : { abortedReason: lastError ?? "runs failed in this cell" }),
      };
    }

    const result: CellResult = {
      cell,
      runs,
      behavioural: tally(runs.map((r) => r.behavioural)),
      denial: tally(runs.map((r) => r.denial)),
    };
    done.push(result);
    onCellDone(result);
  }

  return { cells: done, nextIndex: cells.length };
}
