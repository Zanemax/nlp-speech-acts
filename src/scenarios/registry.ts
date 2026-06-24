import type {
  ActType,
  ConditionId,
  ConditionState,
  EpistemicChannel,
  Scenario,
} from "../core/types";
import { PROBES } from "./probes";
import { hearerPromptFor, speakerPromptFor } from "./felicity";
import { deceptionHearerPrompt, deceptionSpeakerPrompt } from "./deception";

// Assembles a fully-specified Scenario (one experimental cell) from a set of
// toggles. This is the single place that knows how the prompt fragments compose.

export interface ScenarioSpec {
  actType: ActType;
  condition: ConditionId;
  state: ConditionState;
  channel?: EpistemicChannel; // only used for GAMMA
}

export function buildScenario(spec: ScenarioSpec): Scenario {
  const { actType, condition, state } = spec;
  const channel: EpistemicChannel = spec.channel ?? "concealed";

  if (condition === "GAMMA") {
    // Thread 2: assertion + sincerity, with the epistemic-channel cross.
    const speaker = deceptionSpeakerPrompt(state);
    return {
      id: `assertion.GAMMA.${state}.${channel}`,
      actType: "assertion",
      speakerSystemPrompt: speaker.system,
      hearerSystemPrompt: deceptionHearerPrompt(),
      targetUtteranceSpec: speaker.spec,
      conditionUnderTest: "GAMMA",
      conditionState: state,
      epistemicChannel: channel,
      probe: PROBES.assertion,
      elicitPlan: true,
    };
  }

  // Thread 1: promise / command, conditions A1 / A2 / B.
  const speaker = speakerPromptFor(actType, condition, state);
  return {
    id: `${actType}.${condition}.${state}`,
    actType,
    speakerSystemPrompt: speaker.system,
    hearerSystemPrompt: hearerPromptFor(actType, condition, state),
    targetUtteranceSpec: speaker.spec,
    conditionUnderTest: condition,
    conditionState: state,
    epistemicChannel: "concealed",
    probe: PROBES[actType],
    elicitPlan: false,
  };
}

/** Which conditions are valid for which act type (drives the UI). */
export const VALID_CONDITIONS: Record<ActType, ConditionId[]> = {
  promise: ["A1", "A2", "B"],
  command: ["A1", "A2", "B"],
  assertion: ["GAMMA"],
};

export const CONDITION_LABELS: Record<ConditionId, string> = {
  A1: "A.1 — shared procedure exists",
  A2: "A.2 — speaker has authority / standing",
  B: "B — procedure executed correctly",
  GAMMA: "Γ — sincerity (Thread 2)",
};

export const ACT_LABELS: Record<ActType, string> = {
  promise: "Promise (commissive)",
  command: "Command (directive)",
  assertion: "Assertion (representative) — deception probe",
};
