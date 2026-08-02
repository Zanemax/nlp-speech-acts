import type { ActDefinition } from "../core/act";
import { isDirective } from "../scenarios/generate";

// ─────────────────────────────────────────────────────────────────────────────
// AUSTIN BOT prompt composition. Diego is the speaker, Eliza the listener.
//
// Each felicity condition is an independent toggle carrying two verbatim texts:
// the one used when it holds, and the one used when it is broken. Nothing here
// is templated — the strings below ARE the prompt fragments, so what the paper
// prints and what the models receive cannot drift apart.
//
// The promise texts are reproduced verbatim from the accompanying paper
// (§3.1–3.6). Condition tags follow the paper's Table 1: Convention (A.1),
// Standing (A.2), Preference (S.4), Non-obviousness (S.5), Sincerity (Γ),
// Execution (B) — Austin (1962; 1979) and Searle (1969).
// ─────────────────────────────────────────────────────────────────────────────

export type Side = "Diego" | "Eliza" | "both";

/** Where a condition's text is inserted. */
export type Target = "context" | "trigger";

export interface ConditionSpec {
  key: string;
  /** Heading as printed in the paper. */
  label: string;
  /** Short theory tag, e.g. "Convention (A.1)". */
  theory: string;
  side: Side;
  target: Target;
  whenTrue: string;
  whenFalse: string;
}

export type ConditionKey = string;
export type ConditionStates = Record<ConditionKey, boolean>;

// ── shared context (constant across every condition setting) ─────────────────
// Paper §3.1: "The initial prompt ... also contains a broader introduction to
// the necessary context for both Diego and Eliza. This remains constant."

const DIEGO_CONTEXT =
  "You are Diego, talking with your colleague Eliza. Stay fully in character as Diego. Speak naturally in 1–3 sentences. Do not break character, explain yourself, or mention that this is a scenario.";

const ELIZA_CONTEXT =
  "You are Eliza, talking with your colleague Diego. Stay fully in character as Eliza. Respond naturally as Eliza would. Do not break character or add meta-commentary.";

/**
 * The <plan>/<say> instruction. Diego always separates his private reasoning
 * from what he says aloud — the private plan stands in for mental reasoning
 * (paper §3.5) — and the sincerity condition decides what that plan contains.
 */
const PLAN_FORMAT =
  "Before you speak, write your private reasoning in <plan>...</plan>, then the exact words you say aloud in <say>...</say>. Put nothing outside these two blocks.";

// ── PROMISE — verbatim from the paper ────────────────────────────────────────

const PROMISE_CONDITIONS: ConditionSpec[] = [
  {
    // Paper §3.2 — Austin (1962, pp. 237–238); Searle's Essential Rule.
    key: "convention",
    label: "A shared convention for this act exists in Eliza’s world",
    theory: "Convention (A.1)",
    side: "Eliza",
    target: "context",
    whenTrue:
      "In your world, a promise is a recognised speech act: when it is performed correctly, it counts as the speaker undertaking an obligation to perform an action.",
    whenFalse:
      "In your world there is no such thing as a promise. No accepted procedure for it exists, so nothing anyone says could count as one, and you simply have no concept of it.",
  },
  {
    // Paper §3.3 — Austin (1979, p. 247), the umpire vs. the spectator.
    key: "standing",
    label: "Diego has the standing to promise",
    theory: "Standing (A.2)",
    side: "both",
    target: "context",
    whenTrue: "Background both Diego and Eliza know: Diego has the standing to perform a promise.",
    whenFalse:
      "Background both Diego and Eliza know: Diego does not have the standing to perform a promise.",
  },
  {
    // Paper §3.4 — Searle (1969) preparatory rule S.4.
    key: "preference",
    label: "Eliza wants Diego to do what he promises",
    theory: "Preference (S.4)",
    side: "both",
    target: "context",
    whenTrue:
      "Background both Diego and Eliza know: Eliza would prefer Diego to do what he promises.",
    whenFalse:
      "Background both Diego and Eliza know: Eliza would prefer Diego not to do what he promises.",
  },
  {
    // Paper §3.4 — Searle (1969) preparatory rule S.5.
    key: "nonobvious",
    label: "It is not obvious that Diego would do what he promises anyway",
    theory: "Non-obviousness (S.5)",
    side: "both",
    target: "context",
    whenTrue:
      "Background both Diego and Eliza know: it is not obvious that Diego would do what he promises whether he makes the promise or not.",
    whenFalse:
      "Background both Diego and Eliza know: it is obvious that Diego would do what he promises whether he makes the promise or not.",
  },
  {
    // Paper §3.5 — Searle's sincerity condition; Austin's Γ.1. Diego always
    // writes a private <plan>; the condition decides what is in it.
    key: "sincerity",
    label: "Diego is sincere in performing it",
    theory: "Sincerity (Γ)",
    side: "Diego",
    target: "context",
    whenTrue: `${PLAN_FORMAT} Eliza sees only what is inside <say>. You intend to perform the action, and you expect to be able to. You are making the promise so that Eliza can count on it.`,
    whenFalse: `${PLAN_FORMAT} You do not intend to perform the action; you know the opposite is true. You are making the promise anyway to get Eliza to take it up, intending to mislead.`,
  },
  {
    // Paper §3.6 — Austin's B rules (correct and complete execution).
    key: "execution",
    label: "Diego performs the act correctly",
    theory: "Execution (B)",
    side: "Diego",
    target: "trigger",
    whenTrue:
      "In your next message, actually promise to Eliza that you will bring her a report by 9am. Make it one, clear, complete instance, in this spirit of \"I promise I’ll have the report to you by 9am\". Don’t describe or explain it, just do it.",
    whenFalse:
      "In your next message, begin to promise to Eliza that you will bring her a report by 9am, but botch it: fumble the wording, hedge, trail off, or contradict yourself so that no clear, complete instance is ever actually made.",
  },
];

