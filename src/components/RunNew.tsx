import { useMemo, useRef, useState } from "react";
import type { BatchProgress, ModelConfig, RunResult, Turn } from "../core/types";
import { BUILTIN_ACTS, availableBreaks, type ActDefinition, type BreakId } from "../core/act";
import { runExperiment, runOnce } from "../core/liverun";
import { buildView, type ExplorerView } from "../core/explorer";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/gemini";
import { ChatTranscript } from "./ChatTranscript";
import { pct } from "../ui-util";

// Phase 2: launch a new experiment live. Pick act → pick one break → set N →
// run. "Run N times" produces a result that drops into the Explorer; "Run one
// (watch)" plays a single dialogue in the chat-bot view (always available, but
// never a headline — one run decides nothing).

export function RunNew({ onResult }: { onResult: (view: ExplorerView) => void }) {
  const [act, setAct] = useState<ActDefinition>(BUILTIN_ACTS[0]);
  const breaks = useMemo(() => availableBreaks(act), [act]);
  const [breakId, setBreakId] = useState<BreakId>(breaks[0].id);
  const [n, setN] = useState(12);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);

  const [mode, setMode] = useState<"idle" | "batch" | "single">("idle");
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [liveTurns, setLiveTurns] = useState<Turn[]>([]);
  const [single, setSingle] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const model: ModelConfig = { speakerModel: modelId, hearerModel: modelId, temperature: 1 };
  const running = mode !== "idle";

  function chooseAct(id: string) {
    const a = BUILTIN_ACTS.find((x) => x.id === id) ?? BUILTIN_ACTS[0];
    setAct(a);
    const av = availableBreaks(a);
    if (!av.some((b) => b.id === breakId)) setBreakId(av[0].id);
  }

  async function runBatch() {
    setMode("batch");
    setError(null);
    setSingle(null);
    stopRef.current = false;
    setProgress({
      total: 2 * n,
      completed: 0,
      byState: { intact: { completed: 0, uptake: 0, valid: 0 }, broken: { completed: 0, uptake: 0, valid: 0 } },
    });
    try {
      const result = await runExperiment(act, breakId, n, model, setProgress, () => stopRef.current);
      const view = buildView(result, `live · ${act.name} · ${breakId}`);
      onResult(view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMode("idle");
    }
  }

  async function runSingle() {
    setMode("single");
    setError(null);
    setSingle(null);
    setLiveTurns([]);
    try {
      const r = await runOnce(act, breakId, model, 0, (t) => setLiveTurns((p) => [...p, t]));
      setSingle(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMode("idle");
    }
  }

  return (
    <div className="panel">
      <h2>Run a new experiment</h2>
      <p className="sub">
        Pick an act, break one condition, choose how many runs. The result drops in below with the
        intact baseline. A single run is just to watch — the rate is the result.
      </p>

      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <label className="field">Speech act</label>
          <select value={act.id} onChange={(e) => chooseAct(e.target.value)} disabled={running}>
            {BUILTIN_ACTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ maxWidth: 110 }}>
          <label className="field">Runs (N)</label>
          <input
            type="number"
            min={2}
            max={30}
            value={n}
            onChange={(e) => setN(Math.max(2, Math.min(30, Number(e.target.value) || 12)))}
            disabled={running}
          />
        </div>
        <div>
          <label className="field">Model (both sides)</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={running}>
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="field">Break one condition</label>
        <div className="break-buttons">
          {breaks.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`break-btn ${breakId === b.id ? "on" : ""}`}
              onClick={() => setBreakId(b.id)}
              disabled={running}
              title={b.gloss}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn" onClick={runBatch} disabled={running}>
            {mode === "batch" ? "Running…" : `Run ${n} times`}
          </button>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button className="btn secondary" onClick={runSingle} disabled={running}>
            {mode === "single" ? "Running…" : "Run one (watch)"}
          </button>
        </div>
        {running && (
          <div style={{ flex: "0 0 auto" }}>
            <button className="btn danger" onClick={() => (stopRef.current = true)}>
              Stop
            </button>
          </div>
        )}
      </div>

      {error && <p className="note" style={{ marginBottom: 0 }}>{error}</p>}

      {mode === "batch" && progress && <BatchProgressView p={progress} />}

      {(mode === "single" || single) && (
        <div style={{ marginTop: 16 }}>
          <p className="small muted">
            One run — watch how it goes, but it decides nothing. Run N times for a rate.
          </p>
          <ChatTranscript turns={liveTurns} result={single} running={mode === "single"} />
        </div>
      )}
    </div>
  );
}

function BatchProgressView({ p }: { p: BatchProgress }) {
  const frac = p.total ? p.completed / p.total : 0;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="progress">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
      <div className="legend">
        {Object.entries(p.byState).map(([s, b]) => (
          <span key={s}>
            <span className={`pill ${s}`}>{s}</span> {b.completed} done
            {b.valid > 0 && ` · so far ${pct(b.uptake / b.valid)} taken up`}
          </span>
        ))}
      </div>
    </div>
  );
}
