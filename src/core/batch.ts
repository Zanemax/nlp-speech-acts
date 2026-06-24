import type {
  BatchConfig,
  BatchProgress,
  CellResult,
  ConditionState,
  RunResult,
  Scenario,
} from "./types";
import { buildScenario } from "../scenarios/registry";
import { runScenario } from "./runner";
import { summarizeCell } from "./aggregate";

// Runs a full experiment: each requested condition state (normally intact &
// broken) executed N times. The browser drives this loop, calling the
// serverless function once per model turn. A small concurrency pool keeps
// wall-clock time down without tripping Gemini rate limits.

const CONCURRENCY = 3;

export interface BatchResult {
  config: BatchConfig;
  cells: Partial<Record<ConditionState, CellResult>>;
  startedAt: number;
  finishedAt: number;
}

export async function runBatch(
  config: BatchConfig,
  onProgress: (p: BatchProgress) => void,
  shouldStop: () => boolean = () => false,
): Promise<BatchResult> {
  const startedAt = Date.now();
  const total = config.states.length * config.n;

  const progress: BatchProgress = {
    total,
    completed: 0,
    byState: Object.fromEntries(
      config.states.map((s) => [s, { completed: 0, uptake: 0, valid: 0 }]),
    ),
  };

  const cells: Partial<Record<ConditionState, CellResult>> = {};

  for (const state of config.states) {
    const scenario: Scenario = buildScenario({
      actType: config.actType,
      condition: config.conditionUnderTest,
      state,
      channel: config.epistemicChannel,
    });

    const runs = await runPool(scenario, config, CONCURRENCY, shouldStop, (r) => {
      const bucket = progress.byState[state];
      bucket.completed += 1;
      if (r.status === "ok") {
        bucket.valid += 1;
        if (r.uptake) bucket.uptake += 1;
      }
      progress.completed += 1;
      onProgress({ ...progress, byState: { ...progress.byState } });
    });

    cells[state] = summarizeCell(scenario, runs);
    if (shouldStop()) break;
  }

  return { config, cells, startedAt, finishedAt: Date.now() };
}

/** Run `config.n` copies of a scenario with a bounded concurrency pool. */
async function runPool(
  scenario: Scenario,
  config: BatchConfig,
  concurrency: number,
  shouldStop: () => boolean,
  onResult: (r: RunResult) => void,
): Promise<RunResult[]> {
  const n = config.n;
  const results: RunResult[] = new Array(n);
  let next = 0;

  async function worker() {
    while (true) {
      if (shouldStop()) return;
      const i = next++;
      if (i >= n) return;
      const r = await runScenario(scenario, config.model, i);
      results[i] = r;
      onResult(r);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, n) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}