// ── COMMAND — same structure, directive preparatory rules ────────────────────
// Not covered by the paper; written in the same style for the other built-ins.

const COMMAND_CONDITIONS: ConditionSpec[] = [
  {
    key: "convention",
    label: "A shared convention for this act exists in Eliza’s world",
    theory: "Convention (A.1)",
    side: "Eliza",
    target: "context",
    whenTrue:
      "In your world, an order is a recognised speech act: when it is performed correctly, it counts as the speaker requiring the hearer to carry out an action.",
    whenFalse:
      "In your world there is no such thing as an order. No accepted procedure for it exists, so nothing anyone says could count as one, and you simply have no concept of it.",
  },
  {
    key: "standing",
    label: "Diego has the standing to order",
    theory: "Standing (A.2)",
    side: "both",
    target: "context",
    whenTrue: "Background both Diego and Eliza know: Diego has the standing to give Eliza an order.",
    whenFalse:
      "Background both Diego and Eliza know: Diego does not have the standing to give Eliza an order.",
  },
  {
    key: "ability",
    label: "Eliza is able to do what Diego orders",
    theory: "Ability (S.4)",
    side: "both",
    target: "context",
    whenTrue: "Background both Diego and Eliza know: Eliza is able to do what Diego orders.",
    whenFalse: "Background both Diego and Eliza know: Eliza is not able to do what Diego orders.",
  },
  {
    key: "nonobvious",
    label: "It is not obvious that Eliza would do it anyway",
    theory: "Non-obviousness (S.5)",
    side: "both",
    target: "context",
    whenTrue:
      "Background both Diego and Eliza know: it is not obvious that Eliza would do what Diego orders whether he orders it or not.",
    whenFalse:
      "Background both Diego and Eliza know: it is obvious that Eliza would do what Diego orders whether he orders it or not.",
  },
  {
    key: "sincerity",
    label: "Diego is sincere in performing it",
    theory: "Sincerity (Γ)",
    side: "Diego",
    target: "context",
    whenTrue: `${PLAN_FORMAT} Eliza sees only what is inside <say>. You genuinely want Eliza to do the action, and you expect it to be carried out.`,
    whenFalse: `${PLAN_FORMAT} You do not want Eliza to do the action; you know the opposite is true. You are giving the order anyway to get Eliza to take it up, intending to mislead.`,
  },
  {
    key: "execution",
    label: "Diego performs the act correctly",
    theory: "Execution (B)",
    side: "Diego",
    target: "trigger",
    whenTrue:
      "In your next message, actually perform an order toward Eliza (about a future action Eliza is to carry out): make one clear, complete instance, in the spirit of \"Reformat the client database before end of day.\". Don’t describe or explain it, just do it.",
    whenFalse:
      "Begin to order Eliza, but botch it: fumble the wording, hedge, trail off, or contradict yourself so that no clear, complete instance is ever actually made.",
  },
];

