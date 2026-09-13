import { useMemo, useRef, useState } from "react";
import type { Turn } from "../core/types";
import { BUILTIN_ACTS, type ActDefinition } from "../core/act";
import {
  conditionsFor,
  defaultStates,
  generateAustin,
  type ConditionKey,
  type ConditionStates,
} from "../austin/prompts";
import { runDiegoEliza, type AustinRun } from "../austin/run";
import {
  buildExport,
  downloadJson,
  stamp,
  violatedTag,
  type RunRecord,
} from "../austin/export";
import { enumerateCells, runSweep, type SweepProgress, type SweepScope } from "../austin/sweep";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/gemini";
import { CATEGORY_LABELS } from "../ui-util";
import { ChatTranscript } from "./ChatTranscript";

// AUSTIN BOT — a demonstration of speech acts through a dialogue between Diego
// (speaker) and Eliza (listener). Runs sharing an identical setup accumulate
// into a scorecard and can be exported as JSON; a sweep runs a whole condition
// design and writes one JSON per cell.

export function AustinBot() {
  const [act, setAct] = useState<ActDefinition>(BUILTIN_ACTS[0]);
  const [states, setStates] = useState<ConditionStates>(() => defaultStates(BUILTIN_ACTS[0]));
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);

  const [running, setRunning] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<AustinRun | null>(null);
  const [records, setRecords] = useState<Record<string, RunRecord[]>>({});

  // How many times to run the same setup back to back. 1 = a single dialogue.
  const [n, setN] = useState(1);
  const [done, setDone] = useState(0);
  const stopRef = useRef(false);

  // Sweep: run a whole condition design and write one JSON per cell.
  const [scope, setScope] = useState<SweepScope>("paper");
  const [sweepN, setSweepN] = useState(50);
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState<SweepProgress | null>(null);
  /** 1-based cell to start from, so an interrupted sweep can be resumed. */
  const [fromCell, setFromCell] = useState(1);
  const [sweepNote, setSweepNote] = useState<string | null>(null);
  const cells = useMemo(() => enumerateCells(act, scope), [act, scope]);
  const cellCount = cells.length;
  const busy = running || sweeping;

  // Manual overrides of the composed context prompts. null = use the generated
  // prompt (and follow condition/act changes); a string = the user has edited it.
  const [editedDiego, setEditedDiego] = useState<string | null>(null);
  const [editedEliza, setEditedEliza] = useState<string | null>(null);

  const conditions = useMemo(() => conditionsFor(act), [act]);
  const scenario = useMemo(() => generateAustin(act, states), [act, states]);

  // Effective context prompts that will actually be sent.
  const diegoPrompt = editedDiego ?? scenario.diegoContextPrompt;
  const elizaPrompt = editedEliza ?? scenario.elizaContextPrompt;

  // The model + act + conditions + any manual edits all define the "setup", so
  // they key the scorecard and the export.
  const editKey =
    editedDiego !== null || editedEliza !== null
      ? "|edit:" + hashStr((editedDiego ?? "") + "¦" + (editedEliza ?? ""))
      : "";
  const sig = useMemo(
    () =>
      modelId +
      "|" +
      act.id +
      "|" +
      conditions.map((c) => c.key + (states[c.key] ? "1" : "0")).join("") +
      editKey,
    [modelId, act, conditions, states, editKey],
  );
  const setupRuns = records[sig] ?? [];
  const behaviouralUp = setupRuns.filter((r) => r.behavioural.uptake === true).length;
  const denialUp = setupRuns.filter((r) => r.denial.uptake === true).length;

  function resetEdits() {
    setEditedDiego(null);
    setEditedEliza(null);
  }

  function chooseAct(id: string) {
    const a = BUILTIN_ACTS.find((x) => x.id === id) ?? BUILTIN_ACTS[0];
    setAct(a);
    setStates(defaultStates(a));
    resetEdits();
    setTurns([]);
    setResult(null);
  }

  function toggle(key: ConditionKey) {
    setStates((s) => ({ ...s, [key]: !s[key] }));
    resetEdits(); // re-seed prompts from the new condition set
    setTurns([]);
    setResult(null);
  }

  async function run() {
    setRunning(true);
    stopRef.current = false;
    setDone(0);
    try {
      for (let i = 0; i < n; i++) {
        if (stopRef.current) break;
        setDone(i);
        setTurns([]);
        setResult(null);
        const r = await runDiegoEliza(act, states, modelId, (t) => setTurns((p) => [...p, t]), {
          diegoContextPrompt: diegoPrompt,
          elizaContextPrompt: elizaPrompt,
        });
        setResult(r);
        // A run that errored isn't a measurement — stop rather than burn the rest.
        if (r.status === "error") break;
        const record: RunRecord = {
          at: new Date().toISOString(),
          status: r.status,
          behavioural: r.behavioural,
          denial: r.denial,
          turns: r.turns,
        };
        setRecords((rec) => ({ ...rec, [sig]: [...(rec[sig] ?? []), record] }));
      }
    } finally {
      setRunning(false);
      setDone(0);
    }
  }

  function exportSetup() {
    const payload = buildExport({
      act,
      states,
      model: modelId,
      runs: setupRuns,
      diegoContextPrompt: diegoPrompt,
      elizaContextPrompt: elizaPrompt,
    });
    const violated = conditions.filter((c) => !(states[c.key] ?? true)).map((c) => c.key);
    downloadJson(payload, `austin-bot-${act.id}-${violatedTag(violated)}-${stamp()}.json`);
  }

  /**
   * Run every cell of the chosen design N times, writing one JSON per cell as it
   * finishes (so a stopped sweep still leaves usable files) plus a summary table
   * at the end. Uses generated prompts — hand edits don't apply across cells.
   */
  async function startSweep() {
    setSweeping(true);
    stopRef.current = false;
    setSweepProgress(null);
    setSweepNote(null);
    const runStamp = stamp();
    const summaryCells: {
      cell: number;
      label: string;
      violated: string[];
      behavioural: unknown;
      denial: unknown;
    }[] = [];
    let outcome: Awaited<ReturnType<typeof runSweep>> | null = null;

    try {
      outcome = await runSweep({
        act,
        scope,
        n: sweepN,
        model: modelId,
        startAt: fromCell - 1,
        onProgress: setSweepProgress,
        onCellDone: (c) => {
          const payload = buildExport({
            act,
            states: c.cell.states,
            model: modelId,
            runs: c.runs,
          });
          downloadJson(
            payload,
            `austin-bot-${act.id}-n${sweepN}-${violatedTag(c.cell.violated)}-${runStamp}.json`,
          );
          summaryCells.push({
            cell: cells.findIndex((x) => x.label === c.cell.label) + 1,
            label: c.cell.label,
            violated: c.cell.violated,
            behavioural: c.behavioural,
            denial: c.denial,
          });
          // Fold into the scorecard so a swept setup shows its tally too.
          const key =
            modelId +
            "|" +
            act.id +
            "|" +
            conditions.map((x) => x.key + (c.cell.states[x.key] ? "1" : "0")).join("");
          setRecords((rec) => ({ ...rec, [key]: [...(rec[key] ?? []), ...c.runs] }));
        },
        shouldStop: () => stopRef.current,
      });
    } finally {
      if (summaryCells.length) {
        const first = summaryCells[0].cell;
        const last = summaryCells[summaryCells.length - 1].cell;
        downloadJson(
          {
            exportedAt: new Date().toISOString(),
            app: "AUSTIN BOT",
            sweep: {
              act: act.name,
              actId: act.id,
              model: modelId,
              scope,
              n: sweepN,
              cellsCovered: `${first}-${last} of ${cellCount}`,
            },
            cells: summaryCells,
          },
          `austin-bot-${act.id}-n${sweepN}-${scope}-cells${first}-${last}-summary-${runStamp}.json`,
        );
      }

      // Park the "from" box on the first cell that still needs doing, so
      // resuming an interrupted sweep is one click.
      const next = outcome ? outcome.nextIndex : fromCell - 1;
      if (next >= cellCount) {
        setFromCell(1);
        setSweepNote(`Finished all ${cellCount} cells. “From” reset to 1.`);
      } else {
        setFromCell(next + 1);
        setSweepNote(
          outcome?.abortedReason
            ? `Stopped at cell ${next + 1}/${cellCount} — ${outcome.abortedReason} Press “Run sweep” to resume from there.`
            : `Stopped at cell ${next + 1}/${cellCount}. Press “Run sweep” to resume from there.`,
        );
      }
      setSweeping(false);
      setSweepProgress(null);
    }
  }

  return (
    <div className="searlebot">
      <header className="sb-head">
        <div className="sb-brand">
          <img
            className="sb-austin"
            src="/austin.png"
            alt="J. L. Austin — binary portrait"
            width={92}
            height={112}
          />
          <h1>AUSTIN BOT</h1>
        </div>
        <div className="sb-sub">CHARACTERS</div>
        <div className="sb-names">Diego &amp; Eliza</div>
      </header>

      {/* ── act selector + explanation ─────────────────────────────────── */}
      <div className="cols">
        <div className="col-left">
          <label className="field">Speech act</label>
          <select value={act.id} onChange={(e) => chooseAct(e.target.value)} disabled={busy}>
            {BUILTIN_ACTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-right">
          <p className="sb-explain">
            <strong>What Diego attempts.</strong> {act.propositionalContent}. For example:{" "}
            <em>“{act.utteranceExample}”</em>.
          </p>
          <p className="sb-explain">
            <strong>How uptake is measured.</strong> {act.uptakeSignature}.
          </p>
        </div>
      </div>

      {/* ── CONDITIONS ─────────────────────────────────────────────────── */}
      <h2 className="sb-conditions">CONDITIONS</h2>

      {conditions.map((c) => {
        const on = states[c.key] ?? true;
        const frag = scenario.fragments[c.key];
        return (
          <div className="cols cond-row-sb" key={c.key}>
            <div className="col-left">
              <button
                type="button"
                className={`cond-toggle ${on ? "true" : "false"}`}
                onClick={() => toggle(c.key)}
                disabled={busy}
                aria-pressed={on}
              >
                <span className="cond-head">
                  <span className="cond-state">{on ? "TRUE" : "FALSE"}</span>
                  <span className={`cond-switch ${on ? "on" : ""}`} aria-hidden="true" />
                </span>
                <span className="cond-text">{c.label}</span>
              </button>
            </div>
            <div className="col-right">
              <div className={`frag-box ${on ? "true" : "false"}`}>
                <div className="frag-side">
                  → goes into{" "}
                  {frag.side === "both" ? "both Diego’s and Eliza’s" : `${frag.side}’s`}{" "}
                  {frag.target === "trigger" ? "first message" : "context prompt"}
                </div>
                <pre>{frag.text}</pre>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── context prompts (editable) + verbatim extras ───────────────── */}
      <div className="sb-prompts">
        <h2 className="sb-conditions">CONTEXT PROMPTS</h2>
        <p className="sb-prompt-note">
          Composed from the conditions above — but you can edit them by hand and run your own.
          Changing a condition or the act resets them to the generated version.
        </p>

        <PromptEditor
          label="Diego · context prompt"
          value={diegoPrompt}
          edited={editedDiego !== null}
          disabled={busy}
          onChange={setEditedDiego}
          onReset={() => setEditedDiego(null)}
        />
        <PromptEditor
          label="Eliza · context prompt"
          value={elizaPrompt}
          edited={editedEliza !== null}
          disabled={busy}
          onChange={setEditedEliza}
          onReset={() => setEditedEliza(null)}
        />

        <details className="sb-reveal">
          <summary>Diego’s first message (verbatim)</summary>
          <pre>{scenario.triggerMessage}</pre>
        </details>
        <details className="sb-reveal">
          <summary>Behavioural uptake test (verbatim)</summary>
          <pre>{scenario.behaviouralTest}</pre>
        </details>
        <details className="sb-reveal">
          <summary>Denial probe (verbatim)</summary>
          <pre>{scenario.denialTest}</pre>
        </details>
      </div>

      {/* ── run + dialogue + result + scorecard ────────────────────────── */}
      <div className="sb-run">
        <button
          className="btn"
          onClick={running ? () => (stopRef.current = true) : run}
          disabled={running && n === 1}
        >
          <svg className="btn-ic" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            {running && n > 1 ? (
              <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
            ) : (
              <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
            )}
          </svg>
          {running
            ? n === 1
              ? "Running…"
              : `Stop (${done + 1}/${n})`
            : n === 1
              ? "Run the dialogue"
              : `Run ${n} times`}
        </button>
        <label className="sb-model">
          <span className="small muted">Runs</span>
          <input
            className="sb-n"
            type="number"
            min={1}
            max={50}
            value={n}
            disabled={busy}
            onChange={(e) => setN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="sb-model">
          <span className="small muted">Model</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={busy}>
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── sweep: run a whole condition design and write the JSON files ── */}
      <div className="sb-sweep">
        <button
          className="btn secondary"
          onClick={sweeping ? () => (stopRef.current = true) : startSweep}
          disabled={running}
        >
          <svg className="btn-ic" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            {sweeping ? (
              <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
            ) : (
              <path
                d="M2.5 8h11M8 2.5v11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
          {sweeping
            ? "Stop sweep"
            : fromCell > 1
              ? `Resume from cell ${fromCell}/${cellCount}`
              : `Run sweep — ${cellCount} cells × ${sweepN}`}
        </button>
        <label className="sb-model">
          <span className="small muted">Cells</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as SweepScope);
              setFromCell(1);
              setSweepNote(null);
            }}
            disabled={busy}
          >
            <option value="paper">Paper design — baseline + each condition</option>
            <option value="full">Full factorial — every combination</option>
          </select>
        </label>
        <label className="sb-model">
          <span className="small muted">From</span>
          <input
            className="sb-n"
            type="number"
            min={1}
            max={cellCount}
            value={fromCell}
            disabled={busy}
            title={`Start at cell ${fromCell}: ${cells[fromCell - 1]?.label ?? ""}`}
            onChange={(e) =>
              setFromCell(Math.max(1, Math.min(cellCount, Number(e.target.value) || 1)))
            }
          />
        </label>
        <label className="sb-model">
          <span className="small muted">n</span>
          <input
            className="sb-n"
            type="number"
            min={1}
            max={200}
            value={sweepN}
            disabled={busy}
            onChange={(e) => setSweepN(Math.max(1, Math.min(200, Number(e.target.value) || 50)))}
          />
        </label>
      </div>

      {sweeping && (
        <SweepPanel p={sweepProgress} total={cellCount} n={sweepN} />
      )}
      {!sweeping && sweepNote && <p className="sb-resume-note">{sweepNote}</p>}
      {!sweeping && (
        <p className="sb-sweep-note">
          Runs cells {fromCell}–{cellCount} ({(cellCount - fromCell + 1) * sweepN} dialogues),
          writing one JSON per cell as it finishes plus a summary table. Your browser may ask to
          allow multiple downloads.
        </p>
      )}

      {(turns.length > 0 || running) && (
        <div className="panel sb-dialogue">
          {/* The verdicts are reported in the banner below, not in the chat. */}
          <ChatTranscript
            turns={turns}
            running={running}
            speakerName="Diego"
            hearerName="Eliza"
          />
        </div>
      )}

      {result && result.status === "error" && (
        <div className="note">Couldn’t run: {result.error}</div>
      )}

      {result && result.status !== "error" && <UptakeBanner run={result} />}

      {setupRuns.length > 0 && (
        <div className="scorecard">
          <div className="sc-stats">
            <div className="sc-stat">
              <div className="sc-big">
                {behaviouralUp}/{setupRuns.length}
              </div>
              <div className="sc-label">behavioural</div>
            </div>
            <div className="sc-stat">
              <div className="sc-big">
                {denialUp}/{setupRuns.length}
              </div>
              <div className="sc-label">denial probe</div>
            </div>
          </div>
          <div className="sc-text">
            With <strong>this exact setup</strong>, across {setupRuns.length} run
            {setupRuns.length === 1 ? "" : "s"} this session. Run it again to build the picture — a
            single run never settles it.
          </div>
          <button className="btn secondary sc-export" onClick={exportSetup} disabled={busy}>
            <svg className="btn-ic" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M8 1.5v8m0 0L5 6.5m3 3 3-3M2.5 11v2.5h11V11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export JSON
          </button>
        </div>
      )}
    </div>
  );
}

function SweepPanel({ p, total, n }: { p: SweepProgress | null; total: number; n: number }) {
  const cellsDone = p ? p.cellIndex : 0;
  const overall = p ? (p.cellIndex * n + p.runsDone) / (total * n) : 0;
  return (
    <div className="sweep-panel">
      <div className="sweep-head">
        <span className="sweep-cell">
          Cell {cellsDone + 1}/{total} — {p ? p.cellLabel : "starting…"}
        </span>
        <span className="small muted">
          {p ? `${p.runsDone}/${p.runsTotal} runs` : ""}
          {p && p.errors > 0 ? ` · ${p.errors} errored` : ""}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${overall * 100}%` }} />
      </div>
      {p && p.runsDone > 0 && (
        <div className="small muted">
          this cell so far — behavioural {p.behaviouralUp}/{p.runsDone} · denial {p.denialUp}/
          {p.runsDone}
        </div>
      )}
      {p?.lastError && <div className="sweep-error">last error — {p.lastError}</div>}
    </div>
  );
}

function PromptEditor({
  label,
  value,
  edited,
  disabled,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  edited: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="prompt-edit">
      <div className="prompt-edit-head">
        <span className="prompt-edit-label">{label}</span>
        {edited && (
          <button type="button" className="prompt-reset" onClick={onReset} disabled={disabled}>
            reset to generated
          </button>
        )}
      </div>
      <textarea
        className="prompt-edit-area"
        value={value}
        spellCheck={false}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(14, Math.max(4, value.split("\n").length + 1))}
      />
    </div>
  );
}

/** Small stable string hash (djb2) for keying a setup by its edited prompts. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function UptakeBanner({ run }: { run: AustinRun }) {
  const tests = [
    { name: "Behavioural", v: run.behavioural },
    { name: "Denial probe", v: run.denial },
  ];
  const yes = tests.filter((t) => t.v.uptake === true).length;
  const no = tests.filter((t) => t.v.uptake === false).length;
  const cls = yes === 2 ? "yes" : no === 2 ? "no" : "mixed";
  const head =
    yes === 2
      ? "The act came off"
      : no === 2
        ? "The act did not come off"
        : yes + no === 0
          ? "Couldn’t read Eliza’s responses"
          : "Mixed — the tests disagree";

  return (
    <div className={`uptake-banner ${cls}`}>
      <span className="ub-head">{head}</span>
      <div className="ub-tests">
        {tests.map((t) => (
          <span
            key={t.name}
            className={`ub-test ${t.v.uptake === true ? "yes" : t.v.uptake === false ? "no" : "inv"}`}
          >
            <strong>{t.name}:</strong>{" "}
            {t.v.uptake === null ? "unreadable" : t.v.uptake ? "taken up" : "not taken up"}
            {t.v.uptake !== null && (
              <span className="ub-move">{CATEGORY_LABELS[t.v.category]}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
