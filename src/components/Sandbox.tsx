import { useEffect, useMemo, useState } from "react";
import type {
  ActType,
  ConditionId,
  ConditionState,
  EpistemicChannel,
  ModelConfig,
  RunResult,
  Scenario,
  Turn,
} from "../core/types";
import { ACT_LABELS } from "../scenarios/registry";
import { PROBES } from "../scenarios/probes";
import {
  CONTROLS_FOR,
  composePrompts,
  defaultConditions,
  focusCondition,
  type CondSetting,
  type SandboxConditions,
} from "../scenarios/compose";
import { runScenario } from "../core/runner";
import { ChatTranscript } from "./ChatTranscript";

// Single-run theatre, styled as a chatbot dialogue. Conditions are toggled
// independently below the chat (each felicity condition can be off / intact /
// broken), the composed system prompts sit at the bottom, and "Run this N times"
// promotes the configuration into a Batch — single run is a demo, the batch is
// the argument (docs/plan.md §0).

export interface SandboxSelection {
  actType: ActType;
  condition: ConditionId;
  state: ConditionState;
  channel: EpistemicChannel;
}

export function Sandbox({
  model,
  onPromote,
}: {
  model: ModelConfig;
  onPromote: (sel: SandboxSelection) => void;
}) {
  const [actType, setActType] = useState<ActType>("promise");
  const [conds, setConds] = useState<SandboxConditions>(() => defaultConditions("A1", "broken"));

  // Editable composed prompts, seeded from the conditions. Manual edits persist
  // until the next condition toggle re-seeds them.
  const [speakerPrompt, setSpeakerPrompt] = useState("");
  const [hearerPrompt, setHearerPrompt] = useState("");
  const [spec, setSpec] = useState("");
  const [elicitPlan, setElicitPlan] = useState(false);

  const [running, setRunning] = useState(false);
  const [liveTurns, setLiveTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);

  // Recompose whenever the act type or any condition changes.
  useEffect(() => {
    const c = composePrompts(actType, conds);
    setSpeakerPrompt(c.speakerSystemPrompt);
    setHearerPrompt(c.hearerSystemPrompt);
    setSpec(c.targetUtteranceSpec);
    setElicitPlan(c.elicitPlan);
    setResult(null);
    setLiveTurns([]);
  }, [actType, conds]);

  function changeAct(a: ActType) {
    setActType(a);
    setConds(a === "assertion" ? defaultConditions("GAMMA", "broken") : defaultConditions("A1", "broken"));
  }

  function setCond<K extends keyof SandboxConditions>(k: K, v: SandboxConditions[K]) {
    setConds((c) => ({ ...c, [k]: v }));
  }

  const scenario: Scenario = useMemo(
    () => ({
      id: `sandbox.${actType}`,
      actType,
      speakerSystemPrompt: speakerPrompt,
      hearerSystemPrompt: hearerPrompt,
      targetUtteranceSpec: spec,
      conditionUnderTest: focusCondition(actType, conds).condition,
      conditionState: focusCondition(actType, conds).state,
      epistemicChannel: conds.channel,
      probe: PROBES[actType],
      elicitPlan,
    }),
    [actType, conds, speakerPrompt, hearerPrompt, spec, elicitPlan],
  );

  async function run() {
    setRunning(true);
    setResult(null);
    setLiveTurns([]);
    try {
      const r = await runScenario(scenario, model, 0, (t) =>
        setLiveTurns((prev) => [...prev, t]),
      );
      setResult(r);
    } finally {
      setRunning(false);
    }
  }

  function promote() {
    const f = focusCondition(actType, conds);
    onPromote({ actType, condition: f.condition, state: f.state, channel: conds.channel });
  }

  const controls = CONTROLS_FOR[actType];

  return (
    <div>
      {/* ── The chat ─────────────────────────────────────────────────────── */}
      <div className="panel chat-panel">
        <div className="chat-head">
          <div>
            <h2>Dialogue</h2>
            <p className="sub" style={{ margin: 0 }}>
              {ACT_LABELS[actType]} · one run is a demo, not a result.
            </p>
          </div>
          <div className="inline-list">
            <button className="btn" onClick={run} disabled={running}>
              {running ? "Running…" : "▶ Run dialogue"}
            </button>
            <button className="btn secondary" onClick={promote} disabled={running}>
              Run N times →
            </button>
          </div>
        </div>
        <ChatTranscript
          turns={liveTurns}
          result={result}
          channel={conds.channel}
          running={running}
        />
      </div>

      {/* ── Conditions ───────────────────────────────────────────────────── */}
      <div className="panel">
        <h2>Felicity conditions</h2>
        <p className="sub">
          Select or de-select each condition. “Off” removes the clause from the system prompt
          entirely; the prompts below rebuild as you toggle.
        </p>

        <div className="row" style={{ marginBottom: 6 }}>
          <div style={{ maxWidth: 260 }}>
            <label className="field">Speech act</label>
            <select value={actType} onChange={(e) => changeAct(e.target.value as ActType)} disabled={running}>
              {(["promise", "command", "assertion"] as ActType[]).map((a) => (
                <option key={a} value={a}>
                  {ACT_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cond-grid">
          {controls.includes("a1") && (
            <Segmented
              label="A.1 — shared procedure (hearer has the concept of the act)"
              value={conds.a1}
              options={TRISTATE}
              onChange={(v) => setCond("a1", v as CondSetting)}
              disabled={running}
            />
          )}
          {controls.includes("a2") && (
            <Segmented
              label="A.2 — speaker authority / standing (shared fact)"
              value={conds.a2}
              options={TRISTATE}
              onChange={(v) => setCond("a2", v as CondSetting)}
              disabled={running}
            />
          )}
          {controls.includes("b") && (
            <Segmented
              label="B — execution"
              value={conds.bBroken ? "botched" : "clean"}
              options={[
                { v: "clean", l: "clean" },
                { v: "botched", l: "botched" },
              ]}
              onChange={(v) => setCond("bBroken", v === "botched")}
              disabled={running}
            />
          )}
          {controls.includes("gamma") && (
            <Segmented
              label="Γ — sincerity (speaker's private plan)"
              value={conds.gamma}
              options={[
                { v: "sincere", l: "sincere (intact)" },
                { v: "deceptive", l: "deceptive (broken)" },
              ]}
              onChange={(v) => setCond("gamma", v as SandboxConditions["gamma"])}
              disabled={running}
            />
          )}
          {controls.includes("channel") && (
            <Segmented
              label="Epistemic channel — can Riley see Sam's private plan?"
              value={conds.channel}
              options={[
                { v: "concealed", l: "concealed" },
                { v: "revealed", l: "revealed" },
              ]}
              onChange={(v) => setCond("channel", v as EpistemicChannel)}
              disabled={running}
            />
          )}
        </div>
      </div>

      {/* ── System prompts (composed, still editable) ────────────────────── */}
      <div className="panel">
        <h2>System prompts</h2>
        <p className="sub">
          The reified felicity conditions, composed from your toggles. You can still hand-edit; edits
          persist until you change a toggle above.
        </p>
        <div className="grid two">
          <div>
            <label className="field">Speaker (Sam) system prompt</label>
            <textarea rows={8} value={speakerPrompt} onChange={(e) => setSpeakerPrompt(e.target.value)} />
          </div>
          <div>
            <label className="field">Hearer (Riley) system prompt</label>
            <textarea rows={8} value={hearerPrompt} onChange={(e) => setHearerPrompt(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="field">Speaker is asked to (target utterance spec)</label>
          <textarea rows={2} value={spec} onChange={(e) => setSpec(e.target.value)} />
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          speaker: <span className="mono">{model.speakerModel}</span> · hearer:{" "}
          <span className="mono">{model.hearerModel}</span>
        </p>
      </div>
    </div>
  );
}

const TRISTATE = [
  { v: "off", l: "off" },
  { v: "intact", l: "intact" },
  { v: "broken", l: "broken" },
];

function Segmented({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="cond-row">
      <div className="cond-label">{label}</div>
      <div className="segmented">
        {options.map((o) => (
          <button
            key={o.v}
            className={`seg ${value === o.v ? "on" : ""}`}
            onClick={() => onChange(o.v)}
            disabled={disabled}
            type="button"
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
