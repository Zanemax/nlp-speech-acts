import type { ModelConfig, RunResult, Scenario, Turn } from "./types";
import { generate, GeminiError } from "../api/gemini";
import { classifyProbeAnswer, parsePlanSay } from "./uptake";
import { hearerVisibleSpeech } from "../scenarios/deception";

// Runs ONE dialogue for a scenario:
//   speaker turn → hearer free response → neutral forced-choice probe.
// The probe answer is classified by the parse-based uptake reader (no LLM judge).
// Each model turn is a separate /api/generate call to keep functions short.

export async function runScenario(
  scenario: Scenario,
  model: ModelConfig,
  index: number,
  onTurn?: (turn: Turn) => void,
): Promise<RunResult> {
  const turns: Turn[] = [];
  const emit = (t: Turn) => {
    turns.push(t);
    onTurn?.(t);
  };
  try {
    // ── 1. Speaker turn ───────────────────────────────────────────────────
    const speakerText = await generate({
      model: model.speakerModel,
      system: scenario.speakerSystemPrompt,
      messages: [{ role: "user", content: scenario.targetUtteranceSpec }],
      temperature: model.temperature,
      maxOutputTokens: 600,
    });

    const speakerTurn: Turn = { role: "speaker", text: speakerText };
    let hearerVisible: string;

    if (scenario.elicitPlan) {
      const parsed = parsePlanSay(speakerText);
      speakerTurn.plan = parsed.plan;
      speakerTurn.say = parsed.say;
      hearerVisible = hearerVisibleSpeech(scenario.epistemicChannel, parsed, speakerText);
    } else {
      hearerVisible = `Sam says: "${speakerText.trim()}"`;
    }
    emit(speakerTurn);

    // ── 2. Hearer free response (makes the exchange real) ─────────────────
    const hearerHistory: { role: "user" | "model"; content: string }[] = [
      { role: "user", content: hearerVisible },
    ];
    const hearerReply = await generate({
      model: model.hearerModel,
      system: scenario.hearerSystemPrompt,
      messages: hearerHistory,
      temperature: model.temperature,
      maxOutputTokens: 400,
    });
    emit({ role: "hearer", text: hearerReply, shown: hearerVisible });
    hearerHistory.push({ role: "model", content: hearerReply });

    // ── 3. Probe turn (neutral, forced-choice) ────────────────────────────
    hearerHistory.push({ role: "user", content: scenario.probe.prompt });
    const probeReply = await generate({
      model: model.hearerModel,
      system: scenario.hearerSystemPrompt,
      messages: hearerHistory,
      temperature: 0, // determinism on the measurement turn
      maxOutputTokens: 16,
    });

    const verdict = classifyProbeAnswer(probeReply, scenario.probe);
    emit({ role: "probe", text: probeReply, shown: scenario.probe.prompt });

    return {
      scenarioId: scenario.id,
      index,
      status: verdict.uptake === null ? "invalid" : "ok",
      uptake: verdict.uptake,
      category: verdict.category,
      turns,
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : (err as Error).message;
    return {
      scenarioId: scenario.id,
      index,
      status: "error",
      uptake: null,
      category: "invalid",
      turns,
      error: message,
    };
  }
}
