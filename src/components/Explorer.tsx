import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import {
  buildView,
  parseResult,
  type CellView,
  type ExplorerView,
  type RunView,
} from "../core/explorer";
import { ChatTranscript } from "./ChatTranscript";
import { RunNew } from "./RunNew";

// The exploration sandbox (Phase 1: load & display).
// Four things only: which act, which condition is broken, N, and the uptake
// RATE with the intact baseline alongside. Expand any run to read it as a
// chat-bot dialogue — the always-available single-run view. No taxonomy, no
// effect sizes, no comparison features.

export function Explorer() {
  const [views, setViews] = useState<ExplorerView[]>([]);
  const [selected, setSelected] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-load the bundled sample results on mount.
  useEffect(() => {
    (async () => {
      try {
        const idx = (await (await fetch("/results/index.json")).json()) as string[];
        const loaded: ExplorerView[] = [];
        for (const name of idx) {
          try {
            const raw = await (await fetch(`/results/${name}`)).json();
            loaded.push(buildView(parseResult(raw), name));
          } catch (e) {
            console.warn(`skipped ${name}:`, e);
          }
        }
        setViews(loaded);
      } catch {
        // No bundled samples — that's fine, the user can upload.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      const raw = JSON.parse(await file.text());
      const view = buildView(parseResult(raw), file.name);
      setViews((v) => [...v, view]);
      setSelected(views.length);
    } catch (err) {
      setLoadError(`Couldn't load ${file.name}: ${(err as Error).message}`);
    }
    e.target.value = "";
  }

  const view = views[selected];

  return (
    <div>
      <header className="masthead">
        <h1>Speech-act sandbox</h1>
        <p>
          Pick an act, break one of its conditions, and see how often it still comes off across N
          runs between two models. A single run never decides anything — every result is a rate.
        </p>
      </header>

      <RunNew
        onResult={(view) => {
          setViews((v) => [...v, view]);
          setSelected(views.length);
        }}
      />

      <div className="panel" style={{ padding: 14 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="field">Result to explore</label>
            <select
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              disabled={views.length === 0}
            >
              {views.map((v, i) => (
                <option key={i} value={i}>
                  {v.actName} — broken: {v.breakLabel} · N={v.n} {v.source ? `(${v.source})` : ""}
                </option>
              ))}
              {views.length === 0 && <option>No results loaded</option>}
            </select>
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label className="btn secondary" style={{ cursor: "pointer" }}>
              Load a result file…
              <input
                type="file"
                accept="application/json,.json"
                onChange={onUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
        {loadError && <p className="note" style={{ marginBottom: 0 }}>{loadError}</p>}
        {loading && <p className="small muted" style={{ margin: "8px 0 0" }}>Loading sample results…</p>}
      </div>

      {view ? (
        <ResultView view={view} />
      ) : (
        !loading && (
          <div className="panel">
            <p className="muted">
              No results to show yet. Load an exported <span className="mono">result-*.json</span>{" "}
              file to explore it.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function ResultView({ view }: { view: ExplorerView }) {
  return (
    <>
      <div className="panel">
        {/* The four things. */}
        <div className="four">
          <Fact label="Act">{view.actName}</Fact>
          <Fact label="Broken condition">{view.breakLabel}</Fact>
          <Fact label="Runs each">N = {view.n}</Fact>
          <Fact label="Models">{view.model}</Fact>
        </div>

        <p className="signature">
          <strong>What counts as “taken up”:</strong> {view.uptakeSignature}.
        </p>

        <div className="rates">
          {view.broken && <RateCard cell={view.broken} highlight />}
          {view.intact && <RateCard cell={view.intact} />}
        </div>
      </div>

      {view.broken && <CellRuns title="Runs with the condition broken" cell={view.broken} />}
      {view.intact && <CellRuns title="Runs with everything intact (baseline)" cell={view.intact} />}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <div className="fact-label">{label}</div>
      <div className="fact-value">{children}</div>
    </div>
  );
}

function RateCard({ cell, highlight }: { cell: CellView; highlight?: boolean }) {
  const stateLabel = cell.state === "broken" ? "condition broken" : "intact baseline";
  return (
    <div className={`rate-card ${highlight ? "hl" : ""}`}>
      <div className="rate-state">
        <span className={`pill ${cell.state}`}>{stateLabel}</span>
      </div>
      <div className="rate-big">
        taken up in <strong>{cell.uptakeCount}/{cell.n}</strong> runs
      </div>
      <div className="rate-bar">
        <div className={`rate-fill ${cell.state}`} style={{ width: `${(cell.uptakeCount / cell.n) * 100}%` }} />
      </div>
      <div className="small muted manip">
        {cell.performedNote}
        {cell.invalidCount > 0 && ` · ${cell.invalidCount} run(s) errored/invalid`}
      </div>
    </div>
  );
}

function CellRuns({ title, cell }: { title: string; cell: CellView }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="sub">
        Expand any run to read the whole dialogue and see why it did or didn’t come off.
      </p>
      <div className="runrows">
        {cell.runs.map((r) => (
          <RunRow key={r.index} run={r} />
        ))}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: RunView }) {
  const [open, setOpen] = useState(false);
  const tookUp = run.uptake === true;
  const badge =
    run.status !== "ok"
      ? { cls: "invalid", text: run.status === "error" ? "errored" : "invalid" }
      : tookUp
        ? { cls: "yes", text: "taken up" }
        : { cls: "no", text: "not taken up" };

  return (
    <div className="runrow">
      <button className="runrow-head" onClick={() => setOpen((o) => !o)}>
        <span className="runrow-idx">Run {run.index + 1}</span>
        <span className={`tag ${badge.cls}`}>{badge.text}</span>
        {!run.performed && <span className="tag warn">speaker didn’t perform the act</span>}
        <span className="runrow-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="runrow-body">
          <ChatTranscript
            turns={run.turns}
            result={run}
            channel="concealed"
            running={false}
          />
        </div>
      )}
    </div>
  );
}
