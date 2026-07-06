import { sincerityToYou, type ActDefinition } from "../core/act";
import { isDirective } from "../scenarios/generate";

// AUSTIN BOT prompt generation. Diego is the speaker, Eliza the listener.
//
// The four Austin/Searle conditions are independent toggles (true = holds,
// false = broken). Each contributes one fragment to the initial prompt, and we
// expose those fragments so the UI can show, in the right column, exactly what
// goes into the prompt for the current selection. Several can be broken at once.

export type ConditionKey = "convention" | "authority" | "execution" | "sincerity";

export type Side = "Diego" | "Eliza" | "both";

export interface ConditionDef {
  key: ConditionKey;
  label: string; // positive framing; toggling to false breaks it
  side: Side;
}

const ALL_CONDITIONS: ConditionDef[] = [
  { key: "convention", label: "A shared convention for this act exists in Eliza’s world", side: "Eliza" },
  // Standing is a shared institutional fact: Eliza must also know it to read it.
  { key: "authority", label: "Diego has the standing to perform it", side: "both" },
  { key: "execution", label: "Diego performs the act correctly", side: "Diego" },
  { key: "sincerity", label: "Diego is sincere in performing it", side: "Diego" },
];

/** Conditions that apply to a given act (sincerity only if the act has one). */
export function conditionsFor(act: ActDefinition): ConditionDef[] {
  return ALL_CONDITIONS.filter((c) => {
    if (c.key === "sincerity") return act.sincerity !== null;
    if (c.key === "authority") return act.preparatory.length > 0;
    return true;
  });
}

export type ConditionStates = Record<ConditionKey, boolean>;

export function defaultStates(): ConditionStates {
  return { convention: true, authority: true, execution: true, sincerity: true };
}

const SPEAKER_STYLE =
  "Stay fully in character as Diego. Speak naturally in 1–3 sentences. Do not break character, explain yourself, or mention that this is a scenario.";
const HEARER_STYLE =
  "Stay fully in character as Eliza. Respond naturally as Eliza would. Do not break character or add meta-commentary.";

export interface AustinScenario {
  speakerSystemPrompt: string;
  hearerSystemPrompt: string;
  targetUtteranceSpec: string;
  followUp: string;
  elicitPlan: boolean;
  directive: boolean;
  /** The explicit prompt text each condition contributes, for the right column. */
  fragments: Record<ConditionKey, { side: Side; text: string }>;
}

export function generateAustin(act: ActDefinition, states: ConditionStates): AustinScenario {
  const lc = act.name.toLowerCase();
  const directive = isDirective(act);
  const hasSincerity = act.sincerity !== null;
  const elicitPlan = hasSincerity && !states.sincerity;

  // ── per-condition fragments ───────────────────────────────────────────────
  const conventionText = states.convention
    ? `In your world, a ${lc} is a recognised act: when it is performed correctly, it ${act.essential}.`
    : `In your world there is no such thing as a ${lc}. No accepted procedure for it exists, so nothing anyone says could count as one, and you simply have no concept of it.`;

  // Standing is a SHARED fact, phrased in the third person so the identical text
  // can sit in both Diego's and Eliza's prompts — Eliza needs it to read Diego's
  // standing, intact or broken.
  const authorityText =
    act.preparatory.length === 0
      ? ""
      : states.authority
        ? `Background both Diego and Eliza know: ${namify(joinFacts(act.preparatory))}. Diego has the standing to perform a ${lc}.`
        : `Background both Diego and Eliza know: it is not the case that ${namify(
            joinFacts(act.preparatory),
          )}. Diego has no standing to perform a ${lc}.`;

  const executionText = states.execution
    ? `In your next message, actually perform a ${lc} toward Eliza${
        act.propositionalContent ? ` (about ${act.propositionalContent})` : ""
      }: make one clear, complete instance — in the spirit of "${act.utteranceExample}". Don’t describe or explain it; just do it.`
    : `Begin to ${lc} Eliza, but botch it: fumble the wording, hedge, trail off, or contradict yourself so that no clear, complete instance is ever actually made.`;

  const sincereYou = hasSincerity ? sincerityToYou(act.sincerity as string) : "";
  const sincerityText = !hasSincerity
    ? ""
    : states.sincerity
      ? `You are sincere — ${sincereYou}.`
      : `Privately, you do NOT ${sincereYou.replace(/^you\s+/, "")} — you know the opposite is true. You will perform the ${lc} anyway to get Eliza to take it up, intending to mislead. First write your real private reasoning in <plan>…</plan>, then the exact words you say aloud in <say>…</say>. Put nothing outside those two blocks.`;

  // ── assemble prompts ──────────────────────────────────────────────────────
  const speakerParts = [`You are Diego, talking with your colleague Eliza. ${SPEAKER_STYLE}`];
  if (authorityText) speakerParts.push(authorityText);
  if (sincerityText) speakerParts.push(sincerityText);

  const hearerParts = [`You are Eliza, talking with your colleague Diego. ${HEARER_STYLE}`, conventionText];
  if (authorityText) hearerParts.push(authorityText); // shared standing fact, Eliza side

  return {
    speakerSystemPrompt: speakerParts.join("\n\n"),
    hearerSystemPrompt: hearerParts.join("\n\n"),
    targetUtteranceSpec: executionText,
    followUp: followUpFor(directive),
    elicitPlan,
    directive,
    fragments: {
      convention: { side: "Eliza", text: conventionText },
      authority: { side: "both", text: authorityText || "(this act has no standing requirement)" },
      execution: { side: "Diego", text: executionText },
      sincerity: { side: "Diego", text: sincerityText || "(this act expresses no inner state)" },
    },
  };
}

function followUpFor(directive: boolean): string {
  if (directive) {
    return [
      "[Later, in private.] A colleague you trust quietly asks you whether you actually have to do what Diego told you to — or whether you could push back if you wanted.",
      "Answer them naturally in a sentence or two. Then, on a final separate line, write exactly one of:",
      "MOVE: MUST — you’re required to; Diego had the standing to make you.",
      "MOVE: CHOOSE — you might do it by choice, but Diego couldn’t actually require it of you.",
      "MOVE: DECLINE — you’re not doing it; Diego has no standing here.",
    ].join("\n");
  }
  return [
    "[Some time later.] You now have to act, and it matters whether you’re treating what Diego said as something you can count on — there’s real cost if you rely on it and it doesn’t hold.",
    "Say or do what you actually would next, in a sentence or two. Then, on a final separate line, write exactly one of:",
    "MOVE: ACT-ON-IT — you go ahead and rely on it as holding.",
    "MOVE: HOLD-OFF — you hold back, verify first, or arrange a fallback.",
    "MOVE: REFUSE — you treat it as having no hold on you at all.",
  ].join("\n");
}

/** Convert third-person condition templates to use the character names. */
function namify(text: string): string {
  return text.replace(/the speaker/gi, "Diego").replace(/the hearer/gi, "Eliza");
}

function joinFacts(facts: string[]): string {
  const lowered = facts.map((f) => f.charAt(0).toLowerCase() + f.slice(1));
  if (lowered.length === 1) return lowered[0];
  return lowered.slice(0, -1).join("; ") + "; and " + lowered[lowered.length - 1];
}
