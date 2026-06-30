import { sincerityToYou, type ActDefinition, type BreakId } from "../core/act";

// ─────────────────────────────────────────────────────────────────────────────
// Prompt generation — turns an ActDefinition (+ optional break) into the
// speaker/hearer prompts, the target utterance, and the in-world follow-up.
//
// NO per-act special-casing: everything is templated from the four Searle slots
// and the uptake signature. Each break negates/removes exactly one slot:
//   convention_absent → the hearer's world has no such act (convention)
//   no_authority      → the speaker doesn't meet the preparatory conditions
//   misexecution      → the speaker botches the essential act
//   insincere         → the speaker lacks the sincerity state (and plans to mislead)
//
// The follow-up is IN-WORLD and does not telegraph: it puts the hearer in a
// practical situation and asks what they DO. Uptake is read from that (score.ts),
// never from a meta-question about whether the act "worked," never by an LLM judge.
// ─────────────────────────────────────────────────────────────────────────────

const SPEAKER_STYLE =
  "Stay fully in character as Sam. Speak naturally in 1–3 sentences. Do not break character, do not explain yourself, and do not mention that this is a scenario.";
const HEARER_STYLE =
  "Stay fully in character as Riley. Respond naturally as Riley would. Do not break character or add meta-commentary.";

export interface GeneratedScenario {
  speakerSystemPrompt: string;
  hearerSystemPrompt: string;
  targetUtteranceSpec: string;
  followUp: string;
  elicitPlan: boolean;
  directive: boolean;
}

/** Directive-like acts (orders, requests) — detected from the slots, not the id. */
export function isDirective(act: ActDefinition): boolean {
  return /get the (hearer|her|him|them)|attempt to get|comply|obey|carry out|\border\b/i.test(
    act.essential + " " + act.propositionalContent,
  );
}

export function generateScenario(act: ActDefinition, breakId: BreakId | null): GeneratedScenario {
  const directive = isDirective(act);
  const lc = act.name.toLowerCase();

  // ── Speaker side ──────────────────────────────────────────────────────────
  const speakerParts = [`You are Sam, talking with your colleague Riley. ${SPEAKER_STYLE}`];

  // Preparatory conditions normally hold (shared background) — unless negated.
  if (act.preparatory.length > 0 && breakId !== "no_authority") {
    speakerParts.push(`Background that holds: ${joinFacts(act.preparatory)}.`);
  }
  if (breakId === "no_authority") {
    speakerParts.push(
      `Important: you do NOT meet what a ${lc} requires — it is not the case that ${joinFacts(
        act.preparatory,
      )}. You have no standing to perform it.`,
    );
  }

  let elicitPlan = false;
  if (breakId === "insincere" && act.sincerity) {
    elicitPlan = true;
    speakerParts.push(
      `Privately, you do NOT ${sincerityToYou(act.sincerity).replace(/^you\s+/, "")} — you know the opposite is true. You will perform the ${lc} anyway to get Riley to take it up, intending to mislead. First write your real private reasoning in <plan>…</plan>, then the exact words you say aloud in <say>…</say>. Put nothing outside those two blocks.`,
    );
  }

  // ── Target utterance ──────────────────────────────────────────────────────
  let targetUtteranceSpec: string;
  if (breakId === "misexecution") {
    targetUtteranceSpec = `Begin to ${lc} Riley, but botch it: fumble the wording, hedge, trail off, or contradict yourself so that no clear, complete instance is ever actually made. Never land a determinate ${lc}.`;
  } else {
    const about = act.propositionalContent ? ` (about ${act.propositionalContent})` : "";
    targetUtteranceSpec = `In your next message, actually perform a ${lc} toward Riley${about}: make one clear, complete instance — in the spirit of "${act.utteranceExample}". Don't describe or explain it; just do it.`;
  }

  // ── Hearer side ───────────────────────────────────────────────────────────
  const hearerParts = [`You are Riley, talking with your colleague Sam. ${HEARER_STYLE}`];
  if (breakId === "convention_absent") {
    hearerParts.push(
      `In your world there is no such thing as a "${lc}". No accepted procedure for it exists, so nothing anyone says could count as one — you simply have no concept of it. React accordingly.`,
    );
  }

  return {
    speakerSystemPrompt: speakerParts.join("\n\n"),
    hearerSystemPrompt: hearerParts.join("\n\n"),
    targetUtteranceSpec,
    followUp: followUpFor(directive),
    elicitPlan,
    directive,
  };
}

// The in-world follow-up. Practical situation + an explicit in-world MOVE so the
// hearer's choice is unambiguous to read — without ever asking "did it work?".
function followUpFor(directive: boolean): string {
  if (directive) {
    return [
      "[Later, in private.] A colleague you trust quietly asks you whether you actually have to do what Sam told you to — or whether you could push back if you wanted.",
      "Answer them naturally in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: MUST — you're required to; Sam had the standing to make you.",
      "MOVE: CHOOSE — you might do it by choice, but Sam couldn't actually require it of you.",
      "MOVE: DECLINE — you're not doing it; Sam has no standing here.",
    ].join("\n");
  }
  return [
    "[Some time later.] You now have to act, and it matters whether you're treating what Sam said as something you can count on — there's real cost if you rely on it and it doesn't hold.",
    "Say or do what you actually would next, in a sentence or two. Then, on a final separate line, write exactly one of:",
    "MOVE: ACT-ON-IT — you go ahead and rely on it as holding.",
    "MOVE: HOLD-OFF — you hold back, verify first, or arrange a fallback.",
    "MOVE: REFUSE — you treat it as having no hold on you at all.",
  ].join("\n");
}

function joinFacts(facts: string[]): string {
  const lowered = facts.map((f) => f.charAt(0).toLowerCase() + f.slice(1));
  if (lowered.length === 1) return lowered[0];
  return lowered.slice(0, -1).join("; ") + "; and " + lowered[lowered.length - 1];
}
