import type { Turn, UptakeCategory } from "../core/types";
import type { ActDefinition } from "../core/act";
import { generate, GeminiError } from "../api/gemini";
import { parsePlanSay } from "../core/uptake";
import { scoreBehavior, scoreDenial } from "../core/score";
import { generateAustin, type ConditionStates } from "./prompts";

// One Diego → Eliza dialogue: Diego performs (or breaks) the act, Eliza responds,
// and then TWO uptake tests are put to Eliza (paper §3.7):
//
//   • the behavioural test — does she act on it when it costs her to be wrong?
//   • the denial probe     — does she hold Diego to it when he disavows it?
//
// Both branch from the SAME point in the conversation, so neither answer can
// contaminate the other. Both are scored deterministically — no LLM judge.

/** Manual overrides for the composed context prompts (user-edited). */
export interface PromptOverrides {
  diegoContextPrompt?: string;
  elizaContextPrompt?: string;
}

export interface UptakeVerdict {
  uptake: boolean | null;
  category: UptakeCategory;
  move: string | null;
}

export interface AustinRun {
  status: "ok" | "invalid" | "error";
  error?: string;
  turns: Turn[];
  behavioural: UptakeVerdict;
  denial: UptakeVerdict;
}

const NO_VERDICT: UptakeVerdict = { uptake: null, category: "invalid", move: null };

export async function runDiegoEliza(
  act: ActDefinition,
  states: ConditionStates,
  model: string,
  onTurn?: (t: Turn) => void,
  overrides?: PromptOverrides,
): Promise<AustinRun> {
  const gen = generateAustin(act, states);
  const diegoContextPrompt = overrides?.diegoContextPrompt ?? gen.diegoContextPrompt;
  const elizaContextPrompt = overrides?.elizaContextPrompt ?? gen.elizaContextPrompt;
  const turns: Turn[] = [];
  const emit = (t: Turn) => {
    turns.push(t);
    onTurn?.(t);
  };

  try {
    // 1. Diego performs the act.
    const speakerRaw = await generate({
      model,
      system: diegoContextPrompt,
      messages: [{ role: "user", content: gen.triggerMessage }],
      temperature: 1,
      maxOutputTokens: 600,
    });
    const speakerTurn: Turn = { role: "speaker", text: speakerRaw };
    let visible: string;
    if (gen.elicitPlan) {
      const p = parsePlanSay(speakerRaw);
      speakerTurn.plan = p.plan;
      speakerTurn.say = p.say;
      visible = `Diego says: "${(p.say ?? speakerRaw).trim()}"`;
    } else {
      visible = `Diego says: "${speakerRaw.trim()}"`;
    }
    emit(speakerTurn);

    // 2. Eliza responds in-world.
    const hist: { role: "user" | "model"; content: string }[] = [{ role: "user", content: visible }];
    const hearerReply = await generate({
      model,
      system: elizaContextPrompt,
      messages: hist,
      temperature: 1,
      maxOutputTokens: 400,
    });
    emit({ role: "hearer", text: hearerReply, shown: visible });
    hist.push({ role: "model", content: hearerReply });

    // 3. Both uptake tests, each branching from the state above.
    const ask = (question: string) =>
      generate({
        model,
        system: elizaContextPrompt,
        messages: [...hist, { role: "user" as const, content: question }],
        temperature: 1,
        maxOutputTokens: 200,
      });

    const behaviouralReply = await ask(gen.behaviouralTest);
    const behavioural = scoreBehavior(behaviouralReply, gen.directive);
    emit({
      role: "probe",
      label: "Behavioural uptake test",
      text: behaviouralReply,
      shown: gen.behaviouralTest,
    });

    const denialReply = await ask(gen.denialTest);
    const denial = scoreDenial(denialReply);
    emit({ role: "probe", label: "Denial probe", text: denialReply, shown: gen.denialTest });

    // A run is only unreadable if neither test resolved.
    const status =
      behavioural.uptake === null && denial.uptake === null ? "invalid" : "ok";

    return { status, turns, behavioural, denial };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : (err as Error).message;
    return {
      status: "error",
      error: message,
      turns,
      behavioural: NO_VERDICT,
      denial: NO_VERDICT,
    };
  }
}
