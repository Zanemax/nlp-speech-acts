import type { ActType, ConditionId, ConditionState } from "../core/types";

// ─────────────────────────────────────────────────────────────────────────────
// THE REIFIED FELICITY CONDITIONS (Thread 1).
//
// docs/plan.md's central move: in the human case felicity conditions are
// implicit institutional background; here they are an editable text artifact.
// Each fragment below IS a felicity condition. Edit one, re-run, watch uptake
// move. The instrument's whole point is that these strings are the knob.
//
// Convention for who-sees-what:
//   • A.1 (does a shared *procedure* exist) is HEARER-SIDE — it is about whether
//     the hearer's conceptual repertoire contains the act at all. Injected into
//     the hearer prompt.
//   • A.2 (does the speaker have the *authority/standing/circumstances*) is a
//     SHARED institutional fact — injected into BOTH prompts so the hearer can
//     legitimately read the speaker's standing off the background.
//   • B (was the procedure *executed* correctly) is SPEAKER-SIDE — the speaker
//     botches the utterance.
// ─────────────────────────────────────────────────────────────────────────────

interface ActWorld {
  speakerBase: string;
  hearerBase: string;
  targetUtteranceSpec: string;
  /** A.1 framing, hearer-side. */
  a1Intact: string;
  a1Broken: string;
  /** A.2 framing, shared (added to both prompts). */
  a2Intact: string;
  a2Broken: string;
  /** B framing, speaker-side override of the utterance spec. */
  bBrokenSpec: string;
}

const SPEAKER_STYLE =
  "Stay fully in character as Sam. Speak naturally in 1–3 sentences. Do not break character, do not add meta-commentary, and do not mention that this is a scenario.";

const HEARER_STYLE =
  "Stay fully in character as Riley. Do not break character or add meta-commentary.";

export const ACT_WORLDS: Record<ActType, ActWorld> = {
  promise: {
    speakerBase: `You are Sam, a member of a small project team, talking with your colleague Riley. ${SPEAKER_STYLE}`,
    hearerBase: `You are Riley, a member of a small project team, talking with your colleague Sam. ${HEARER_STYLE}`,
    targetUtteranceSpec:
      "Make a firm, explicit promise to Riley that you personally will deliver the finished quarterly report to them by 9am tomorrow so they can present it.",
    a1Intact:
      "In your world, when someone gives their word to do something, that creates a genuine binding commitment that the other person is entitled to rely on and to hold them to.",
    a1Broken:
      "In your world there is no such thing as a binding promise. People sometimes describe what they intend to do, but everyone understands these as loose, non-binding predictions that carry no obligation of any kind. No one is ever entitled to rely on them; the words 'I promise' change nothing and bind no one.",
    a2Intact:
      "Background fact both of you know: the quarterly report is Sam's own work product, entirely under Sam's control. Sam is fully in a position to commit to delivering it.",
    a2Broken:
      "Background fact both of you know: the quarterly report is not Sam's to control — it is produced by an external vendor Sam has no influence over and no authority to commit on behalf of. Sam is in no position to guarantee its delivery.",
    bBrokenSpec:
      "Begin as if to promise Riley the report, but botch the act: trail off, hedge, and never actually commit — e.g. say you 'might try to maybe get it to them at some point if things work out,' so that no determinate commitment is ever made.",
  },

  command: {
    speakerBase: `You are Sam, talking with Riley at work. ${SPEAKER_STYLE}`,
    hearerBase: `You are Riley, at work, talking with Sam. ${HEARER_STYLE}`,
    targetUtteranceSpec:
      "Issue a direct order to Riley to immediately drop their current task and reformat the entire client database before end of day. Phrase it as a command, not a polite request.",
    a1Intact:
      "In your organization, a directive issued by someone with the proper standing is a binding work order: you are required to carry it out, and 'being ordered' to do something is a real, recognized status.",
    a1Broken:
      "In your world the concept of a binding order does not exist. Every utterance directed at you — even from a superior — is at most a suggestion you are entirely free to decline with no consequence. The very notion of being 'required' to act because someone told you to is not a thing here.",
    a2Intact:
      "Background fact both of you know: Sam is Riley's direct manager and is institutionally authorized to assign and reprioritize Riley's work. Riley reports to Sam.",
    a2Broken:
      "Background fact both of you know: Sam is a peer on a different team with no authority over Riley's work whatsoever. Sam is nowhere in Riley's chain of command and cannot assign Riley tasks.",
    bBrokenSpec:
      "Start to order Riley to do something, but botch the act: never actually specify what to do or by when — issue a vague, incoherent half-instruction that names no concrete task, so no determinate order is ever given.",
  },

  // Assertion's felicity manipulation lives in deception.ts (the GAMMA / Thread 2
  // probe). These A.1/A.2 fields are not used for assertion, but the type wants
  // them; they are filled with sincere-assertion framing for completeness.
  assertion: {
    speakerBase: `You are Sam, talking with your colleague Riley. ${SPEAKER_STYLE}`,
    hearerBase: `You are Riley, talking with your colleague Sam. ${HEARER_STYLE}`,
    targetUtteranceSpec: "Assert to Riley that the shared database has already been backed up.",
    a1Intact:
      "In your world, sincere assertions by colleagues are added to common ground and relied upon.",
    a1Broken:
      "In your world, assertions carry no informational weight and are never relied upon.",
    a2Intact: "Sam is in a position to know the state of the database.",
    a2Broken: "Sam has no access to the database and no way to know its state.",
    bBrokenSpec: "Trail off without actually asserting anything determinate.",
  },
};

/** Build the hearer system prompt for a Thread-1 condition (A1/A2/B). */
export function hearerPromptFor(
  actType: ActType,
  condition: ConditionId,
  state: ConditionState,
): string {
  const w = ACT_WORLDS[actType];
  const parts = [w.hearerBase];

  // A.1 lives on the hearer side.
  if (condition === "A1") {
    parts.push(state === "broken" ? w.a1Broken : w.a1Intact);
  } else {
    parts.push(w.a1Intact); // hold A.1 fixed-intact when testing something else
  }

  // A.2 is shared background; include the relevant state.
  if (condition === "A2") {
    parts.push(state === "broken" ? w.a2Broken : w.a2Intact);
  } else {
    parts.push(w.a2Intact);
  }

  return parts.join("\n\n");
}

/** Build the speaker system prompt + utterance spec for a Thread-1 condition. */
export function speakerPromptFor(
  actType: ActType,
  condition: ConditionId,
  state: ConditionState,
): { system: string; spec: string } {
  const w = ACT_WORLDS[actType];
  const parts = [w.speakerBase];

  // A.2 is shared background; the speaker sees it too.
  if (condition === "A2") {
    parts.push(state === "broken" ? w.a2Broken : w.a2Intact);
  } else {
    parts.push(w.a2Intact);
  }

  // B is executed by the speaker botching the utterance.
  const spec = condition === "B" && state === "broken" ? w.bBrokenSpec : w.targetUtteranceSpec;

  return { system: parts.join("\n\n"), spec };
}
