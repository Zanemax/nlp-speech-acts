import { useRef, useState } from "react";
import type { BatchConfig, BatchProgress, ModelConfig } from "./core/types";
import { runBatch, type BatchResult } from "./core/batch";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "./api/gemini";
import { Sandbox, type SandboxSelection } from "./components/Sandbox";
import { ExperimentDesigner, type DesignerState } from "./components/ExperimentDesigner";
import { RunMonitor } from "./components/RunMonitor";
import { ResultsDashboard } from "./components/ResultsDashboard";

type Tab = "sandbox" | "batch";

export function App() {
  const [tab, setTab] = useState<Tab>("sandbox");

  // Shared model configuration. Distinct speaker/hearer models let you test
  // Prediction 4 (same-model may "know" the convention from pretraining).
  const [model, setModel] = useState<ModelConfig>({
    speakerModel: DEFAULT_MODEL,
    hearerModel: DEFAULT_MODEL,
    temperature: 1.0,
  });

  const [design, setDesign] = useState<DesignerState>({
    actType: "promise",
    condition: "A1",
    channel: "concealed",
    n: 20,
  });

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const stopRef = useRef(false);

  function promoteFromSandbox(sel: SandboxSelection) {
    setDesign((d) => ({
      ...d,
      actType: sel.actType,
      condition: sel.condition,
      channel: sel.channel,
    }));
    setResult(null);
    setTab("batch");
  }

  async function runExperiment() {
    setRunning(true);
    setResult(null);
    stopRef.current = false;

    const config: BatchConfig = {
      actType: design.actType,
      conditionUnderTest: design.condition,
      epistemicChannel: design.channel,
      n: design.n,
      model,
      states: ["intact", "broken"],
    };
    setProgress({
      total: config.states.length * config.n,
      completed: 0,
      byState: {
        intact: { completed: 0, uptake: 0, valid: 0 },
        broken: { completed: 0, uptake: 0, valid: 0 },
      },
    });

    try {
      const res = await runBatch(config, setProgress, () => stopRef.current);
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>Speech-Act Felicity Instrument</h1>
        <p>
          Manipulate Austin/Searle felicity conditions as editable prompts; measure uptake off the
          hearer's behavior. N-run rates, no LLM judge.
        </p>
      </header>

      <p className="thesis">
        Convention-based felicity (A.1 shared procedure, A.2 authority) is simulable and breakable
        and moves uptake; sincerity-based felicity (Γ) is invisible to uptake except through an
        epistemic channel.
      </p>

      <ModelBar model={model} onChange={setModel} disabled={running} />

      <nav className="tabs">
        <button className={tab === "sandbox" ? "active" : ""} onClick={() => setTab("sandbox")}>
          Sandbox
        </button>
        <button className={tab === "batch" ? "active" : ""} onClick={() => setTab("batch")}>
          Batch experiment
        </button>
      </nav>

      {tab === "sandbox" && <Sandbox model={model} onPromote={promoteFromSandbox} />}

      {tab === "batch" && (
        <>
          <ExperimentDesigner
            state={design}
            onChange={setDesign}
            onRun={runExperiment}
            running={running}
          />
          {running && progress && (
            <RunMonitor progress={progress} onStop={() => (stopRef.current = true)} />
          )}
          {result && <ResultsDashboard result={result} />}
        </>
      )}

      <footer className="panel" style={{ marginTop: 24 }}>
        <h2>Method &amp; caveats</h2>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <strong>No single-run theater.</strong> The Sandbox is for demonstration; the argument
            lives in the batch rates and effect sizes.
          </li>
          <li>
            <strong>No judge circularity.</strong> Uptake is read off a neutral forced-choice probe
            by a deterministic string parser — no model is ever asked “did it succeed?”.
          </li>
          <li>
            <strong>Compliance ≠ uptake.</strong> The command probe separates recognition-with-standing
            from mere helpful compliance.
          </li>
          <li>
            <strong>Sincerity is a proxy.</strong> Thread 2 uses an elicited <span className="mono">&lt;plan&gt;</span>{" "}
            as a textual stand-in for chain-of-thought, not raw reasoning tokens or
            activation-level ablation. Treat it as a prompt-level proxy.
          </li>
          <li>
            <strong>Browser-driven.</strong> The batch loop runs in this tab (one short serverless
            call per turn); keep it open while running. Large N on free Gemini tiers may be slow.
          </li>
        </ul>
      </footer>
    </div>
  );
}

function ModelBar({
  model,
  onChange,
  disabled,
}: {
  model: ModelConfig;
  onChange: (m: ModelConfig) => void;
  disabled: boolean;
}) {
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="row">
        <div>
          <label className="field">Speaker model</label>
          <select
            value={model.speakerModel}
            onChange={(e) => onChange({ ...model, speakerModel: e.target.value })}
            disabled={disabled}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Hearer model</label>
          <select
            value={model.hearerModel}
            onChange={(e) => onChange({ ...model, hearerModel: e.target.value })}
            disabled={disabled}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ maxWidth: 130 }}>
          <label className="field">Temperature</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={model.temperature}
            onChange={(e) => onChange({ ...model, temperature: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="small muted" style={{ alignSelf: "center", flex: 1 }}>
          {model.speakerModel === model.hearerModel
            ? "Same model on both sides — isolates the prompt, but shared weights may guarantee the convention (Prediction 4)."
            : "Cross-model — makes the shared-procedure question real."}
        </div>
      </div>
    </div>
  );
}
