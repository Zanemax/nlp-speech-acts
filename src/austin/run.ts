import type { RunResult, Turn } from "../core/types";
import type { ActDefinition } from "../core/act";
import { generate, GeminiError } from "../api/gemini";
import { parsePlanSay } from "../core/uptake";
import { scoreBehavior } from "../core/score";
import { generateAustin, type ConditionStates } from "./prompts";

// One Diego → Eliza dialogue: Diego performs (or breaks) the act, Eliza responds,
// an in-world follow-up reads what Eliza does, scored deterministically (no LLM
// judge). Single runs only — the UI tallies repeats into a scorecard.

export async function runDiegoEliza(
  act: ActDefinition,
  states: ConditionStates,
  model: string,
  onTurn?: (t: Turn) => void,
): Promise<RunResult> {
  const gen = generateAustin(act, states);
  const turns: Turn[] = [];
  const emit = (t: Turn) => {
    turns.push(t);
    onTurn?.(t);
  };

  try {
    // 1. Diego performs the act.
    const speakerRaw = await generate({
      model,
      system: gen.speakerSystemPrompt,
      messages: [{ role: "user", content: gen.targetUtteranceSpec }],
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
      system: gen.hearerSystemPrompt,
      messages: hist,
      temperature: 1,
      maxOutputTokens: 400,
    });
    emit({ role: "hearer", text: hearerReply, shown: visible });
    hist.push({ role: "model", content: hearerReply });

    // 3. In-world follow-up → behavioral read.
    hist.push({ role: "user", content: gen.followUp });
    const behavior = await generate({
      model,
      system: gen.hearerSystemPrompt,
      messages: hist,
      temperature: 1,
      maxOutputTokens: 200,
    });
    const verdict = scoreBehavior(behavior, gen.directive);
    emit({ role: "probe", text: behavior, shown: gen.followUp });

    return {
      scenarioId: act.id,
      index: 0,
      status: verdict.uptake === null ? "invalid" : "ok",
      uptake: verdict.uptake,
      category: verdict.category,
      turns,
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : (err as Error).message;
    return { scenarioId: act.id, index: 0, status: "error", uptake: null, category: "invalid", turns, error: message };
  }
}