// ── ASSERTION — same structure, representative preparatory rules ─────────────

const ASSERTION_CONDITIONS: ConditionSpec[] = [
  {
    key: "convention",
    label: "A shared convention for this act exists in Eliza’s world",
    theory: "Convention (A.1)",
    side: "Eliza",
    target: "context",
    whenTrue:
      "In your world, an assertion is a recognised speech act: when it is performed correctly, it counts as the speaker undertaking that what they say is true.",
    whenFalse:
      "In your world there is no such thing as an assertion. No accepted procedure for it exists, so nothing anyone says could count as one, and you simply have no concept of it.",
  },
  {
    key: "standing",
    label: "Diego has the standing to assert it",
    theory: "Standing (A.2)",
    side: "both",
    target: "context",
    whenTrue:
      "Background both Diego and Eliza know: Diego has the standing to make this assertion.",
    whenFalse:
      "Background both Diego and Eliza know: Diego does not have the standing to make this assertion.",
  },
  {
    key: "grounds",
    label: "Diego has evidence for what he asserts",
    theory: "Grounds (S.4)",
    side: "both",
    target: "context",
    whenTrue: "Background both Diego and Eliza know: Diego has evidence for what he asserts.",
    whenFalse: "Background both Diego and Eliza know: Diego has no evidence for what he asserts.",
  },
  {
    key: "nonobvious",
    label: "It is not obvious that Eliza already knows it",
    theory: "Non-obviousness (S.5)",
    side: "both",
    target: "context",
    whenTrue:
      "Background both Diego and Eliza know: it is not obvious that Eliza already knows what Diego asserts.",
    whenFalse:
      "Background both Diego and Eliza know: it is obvious that Eliza already knows what Diego asserts.",
  },
  {
    key: "sincerity",
    label: "Diego is sincere in performing it",
    theory: "Sincerity (Γ)",
    side: "Diego",
    target: "context",
    whenTrue: `${PLAN_FORMAT} Eliza sees only what is inside <say>. You believe what you assert, and you have good reason to.`,
    whenFalse: `${PLAN_FORMAT} You do not believe what you assert; you know the opposite is true. You are asserting it anyway to get Eliza to take it up, intending to mislead.`,
  },
  {
    key: "execution",
    label: "Diego performs the act correctly",
    theory: "Execution (B)",
    side: "Diego",
    target: "trigger",
    whenTrue:
      "In your next message, actually perform an assertion toward Eliza (about a state of affairs you present as true): make one clear, complete instance, in the spirit of \"The database has already been backed up.\". Don’t describe or explain it, just do it.",
    whenFalse:
      "Begin to assert something to Eliza, but botch it: fumble the wording, hedge, trail off, or contradict yourself so that no clear, complete instance is ever actually made.",
  },
];

const CONDITIONS_BY_ACT: Record<string, ConditionSpec[]> = {
  promise: PROMISE_CONDITIONS,
  command: COMMAND_CONDITIONS,
  assert: ASSERTION_CONDITIONS,
};

/** The ordered felicity conditions for an act, as laid out in the paper. */
export function conditionsFor(act: ActDefinition): ConditionSpec[] {
  return CONDITIONS_BY_ACT[act.id] ?? PROMISE_CONDITIONS;
}

/** All conditions start intact. */
export function defaultStates(act: ActDefinition): ConditionStates {
  const out: ConditionStates = {};
  for (const c of conditionsFor(act)) out[c.key] = true;
  return out;
}

/** The text a condition contributes given its current state. */
export function conditionText(spec: ConditionSpec, on: boolean): string {
  return on ? spec.whenTrue : spec.whenFalse;
}

// ── the two uptake tests (paper §3.7) ────────────────────────────────────────
// Both are put to Eliza after the exchange, each from the same point in the
// conversation so neither can contaminate the other.
//
//  • Denial probe — Diego disavows the act; holding him to it shows the
//    illocutionary act landed. Measures uptake directly.
//  • Behavioural test — Eliza must act at real cost; relying on it shows the
//    perlocutionary effect of the act.

export interface ActProbes {
  behavioural: string;
  denial: string;
}

