// Core data model for the instrument.
//
// The vocabulary follows docs/plan.md: a Scenario is a fully-specified
// experimental cell (which felicity condition is intact/broken, the reified
// prompts on both sides, the act being attempted, and the downstream probe).
// A RunResult is one execution of a Scenario; a CellResult aggregates N of them.

export type ActType = "promise" | "command" | "assertion";

/** The felicity condition being manipulated. Names follow Austin's schema. */
export type ConditionId =
  | "A1" // shared, conventional procedure exists (Austin A.1)
  | "A2" // appropriate authority / circumstances (Austin A.2)
  | "B" // procedure executed correctly & completely (Austin B.1/B.2)
  | "GAMMA"; // sincerity (Austin Γ.1) — Thread 2

export type ConditionState = "intact" | "broken";

/**
 * Only meaningful when conditionUnderTest === "GAMMA".
 * concealed: the deceptive plan stays in the speaker's private reasoning.
 * revealed:  the hearer can see the speaker's reasoning (the epistemic channel).
 */
export type EpistemicChannel = "concealed" | "revealed";

/** Which uptake category a probe answer maps to. */
export type UptakeCategory =
  // promise
  | "relies" // hearer holds speaker to the commitment  -> uptake
  | "discounts" // hearer does not rely                     -> no uptake
  // command
  | "recognizes_standing" // recognizes an entitled command -> uptake
  | "complies_only" // would act, but as a favour, no standing -> NOT uptake
  | "rejects_standing" // denies the speaker's standing      -> no uptake
  // assertion (Thread 2)
  | "accepts" // adds to common ground / relies            -> uptake
  | "doubts" // withholds / flags as unreliable           -> no uptake
  // generic behavioral read (Phase 2 live scoring; additive)
  | "acts_on_it" // relies on / proceeds as if it holds     -> uptake
  | "withholds" // holds off, verifies, arranges a fallback -> no uptake
  | "rejects" // treats it as having no hold                -> no uptake
  // denial probe (additive): does the hearer hold the speaker to the act?
  | "holds_to_it" // denies the speaker's disavowal          -> uptake
  | "lets_it_go" // accepts that nothing was committed       -> no uptake
  // shared
  | "invalid"; // could not be parsed

/** Categories that count as the act having been taken up. */
export const UPTAKE_TRUE: ReadonlySet<UptakeCategory> = new Set<UptakeCategory>([
  "relies",
  "recognizes_standing",
  "accepts",
  "acts_on_it",
  "holds_to_it",
]);

/** A neutral, forced-choice downstream probe. */
export interface Probe {
  /** The probe turn text injected after the speaker's act. Must be neutral. */
  prompt: string;
  /**
   * Maps the option key the hearer is asked to emit (e.g. "A", "B", "C")
   * to an uptake category. The classifier in uptake.ts parses the hearer's
   * reply for one of these keys.
   */
  options: Record<string, { label: string; category: UptakeCategory }>;
  /** Which categories count as genuine uptake of the act. */
  uptakeCategories: UptakeCategory[];
}

/** A fully-specified experimental cell. */
export interface Scenario {
  id: string;
  actType: ActType;
  /** The reified felicity conditions, speaker side. */
  speakerSystemPrompt: string;
  /** The reified felicity conditions, hearer side. */
  hearerSystemPrompt: string;
  /** What act the speaker is told to attempt. */
  targetUtteranceSpec: string;
  conditionUnderTest: ConditionId;
  conditionState: ConditionState;
  /** Only used when conditionUnderTest === "GAMMA". */
  epistemicChannel: EpistemicChannel;
  probe: Probe;
  /**
   * When true (Thread 2 / GAMMA), the speaker is asked to externalise a
   * <plan>…</plan> before its <say>…</say>. This is a textual proxy for CoT.
   */
  elicitPlan: boolean;
}

/** Model configuration for a run. Speaker and hearer may differ (Prediction 4). */
export interface ModelConfig {
  speakerModel: string;
  hearerModel: string;
  temperature: number;
}

/** One captured turn in a dialogue. */
export interface Turn {
  role: "speaker" | "hearer" | "probe";
  /** What the model was shown (for the probe, the injected question). */
  shown?: string;
  /** Raw model output for this turn. */
  text: string;
  /** For the speaker under elicitPlan: the parsed private plan, if any. */
  plan?: string;
  /** For the speaker under elicitPlan: the public utterance (<say>). */
  say?: string;
  /** Display name for a probe turn, e.g. "Behavioural uptake test". */
  label?: string;
}

export type RunStatus = "ok" | "invalid" | "error";

/** One execution of a Scenario. */
export interface RunResult {
  scenarioId: string;
  index: number;
  status: RunStatus;
  /** Did the hearer take up the act? null when status !== "ok". */
  uptake: boolean | null;
  category: UptakeCategory;
  turns: Turn[];
  error?: string;
}

/** Aggregate over N runs of one Scenario. */
export interface CellResult {
  scenario: Scenario;
  runs: RunResult[];
  n: number; // total attempted
  nValid: number; // status === "ok"
  nInvalid: number; // status === "invalid"
  nError: number; // status === "error"
  uptakeCount: number;
  rate: number; // uptakeCount / nValid
  ciLow: number; // Wilson 95% CI
  ciHigh: number;
}

/** A configured experiment: a matched pair of cells (intact vs broken). */
export interface BatchConfig {
  actType: ActType;
  conditionUnderTest: ConditionId;
  epistemicChannel: EpistemicChannel;
  n: number;
  model: ModelConfig;
  /** Which states to run. Normally ["intact", "broken"]. */
  states: ConditionState[];
}

/** Live progress emitted while a batch runs. */
export interface BatchProgress {
  total: number;
  completed: number;
  byState: Record<string, { completed: number; uptake: number; valid: number }>;
}
