import type { CellResult, RunResult } from "../core/types";
import { CATEGORY_LABELS } from "../ui-util";
import { useState } from "react";

// Renders one run's full dialogue plus the parsed verdict, and (as an inspector)
// lets you drill into any run of a finished cell via a grid of outcome dots.

export function RunTranscript({ run }: { run: RunResult }) {
  return (
    <div>
      <div className="transcript">
        {run.turns.map((t, i) => (
          <div key={i} className={`turn ${t.role}`}>
            <div className="who">
              {t.role === "speaker" ? "Speaker (Sam)" : t.role === "hearer" ? "Hearer (Riley)" : "Probe (neutral)"}
            </div>
            {t.role === "hearer" && t.shown && (
              <div className="shown">received: {t.shown}</div>
            )}
            {t.role === "probe" && (
              <div className="shown">{t.shown}</div>
            )}
            {t.plan !== undefined && (
              <div className="plan">
                <strong>&lt;plan&gt;</strong> {t.plan}
              </div>
            )}
            <div className="body">
              {t.role === "speaker" && t.say !== undefined ? t.say : t.text || <em className="muted">(empty)</em>}
            </div>
          </div>
        ))}
      </div>
      <Verdict run={run} />
    </div>
  );
}

function Verdict({ run }: { run: RunResult }) {
  if (run.status === "error") {
    return <div className="verdict invalid">Run error: {run.error}</div>;
  }
  const cls = run.uptake === true ? "" : run.uptake === false ? "no" : "invalid";
  const head =
    run.uptake === true ? "UPTAKE" : run.uptake === false ? "NO UPTAKE" : "INVALID (unparseable)";
  return (
    <div className={`verdict ${cls}`}>
      <span className="mono">{head}</span>
      <span className="muted small">— {CATEGORY_LABELS[run.category]}</span>
    </div>
  );
}

export function TranscriptInspector({ cell }: { cell: CellResult }) {
  const [sel, setSel] = useState(0);
  const runs = cell.runs;
  if (runs.length === 0) return null;
  const selected = runs[Math.min(sel, runs.length - 1)];

  return (
    <div>
      <div className="legend">
        <span><i style={{ background: "var(--intact)" }} /> uptake</span>
        <span><i style={{ background: "#d8cfc4" }} /> no uptake</span>
        <span><i style={{ background: "var(--invalid)" }} /> invalid</span>
        <span><i style={{ background: "var(--broken)" }} /> error</span>
      </div>
      <div className="runlist">
        {runs.map((r, i) => (
          <div
            key={i}
            title={`run ${i + 1}: ${CATEGORY_LABELS[r.category]}`}
            className={`dot ${dotClass(r)} ${i === sel ? "sel" : ""}`}
            onClick={() => setSel(i)}
          />
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Run {sel + 1} of {runs.length}
      </p>
      <RunTranscript run={selected} />
    </div>
  );
}

function dotClass(r: RunResult): string {
  if (r.status === "error") return "err";
  if (r.status === "invalid") return "inv";
  return r.uptake ? "up" : "no";
}
