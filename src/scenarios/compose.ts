import type {
  ActType,
  ConditionId,
  ConditionState,
  EpistemicChannel,
} from "../core/types";
import { ACT_WORLDS } from "./felicity";
import { DECEPTION } from "./deception";

// Composes the Sandbox's system prompts from independently toggleable felicity
// conditions. Each condition can be off / intact / broken, so the user builds a
// felicity configuration by selecting clauses — the editable-artifact thesis,
// made interactive. (The Batch path still uses the fixed builders in registry.)

/** A single felicity condition's setting in the Sandbox. */
export type CondSetting = "off" | "intact" | "broken";

export interface SandboxConditions {
  a1: CondSetting; // A.1 shared procedure (hearer-side)
  a2: CondSetting; // A.2 authority / standing (shared)
  bBroken: boolean; // B execution botched (speaker spec)
  gamma: "sincere" | "deceptive"; // Γ sincerity (assertion only)
  channel: EpistemicChannel; // epistemic channel (assertion only)
}

/** Which condition controls apply to each act type (drives the UI). */
export const CONTROLS_FOR: Record<ActType, ("a1" | "a2" | "b" | "gamma" | "channel")[]> = {
  promise: ["a1", "a2", "b"],
  command: ["a1", "a2", "b"],
  assertion: ["gamma", "channel"],
};

/** Sensible defaults: hold everything intact, then set the focus condition. */
export function defaultConditions(condition: ConditionId, state: ConditionState): SandboxConditions {
  const base: SandboxConditions = {
    a1: "intact",
    a2: "intact",
    bBroken: false,
    gamma: "deceptive",
    channel: "concealed",
  };
  switch (condition) {
    case "A1":
      base.a1 = state;
      break;
    case "A2":
      base.a2 = state;
      break;
    case "B":
      base.bBroken = state === "broken";
      break;
    case "GAMMA":
      base.gamma = state === "broken" ? "deceptive" : "sincere";
      break;
  }
  return base;
}

export interface ComposedScenario {
  speakerSystemPrompt: string;
  hearerSystemPrompt: string;
  targetUtteranceSpec: string;
  elicitPlan: boolean;
}

export function composePrompts(actType: ActType, c: SandboxConditions): ComposedScenario {
  if (actType === "assertion") {
    const clause = c.gamma === "deceptive" ? DECEPTION.deceptiveClause : DECEPTION.sincereClause;
    const spec = c.gamma === "deceptive" ? DECEPTION.deceptiveSpec : DECEPTION.sincereSpec;
    return {
      speakerSystemPrompt: `${DECEPTION.speakerBase} ${DECEPTION.scene}\n\n${clause} ${DECEPTION.planFormat}`,
      hearerSystemPrompt: DECEPTION.hearerBase,
      targetUtteranceSpec: spec,
      elicitPlan: true,
    };
  }

  const w = ACT_WORLDS[actType];
  const speakerParts = [w.speakerBase];
  if (c.a2 !== "off") speakerParts.push(c.a2 === "broken" ? w.a2Broken : w.a2Intact);

  const hearerParts = [w.hearerBase];
  if (c.a1 !== "off") hearerParts.push(c.a1 === "broken" ? w.a1Broken : w.a1Intact);
  if (c.a2 !== "off") hearerParts.push(c.a2 === "broken" ? w.a2Broken : w.a2Intact);

  return {
    speakerSystemPrompt: speakerParts.join("\n\n"),
    hearerSystemPrompt: hearerParts.join("\n\n"),
    targetUtteranceSpec: c.bBroken ? w.bBrokenSpec : w.targetUtteranceSpec,
    elicitPlan: false,
  };
}

/** Infer a single condition-under-test for promoting a Sandbox config to a Batch. */
export function focusCondition(
  actType: ActType,
  c: SandboxConditions,
): { condition: ConditionId; state: ConditionState } {
  if (actType === "assertion") {
    return { condition: "GAMMA", state: c.gamma === "deceptive" ? "broken" : "intact" };
  }
  if (c.a2 === "broken") return { condition: "A2", state: "broken" };
  if (c.a1 === "broken") return { condition: "A1", state: "broken" };
  if (c.bBroken) return { condition: "B", state: "broken" };
  return { condition: "A1", state: "intact" };
}
