import { useState } from "react";
import type { CellResult } from "../core/types";
import type { BatchResult } from "../core/batch";
import { effectSize, felicityVerdict } from "../core/aggregate";
import { LARGE_EFFECT_THRESHOLD } from "../scenarios/predictions";
import { CONDITION_LABELS } from "../scenarios/registry";
import { Predictions } from "./Predictions";
import { TranscriptInspector } from "./TranscriptInspector";
import { pct, pct1 } from "../ui-util";

// The "bigger picture": per-cell rates with Wilson CIs, the headline effect of
// breaking the condition, the misfire/abuse tag, prediction scoring, and a
// per-cell transcript inspector. Raw runs are exportable for audit.

export function ResultsDashboard({ result }: { result: BatchResult }) {
  const intact = result.cells.intact;
  const broken = result.cells.broken;
  if (!intact || !broken) {
    return (
      <div className="panel">
        <h2>Results</h2>
        <p className="sub">Batch was stopped before both cells completed.</p>
        {intact && <CellTable cells={[intact]} />}
        {broken && <CellTable cells={[broken]} />}
      </div>
    );
  }

  const eff = effectSize(intact.rate, broken.rate);
  const verdict = felicityVerdict(
    result.config.conditionUnderTest,
    eff.riskDifference,
    LARGE_EFFECT_THRESHOLD,
  );

  return (
    <>
      <div className="panel">
        <h2>Result — {CONDITION_LABELS[result.config.conditionUnderTest]}</h2>
        <p className="sub">
          {result.config.actType} · speaker {result.config.model.speakerModel} · hearer{" "}
          {result.config.model.hearerModel}
          {result.config.conditionUnderTest === "GAMMA" && ` · ${result.config.epistemicChannel}`}
        </p>

        <div className="headline">
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ flex: "0 0 auto" }}>
              <div className="muted small">Effect of breaking the condition</div>
              <div className="big">
                {eff.riskDifference >= 0 ? "−" : "+"}
                {pct(Math.abs(eff.riskDifference))} uptake
              </div>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <div className="muted small">Cohen's h</div>
              <div className="big">{eff.cohensH.toFixed(2)}</div>
              <div className="small muted">{eff.magnitude} effect</div>
            </div>
            <div style={{ flex: 1 }}>
              <span className={`pill ${verdict.tag}`}>{verdict.tag}</span>
              <p className="small" style={{ marginTop: 6 }}>
                {verdict.gloss}
              </p>
            </div>
          </div>
        </div>

        <div className="bars">
          <BarRow label="intact" cell={intact} />
          <BarRow label="broken" cell={broken} />
        </div>

        <CellTable cells={[intact, broken]} />
        <ExportButton result={result} />
      </div>

      <Predictions
        activeCondition={result.config.conditionUnderTest}
        activeChannel={result.config.epistemicChannel}
        measuredRiskDifference={eff.riskDifference}
      />

      <div className="panel">
        <h2>Transcript inspector</h2>
        <p className="sub">Every run is kept for audit. Click a cell, then a run.</p>
        <CellInspector intact={intact} broken={broken} />
      </div>
    </>
  );
}

function BarRow({ label, cell }: { label: "intact" | "broken"; cell: CellResult }) {
  const ciW = Math.max(0, cell.ciHigh - cell.ciLow);
  return (
    <div className="bar-row">
      <span className={`pill ${label}`}>{label}</span>
      <div className="bar-track">
        <div className={`bar-fill ${label}`} style={{ width: `${cell.rate * 100}%` }} />
        <div
          className="ci"
          style={{ left: `${cell.ciLow * 100}%`, width: `${ciW * 100}%` }}
          title={`95% CI: ${pct1(cell.ciLow)}–${pct1(cell.ciHigh)}`}
        />
      </div>
      <span className="bar-num">
        {pct(cell.rate)} <span className="muted small">({cell.uptakeCount}/{cell.nValid})</span>
      </span>
    </div>
  );
}

function CellTable({ cells }: { cells: CellResult[] }) {
  return (
    <table className="results">
      <thead>
        <tr>
          <th>Cell</th>
          <th>Uptake rate</th>
          <th>95% CI</th>
          <th>n valid</th>
          <th>invalid</th>
          <th>error</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((c) => (
          <tr key={c.scenario.id}>
            <td>
              <span className={`pill ${c.scenario.conditionState}`}>{c.scenario.conditionState}</span>
            </td>
            <td className="num">{pct1(c.rate)}</td>
            <td className="num">
              {pct1(c.ciLow)}–{pct1(c.ciHigh)}
            </td>
            <td className="num">{c.nValid}</td>
            <td className="num">{c.nInvalid}</td>
            <td className="num">{c.nError}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellInspector({ intact, broken }: { intact: CellResult; broken: CellResult }) {
  const [which, setWhich] = useState<"intact" | "broken">("broken");
  const cell = which === "intact" ? intact : broken;
  return (
    <div>
      <div className="inline-list" style={{ marginBottom: 10 }}>
        <button
          className={`btn ${which === "intact" ? "" : "secondary"}`}
          onClick={() => setWhich("intact")}
        >
          intact cell
        </button>
        <button
          className={`btn ${which === "broken" ? "" : "secondary"}`}
          onClick={() => setWhich("broken")}
        >
          broken cell
        </button>
      </div>
      <TranscriptInspector cell={cell} />
    </div>
  );
}

function ExportButton({ result }: { result: BatchResult }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `result-${result.config.actType}-${result.config.conditionUnderTest}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn secondary" onClick={exportJson}>
        Export raw runs (JSON)
      </button>
    </div>
  );
}
