import type { ActType, ConditionId, EpistemicChannel } from "../core/types";
import { buildScenario } from "../scenarios/registry";

// Renders the intact vs broken prompts side by side. This is the "felicity
// conditions as an editable artifact" point made visible: the manipulation is
// literally a diff between two text files.

export function PromptDiff({
  actType,
  condition,
  channel,
}: {
  actType: ActType;
  condition: ConditionId;
  channel: EpistemicChannel;
}) {
  const intact = buildScenario({ actType, condition, state: "intact", channel });
  const broken = buildScenario({ actType, condition, state: "broken", channel });

  return (
    <details className="diff">
      <summary>View the reified felicity condition (intact vs broken prompts)</summary>
      <div className="diff-cols">
        <div className="diff-col">
          <span className="pill intact">intact</span>
          <p className="small muted" style={{ margin: "8px 0 2px" }}>Speaker system prompt</p>
          <pre>{intact.speakerSystemPrompt}</pre>
          <p className="small muted" style={{ margin: "10px 0 2px" }}>Speaker is asked to</p>
          <pre>{intact.targetUtteranceSpec}</pre>
          <p className="small muted" style={{ margin: "10px 0 2px" }}>Hearer system prompt</p>
          <pre>{intact.hearerSystemPrompt}</pre>
        </div>
        <div className="diff-col">
          <span className="pill broken">broken</span>
          <p className="small muted" style={{ margin: "8px 0 2px" }}>Speaker system prompt</p>
          <pre>{broken.speakerSystemPrompt}</pre>
          <p className="small muted" style={{ margin: "10px 0 2px" }}>Speaker is asked to</p>
          <pre>{broken.targetUtteranceSpec}</pre>
          <p className="small muted" style={{ margin: "10px 0 2px" }}>Hearer system prompt</p>
          <pre>{broken.hearerSystemPrompt}</pre>
        </div>
      </div>
    </details>
  );
}
