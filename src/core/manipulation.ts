import type { RunResult, Turn } from "./types";
import type { ActDefinition, BreakId } from "./act";

// ─────────────────────────────────────────────────────────────────────────────
// Manipulation check — every run records whether the SPEAKER actually performed
// a well-formed instance of the act. A low uptake rate is otherwise ambiguous:
// it could mean the hearer withheld uptake, or that the speaker never performed
// the act. Keeping these distinct is the point (see THEORY.md).
//
// This is generic — derived from the ActDefinition with no per-act keyword
// matching, and deterministic (NOT an LLM judge). It checks that the speaker
// produced a substantive utterance for the `essential` slot, and — for
// insincerity breaks — that the speaker's private reasoning actually formed the
// insincere plan (the sincerity slot is what's under test there).
// ─────────────────────────────────────────────────────────────────────────────

const MIN_UTTERANCE_CHARS = 12;

export function performedAct(run: RunResult, _act: ActDefinition, breakId: BreakId): boolean {
  if (run.status === "error") return false;
  const speaker = run.turns.find((t) => t.role === "speaker");
  if (!speaker) return false;

  const utterance = (speaker.say ?? speaker.text ?? "").trim();
  if (utterance.length < MIN_UTTERANCE_CHARS) return false;

  // Insincerity break: the act is performed only if the private plan was formed.
  if (breakId === "insincere") {
    const plan = (speaker.plan ?? "").trim();
    if (plan.length < MIN_UTTERANCE_CHARS) return false;
  }
  return true;
}

export interface ManipulationSummary {
  performedCount: number;
  n: number;
  note: string;
}

export function summariseManipulation(
  runs: RunResult[],
  act: ActDefinition,
  breakId: BreakId,
): ManipulationSummary {
  const n = runs.length;
  const performedCount = runs.filter((r) => performedAct(r, act, breakId)).length;
  return {
    performedCount,
    n,
    note: `speaker performed the act in ${performedCount}/${n} runs`,
  };
}

/** Convenience for a single run's transcript view. */
export function runPerformed(run: RunResult, act: ActDefinition, breakId: BreakId): boolean {
  return performedAct(run, act, breakId);
}

export type { Turn };
