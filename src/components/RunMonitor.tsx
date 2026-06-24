import type { BatchProgress } from "../core/types";
import { pct } from "../ui-util";

// Live progress while a batch runs, with running uptake rates per cell.

export function RunMonitor({
  progress,
  onStop,
}: {
  progress: BatchProgress;
  onStop: () => void;
}) {
  const frac = progress.total > 0 ? progress.completed / progress.total : 0;
  return (
    <div className="panel">
      <h2>Running…</h2>
      <p className="sub">
        The browser is driving the dialogue loop. Keep this tab open until it finishes.
      </p>
      <div className="progress">
        <div style={{ width: `${frac * 100}%` }} />
      </div>
      <p className="small muted">
        {progress.completed} / {progress.total} dialogues
      </p>

      <table className="results" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Cell</th>
            <th>Done</th>
            <th>Valid</th>
            <th>Running uptake rate</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(progress.byState).map(([s, b]) => (
            <tr key={s}>
              <td>
                <span className={`pill ${s}`}>{s}</span>
              </td>
              <td className="num">{b.completed}</td>
              <td className="num">{b.valid}</td>
              <td className="num">{b.valid > 0 ? pct(b.uptake / b.valid) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 14 }}>
        <button className="btn danger" onClick={onStop}>
          Stop
        </button>
      </div>
    </div>
  );
}
