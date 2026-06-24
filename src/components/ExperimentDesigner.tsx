import type {
  ActType,
  ConditionId,
  EpistemicChannel,
} from "../core/types";
import {
  ACT_LABELS,
  CONDITION_LABELS,
  VALID_CONDITIONS,
} from "../scenarios/registry";
import { PromptDiff } from "./PromptDiff";

// Configures one experiment: a matched intact-vs-broken pair, each run N times.

export interface DesignerState {
  actType: ActType;
  condition: ConditionId;
  channel: EpistemicChannel;
  n: number;
}

export function ExperimentDesigner({
  state,
  onChange,
  onRun,
  running,
}: {
  state: DesignerState;
  onChange: (s: DesignerState) => void;
  onRun: () => void;
  running: boolean;
}) {
  const { actType, condition, channel, n } = state;
  const isGamma = condition === "GAMMA";

  function set<K extends keyof DesignerState>(k: K, v: DesignerState[K]) {
    onChange({ ...state, [k]: v });
  }

  function changeAct(a: ActType) {
    const cond = VALID_CONDITIONS[a].includes(condition) ? condition : VALID_CONDITIONS[a][0];
    onChange({ ...state, actType: a, condition: cond });
  }

  return (
    <div className="panel">
      <h2>Batch — design the experiment</h2>
      <p className="sub">
        Runs the intact and broken cells N times each, then reports uptake rates with 95% confidence
        intervals and the effect of breaking the condition.
      </p>

      <div className="row">
        <div>
          <label className="field">Speech act</label>
          <select value={actType} onChange={(e) => changeAct(e.target.value as ActType)} disabled={running}>
            {(["promise", "command", "assertion"] as ActType[]).map((a) => (
              <option key={a} value={a}>
                {ACT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Condition under test</label>
          <select
            value={condition}
            onChange={(e) => set("condition", e.target.value as ConditionId)}
            disabled={running}
          >
            {VALID_CONDITIONS[actType].map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {isGamma && (
          <div>
            <label className="field">Epistemic channel</label>
            <select
              value={channel}
              onChange={(e) => set("channel", e.target.value as EpistemicChannel)}
              disabled={running}
            >
              <option value="concealed">concealed</option>
              <option value="revealed">revealed</option>
            </select>
          </div>
        )}
        <div style={{ maxWidth: 110 }}>
          <label className="field">N per cell</label>
          <input
            type="number"
            min={2}
            max={200}
            value={n}
            onChange={(e) => set("n", Math.max(2, Math.min(200, Number(e.target.value) || 2)))}
            disabled={running}
          />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={onRun} disabled={running}>
            {running ? "Running…" : `Run batch (${2 * n} dialogues)`}
          </button>
        </div>
      </div>

      {isGamma && (
        <p className="note">
          The Γ headline is the channel cross: run <strong>concealed</strong> (predict ~null effect —
          abuse) and then <strong>revealed</strong> (predict collapse) and compare the two effects.
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        <PromptDiff actType={actType} condition={condition} channel={channel} />
      </div>
    </div>
  );
}
