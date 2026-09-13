import type { Turn } from "../core/types";
import { PROMISE } from "../core/act";
import {
  conditionText,
  conditionsFor,
  generateAustin,
  type ConditionStates,
} from "./prompts";
import type { UptakeVerdict } from "./run";

// Shared shape for every JSON the app writes, so a single-setup export and one
// cell of a sweep are the same document and can be analysed the same way.

export interface RunRecord {
  at: string;
  status: string;
  behavioural: UptakeVerdict;
  denial: UptakeVerdict;
  turns: Turn[];
}

export interface TallyCounts {
  tookUp: number;
  didNotTakeUp: number;
  unreadable: number;
}

export function tally(vs: UptakeVerdict[]): TallyCounts {
  return {
    tookUp: vs.filter((v) => v.uptake === true).length,
    didNotTakeUp: vs.filter((v) => v.uptake === false).length,
    unreadable: vs.filter((v) => v.uptake === null).length,
  };
}

export interface ExportOptions {
  states: ConditionStates;
  model: string;
  runs: RunRecord[];
  /** Overrides actually sent, when the user hand-edited the context prompts. */
  diegoContextPrompt?: string;
  elizaContextPrompt?: string;
}

export function buildExport({
  states,
  model,
  runs,
  diegoContextPrompt,
  elizaContextPrompt,
}: ExportOptions) {
  const scenario = generateAustin(states);
  const conditions = conditionsFor();
  const edited =
    (diegoContextPrompt !== undefined && diegoContextPrompt !== scenario.diegoContextPrompt) ||
    (elizaContextPrompt !== undefined && elizaContextPrompt !== scenario.elizaContextPrompt);

  return {
    exportedAt: new Date().toISOString(),
    app: "AUSTIN BOT",
    setup: {
      act: PROMISE.name,
      actId: PROMISE.id,
      model,
      contextPromptsEdited: edited,
      conditions: conditions.map((c) => ({
        key: c.key,
        label: c.label,
        theory: c.theory,
        state: (states[c.key] ?? true) ? "true" : "false",
        goesInto: c.side === "both" ? "Diego and Eliza" : c.side,
        insertedAs: c.target === "trigger" ? "Diego's first message" : "context prompt",
        text: conditionText(c, states[c.key] ?? true),
      })),
      diegoContextPrompt: diegoContextPrompt ?? scenario.diegoContextPrompt,
      elizaContextPrompt: elizaContextPrompt ?? scenario.elizaContextPrompt,
      triggerMessage: scenario.triggerMessage,
      behaviouralTest: scenario.behaviouralTest,
      denialTest: scenario.denialTest,
    },
    summary: {
      runs: runs.length,
      behavioural: tally(runs.map((r) => r.behavioural)),
      denial: tally(runs.map((r) => r.denial)),
    },
    runs: runs.map((r, i) => ({
      run: i + 1,
      at: r.at,
      behavioural: r.behavioural,
      denial: r.denial,
      turns: r.turns.map((t) => ({
        role: t.role === "speaker" ? "Diego" : t.role === "hearer" ? "Eliza" : (t.label ?? "probe"),
        ...(t.plan !== undefined ? { plan: t.plan } : {}),
        ...(t.role === "probe" ? { question: t.shown } : {}),
        text: t.role === "speaker" && t.say !== undefined ? t.say : t.text,
      })),
    })),
  };
}

/** "all-intact" or "violated-convention-standing" — used in filenames. */
export function violatedTag(violated: string[]): string {
  return violated.length ? `violated-${violated.join("-")}` : "all-intact";
}

export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function stamp(d = new Date()): string {
  return d.toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
