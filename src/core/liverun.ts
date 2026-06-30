import type {
  BatchProgress,
  CellResult,
  ConditionState,
  ModelConfig,
  RunResult,
  Scenario,
  Turn,
} from "./types";
import { generate, GeminiError } from "../api/gemini";
import { generateScenario } from "../scenarios/generate";
import { scoreBehavior } from "./score";
import { parsePlanSay } from "./uptake";
import { summarizeCell } from "./aggregate";
import { BREAK_TO_CONDITION, type ActDefinition, type BreakId } from "./act";
import type { LoadedResult } from "./explorer";

// ─────────────────────────────────────────────────────────────────────────────
// Live execution. One dialogue = speaker performs the act → hearer responds →
// in-world follow-up → behavioral score + manipulation check. An experiment runs
// the intact and broken cells N times each and returns a result in the SAME shape
// the app exports, so it flows straight into the Explorer display.
//
// The browser drives the loop (one short serverless call per turn). No LLM judge
// is anywhere in this path — scoring is done by score.ts deterministically.
// ─────────────────────────────────────────────────────────────────────────────

const CONCURRENCY = 3;

/** Run a single dialogue. `breakId === null` is the intact (baseline) cell. */
export async function runOnce(
  act: ActDefinition,
  breakId: BreakId | null,
  model: ModelConfig,
  index: number,
  onTurn?: (t: Turn) => void,
): Promise<RunResult> {
  const gen = generateScenario(act, breakId);
  const scenarioId = `${act.id}.${breakId ?? "intact"}`;
  const turns: Turn[] = [];
  const emit = (t: Turn) => {
    turns.push(t);
    onTurn?.(t);
  };

  try {
    // 1. Speaker performs (or botches) the act.
    const speakerRaw = await generate({
      model: model.speakerModel,
      system: gen.speakerSystemPrompt,
      messages: [{ role: "user", content: gen.targetUtteranceSpec }],
      temperature: model.temperature,
      maxOutputTokens: 600,
    });
    const speakerTurn: Turn = { role: "speaker", text: speakerRaw };
    let visible: string;
    if (gen.elicitPlan) {
      const p = parsePlanSay(speakerRaw);
      speakerTurn.plan = p.plan;
      speakerTurn.say = p.say;
      visible = `Sam says: "${(p.say ?? speakerRaw).trim()}"`;
    } else {
      visible = `Sam says: "${speakerRaw.trim()}"`;
    }
    emit(speakerTurn);

    // 2. Hearer responds in-world.
    const hist: { role: "user" | "model"; content: string }[] = [{ role: "user", content: visible }];
    const hearerReply = await generate({
      model: model.hearerModel,
      system: gen.hearerSystemPrompt,
      messages: hist,
      temperature: model.temperature,
      maxOutputTokens: 400,
    });
    emit({ role: "hearer", text: hearerReply, shown: visible });
    hist.push({ role: "model", content: hearerReply });

    // 3. In-world follow-up → behavioral read.
    hist.push({ role: "user", content: gen.followUp });
    const behavior = await generate({
      model: model.hearerModel,
      system: gen.hearerSystemPrompt,
      messages: hist,
      temperature: model.temperature,
      maxOutputTokens: 200,
    });
    const verdict = scoreBehavior(behavior, gen.directive);
    emit({ role: "probe", text: behavior, shown: gen.followUp });

    return {
      scenarioId,
      index,
      status: verdict.uptake === null ? "invalid" : "ok",
      uptake: verdict.uptake,
      category: verdict.category,
      turns,
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : (err as Error).message;
    return { scenarioId, index, status: "error", uptake: null, category: "invalid", turns, error: message };
  }
}

export interface ExperimentResult extends LoadedResult {}

/** Run the intact + broken cells N times each. Returns an Explorer-ready result. */
export async function runExperiment(
  act: ActDefinition,
  breakId: BreakId,
  n: number,
  model: ModelConfig,
  onProgress: (p: BatchProgress) => void,
  shouldStop: () => boolean = () => false,
): Promise<ExperimentResult> {
  const startedAt = Date.now();
  const progress: BatchProgress = {
    total: 2 * n,
    completed: 0,
    byState: {
      intact: { completed: 0, uptake: 0, valid: 0 },
      broken: { completed: 0, uptake: 0, valid: 0 },
    },
  };

  const cells: Partial<Record<ConditionState, CellResult>> = {};
  const plan: [ConditionState, BreakId | null][] = [
    ["intact", null],
    ["broken", breakId],
  ];

  for (const [state, bid] of plan) {
    const runs = await pool(act, bid, n, model, shouldStop, (r) => {
      const bucket = progress.byState[state];
      bucket.completed += 1;
      if (r.status === "ok") {
        bucket.valid += 1;
        if (r.uptake) bucket.uptake += 1;
      }
      progress.completed += 1;
      onProgress({ ...progress, byState: { ...progress.byState } });
    });
    cells[state] = summarizeCell(liveScenario(act, bid, state, model), runs);
    if (shouldStop()) break;
  }

  return {
    config: {
      actType: act.id,
      breakId,
      conditionUnderTest: BREAK_TO_CONDITION[breakId],
      epistemicChannel: "concealed",
      n,
      states: ["intact", "broken"],
      model,
    },
    cells,
    startedAt,
    finishedAt: Date.now(),
  };
}

async function pool(
  act: ActDefinition,
  breakId: BreakId | null,
  n: number,
  model: ModelConfig,
  shouldStop: () => boolean,
  onResult: (r: RunResult) => void,
): Promise<RunResult[]> {
  const results: RunResult[] = new Array(n);
  let next = 0;
  async function worker() {
    while (true) {
      if (shouldStop()) return;
      const i = next++;
      if (i >= n) return;
      const r = await runOnce(act, breakId, model, i);
      results[i] = r;
      onResult(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, n) }, worker));
  return results.filter(Boolean);
}

// A lightweight Scenario for the cell record. The Explorer reads the act/break
// from `config`, not from here, so this only needs to satisfy the type — the
// act id may not be one of the legacy ActType literals, hence the cast.
function liveScenario(
  act: ActDefinition,
  breakId: BreakId | null,
  state: ConditionState,
  _model: ModelConfig,
): Scenario {
  const gen = generateScenario(act, breakId);
  return {
    id: `${act.id}.${breakId ?? "intact"}`,
    actType: act.id,
    speakerSystemPrompt: gen.speakerSystemPrompt,
    hearerSystemPrompt: gen.hearerSystemPrompt,
    targetUtteranceSpec: gen.targetUtteranceSpec,
    conditionUnderTest: breakId ? BREAK_TO_CONDITION[breakId] : "A1",
    conditionState: state,
    epistemicChannel: "concealed",
    probe: { prompt: gen.followUp, options: {}, uptakeCategories: [] },
    elicitPlan: gen.elicitPlan,
  } as unknown as Scenario;
}