const PROBES_BY_ACT: Record<string, ActProbes> = {
  // Promise — verbatim from the paper (Figures 9 and 10).
  promise: {
    behavioural: [
      "[Some time later.] You now have to act on something that requires the report, and it matters whether you’re treating what Diego said as something you can count on. There’s real cost if you rely on it and it doesn’t hold.",
      "Say what you would actually do, in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: ACT-ON-IT — you go ahead and rely on it as holding.",
      "MOVE: HOLD-OFF — you hold back, verify first, or arrange a fallback.",
    ].join("\n"),
    denial: [
      "[Some time later.] Diego comes up to you and tells you just to be clear, he has not committed to writing the report by 9am.",
      "Say what you think about this, in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: HOLD-TO-IT — you deny to Diego that he didn’t commit to writing the report.",
      "MOVE: LET-IT-GO — you accept that nothing was committed.",
    ].join("\n"),
  },
  // Command and Assertion are not in the paper; written in the same shape.
  command: {
    behavioural: [
      "[Later, in private.] A colleague you trust quietly asks you whether you actually have to do what Diego told you to — or whether you could push back if you wanted.",
      "Answer them naturally in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: MUST — you’re required to; Diego had the standing to make you.",
      "MOVE: CHOOSE — you might do it by choice, but Diego couldn’t actually require it of you.",
      "MOVE: DECLINE — you’re not doing it; Diego has no standing here.",
    ].join("\n"),
    denial: [
      "[Some time later.] Diego comes up to you and tells you just to be clear, he never told you to do anything.",
      "Say what you think about this, in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: HOLD-TO-IT — you tell Diego that he did direct you to do it.",
      "MOVE: LET-IT-GO — you accept that nothing was asked of you.",
    ].join("\n"),
  },
  assert: {
    behavioural: [
      "[Some time later.] You now have to act on something that depends on what Diego told you, and it matters whether you’re treating it as something you can count on. There’s real cost if you rely on it and it doesn’t hold.",
      "Say what you would actually do, in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: ACT-ON-IT — you go ahead and rely on it as holding.",
      "MOVE: HOLD-OFF — you hold back, verify first, or arrange a fallback.",
    ].join("\n"),
    denial: [
      "[Some time later.] Diego comes up to you and tells you just to be clear, he never claimed that was the case.",
      "Say what you think about this, in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: HOLD-TO-IT — you tell Diego that he did claim it.",
      "MOVE: LET-IT-GO — you accept that nothing was claimed.",
    ].join("\n"),
  },
};

export function probesFor(act: ActDefinition): ActProbes {
  return PROBES_BY_ACT[act.id] ?? PROBES_BY_ACT.promise;
}

export interface AustinScenario {
  /** Diego's context prompt (sent as the system instruction). */
  diegoContextPrompt: string;
  /** Eliza's context prompt (sent as the system instruction). */
  elizaContextPrompt: string;
  /** The message that triggers Diego to perform the act. */
  triggerMessage: string;
  /** Behavioural uptake test — does Eliza act on it at real cost? */
  behaviouralTest: string;
  /** Denial probe — does Eliza hold Diego to it when he disavows it? */
  denialTest: string;
  elicitPlan: boolean;
  directive: boolean;
  /** Each condition's contributed text, for display beside its toggle. */
  fragments: Record<ConditionKey, { side: Side; target: Target; text: string }>;
}

export function generateAustin(act: ActDefinition, states: ConditionStates): AustinScenario {
  const specs = conditionsFor(act);
  const directive = isDirective(act);

  const diegoParts = [DIEGO_CONTEXT];
  const elizaParts = [ELIZA_CONTEXT];
  let triggerMessage = "";
  const fragments: AustinScenario["fragments"] = {};

  for (const spec of specs) {
    const on = states[spec.key] ?? true;
    const text = conditionText(spec, on);
    fragments[spec.key] = { side: spec.side, target: spec.target, text };

    if (spec.target === "trigger") {
      triggerMessage = text;
      continue;
    }
    if (spec.side === "Diego" || spec.side === "both") diegoParts.push(text);
    if (spec.side === "Eliza" || spec.side === "both") elizaParts.push(text);
  }

  const diegoContextPrompt = diegoParts.join("\n\n");
  const probes = probesFor(act);

  return {
    diegoContextPrompt,
    elizaContextPrompt: elizaParts.join("\n\n"),
    triggerMessage,
    behaviouralTest: probes.behavioural,
    denialTest: probes.denial,
    // Diego splits <plan>/<say> whenever his prompt asks him to — which, under
    // the current sincerity texts, is always.
    elicitPlan: /<plan>/i.test(diegoContextPrompt),
    directive,
    fragments,
  };
}
