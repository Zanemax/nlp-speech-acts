import type {
  CellResult,
  ConditionId,
  ConditionState,
  RunResult,
  RunStatus,
  Turn,
  UptakeCategory,
} from "./types";
import {
  BREAKS,
  BREAK_TO_CONDITION,
  CONDITION_TO_BREAK,
  actById,
  type ActDefinition,
  type BreakId,
} from "./act";
import { performedAct, summariseManipulation } from "./manipulation";

// ─────────────────────────────────────────────────────────────────────────────
// Loader + adapter. Reads a result JSON file (the app's existing export shape)
// and turns it into a display view. The schema is PRESERVED and only read
// additively: old files tag the manipulated condition with Austin/Searle ids
// (conditionUnderTest: A1/A2/B/GAMMA); new files may carry `breakId` directly.
// Both load.
// ─────────────────────────────────────────────────────────────────────────────

/** Loose shape we accept — tolerant of old and new files. */
interface LoadedConfig {
  actType: string;
  conditionUnderTest?: ConditionId;
  breakId?: BreakId; // additive: new files may set this directly
  n?: number;
  states?: ConditionState[];
  epistemicChannel?: string;
  model?: { speakerModel?: string; hearerModel?: string; temperature?: number } | string;
}

export interface LoadedResult {
  config: LoadedConfig;
  cells: Partial<Record<ConditionState, CellResult>>;
  startedAt?: number;
  finishedAt?: number;
}

export class ResultLoadError extends Error {}

/** Parse + validate untrusted JSON into a LoadedResult, or throw a clear error. */
export function parseResult(raw: unknown): LoadedResult {
  if (!raw || typeof raw !== "object") throw new ResultLoadError("File is not a JSON object.");
  const obj = raw as Record<string, unknown>;
  const config = obj.config as LoadedConfig | undefined;
  const cells = obj.cells as Partial<Record<ConditionState, CellResult>> | undefined;

  if (!config || typeof config.actType !== "string") {
    throw new ResultLoadError("Missing `config.actType` — is this a result file?");
  }
  if (!cells || (!cells.intact && !cells.broken)) {
    throw new ResultLoadError("Missing `cells.intact` / `cells.broken`.");
  }
  for (const [state, cell] of Object.entries(cells) as [ConditionState, CellResult][]) {
    if (!cell || !Array.isArray(cell.runs)) {
      throw new ResultLoadError(`cells.${state} has no \`runs\` array.`);
    }
  }
  return { config, cells, startedAt: obj.startedAt as number, finishedAt: obj.finishedAt as number };
}

/** Which break a loaded result manipulated (new `breakId`, else legacy mapping). */
export function breakIdOf(result: LoadedResult): BreakId {
  const c = result.config;
  if (c.breakId && BREAKS[c.breakId]) return c.breakId;
  if (c.conditionUnderTest && CONDITION_TO_BREAK[c.conditionUnderTest]) {
    return CONDITION_TO_BREAK[c.conditionUnderTest];
  }
  throw new ResultLoadError("Result has neither `breakId` nor a recognised `conditionUnderTest`.");
}

export interface RunView {
  index: number;
  uptake: boolean | null;
  category: UptakeCategory;
  status: RunStatus;
  performed: boolean;
  turns: Turn[];
}

export interface CellView {
  state: ConditionState;
  n: number;
  uptakeCount: number;
  rate: number;
  invalidCount: number;
  performedCount: number;
  performedNote: string;
  runs: RunView[];
}

export interface ExplorerView {
  source: string;
  actId: string;
  actName: string;
  uptakeSignature: string;
  breakId: BreakId;
  breakLabel: string;
  breakGloss: string;
  n: number;
  model: string;
  intact?: CellView;
  broken?: CellView;
}

export function buildView(
  result: LoadedResult,
  source: string,
  customs: ActDefinition[] = [],
): ExplorerView {
  const breakId = breakIdOf(result);
  const act = resolveAct(result.config.actType, customs);

  const intact = result.cells.intact && buildCell("intact", result.cells.intact, act, breakId);
  const broken = result.cells.broken && buildCell("broken", result.cells.broken, act, breakId);

  const n = result.config.n ?? broken?.n ?? intact?.n ?? 0;

  return {
    source,
    actId: act.id,
    actName: act.name,
    uptakeSignature: act.uptakeSignature,
    breakId,
    breakLabel: BREAKS[breakId].label,
    breakGloss: BREAKS[breakId].gloss,
    n,
    model: modelLabel(result.config.model),
    intact,
    broken,
  };
}

function buildCell(
  state: ConditionState,
  cell: CellResult,
  act: ActDefinition,
  breakId: BreakId,
): CellView {
  const runs = cell.runs;
  const n = runs.length;
  const uptakeCount = runs.filter((r) => r.status === "ok" && r.uptake === true).length;
  const invalidCount = runs.filter((r) => r.status !== "ok").length;
  const manip = summariseManipulation(runs, act, breakId);

  const runViews: RunView[] = runs.map((r: RunResult, i) => ({
    index: r.index ?? i,
    uptake: r.uptake,
    category: r.category,
    status: r.status,
    performed: performedAct(r, act, breakId),
    turns: r.turns ?? [],
  }));

  return {
    state,
    n,
    uptakeCount,
    rate: n > 0 ? uptakeCount / n : 0,
    invalidCount,
    performedCount: manip.performedCount,
    performedNote: manip.note,
    runs: runViews,
  };
}

/** Resolve an act, falling back to a minimal placeholder for unknown act ids. */
function resolveAct(actType: string, customs: ActDefinition[]): ActDefinition {
  const found = actById(actType, customs);
  if (found) return found;
  return {
    id: actType,
    name: actType.charAt(0).toUpperCase() + actType.slice(1),
    utteranceExample: "",
    propositionalContent: "",
    preparatory: [],
    sincerity: null,
    essential: "",
    uptakeSignature: "the hearer acts on the act in later turns",
    isBuiltIn: false,
  };
}

function modelLabel(model: LoadedConfig["model"]): string {
  if (!model) return "unknown model";
  if (typeof model === "string") return model;
  const s = model.speakerModel ?? "?";
  const h = model.hearerModel ?? s;
  return s === h ? s : `${s} → ${h}`;
}

export { BREAK_TO_CONDITION };
