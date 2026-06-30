import { useMemo, useState } from "react";
import type { RunResult, Turn } from "../core/types";
import { BUILTIN_ACTS, type ActDefinition } from "../core/act";
import {
  conditionsFor,
  defaultStates,
  generateAustin,
  type ConditionKey,
  type ConditionStates,
} from "../austin/prompts";
import { runDiegoEliza } from "../austin/run";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "../api/gemini";
import { CATEGORY_LABELS } from "../ui-util";
import { ChatTranscript } from "./ChatTranscript";

// AUSTIN BOT — a friendly demonstration of speech acts through a dialogue
// between Diego (speaker) and Eliza (listener). Single runs only; identical
// setups accumulate into an in-session scorecard.

type Tally = { up: number; total: number };

export function AustinBot() {
  const [act, setAct] = useState<ActDefinition>(BUILTIN_ACTS[0]);
  const [states, setStates] = useState<ConditionStates>(defaultStates());
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);

  const [running, setRunning] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [scores, setScores] = useState<Record<string, Tally>>({});

  const conditions = useMemo(() => conditionsFor(act), [act]);
  const scenario = useMemo(() => generateAustin(act, states), [act, states]);
  // The model is part of the setup, so it keys the scorecard too.
  const sig = useMemo(
    () => modelId + "|" + act.id + "|" + conditions.map((c) => c.key + (states[c.key] ? "1" : "0")).join(""),
    [modelId, act, conditions, states],
  );
  const tally = scores[sig];

  function chooseAct(id: string) {
    const a = BUILTIN_ACTS.find((x) => x.id === id) ?? BUILTIN_ACTS[0];
    setAct(a);
    setStates(defaultStates());
    setTurns([]);
    setResult(null);
  }

  function toggle(key: ConditionKey) {
    setStates((s) => ({ ...s, [key]: !s[key] }));
    setTurns([]);
    setResult(null);
  }

  async function run() {
    setRunning(true);
    setTurns([]);
    setResult(null);
    try {
      const r = await runDiegoEliza(act, states, modelId, (t) => setTurns((p) => [...p, t]));
      setResult(r);
      if (r.status !== "error") {
        setScores((sc) => {
          const cur = sc[sig] ?? { up: 0, total: 0 };
          return { ...sc, [sig]: { up: cur.up + (r.uptake ? 1 : 0), total: cur.total + 1 } };
        });
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="searlebot">
      <header className="sb-head">
        <h1>AUSTIN BOT</h1>
        <div className="sb-sub">CHARACTERS</div>
        <div className="sb-names">Diego &amp; Eliza</div>
      </header>

      {/* ── act selector + explanation ─────────────────────────────────── */}
      <div className="cols">
        <div className="col-left">
          <label className="field">Speech act</label>
          <select value={act.id} onChange={(e) => chooseAct(e.target.value)} disabled={running}>
            {BUILTIN_ACTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-right">
          <p className="sb-explain">
            <strong>Diego will attempt to {act.name.toLowerCase()}</strong> {act.propositionalContent}.
            For example: <em>“{act.utteranceExample}”</em>.
          </p>
          <p className="sb-explain">
            <strong>Uptake is measured</strong> by what Eliza does next: {act.uptakeSignature}.
          </p>
        </div>
      </div>

      {/* ── CONDITIONS heading (left only) ─────────────────────────────── */}
      <div className="cols">
        <div className="col-left">
          <h2 className="sb-conditions">CONDITIONS</h2>
        </div>
        <div className="col-right" />
      </div>

      {/* ── condition toggles + live prompt fragments ──────────────────── */}
      {conditions.map((c) => {
        const on = states[c.key];
        const frag = scenario.fragments[c.key];
        return (
          <div className="cols cond-row-sb" key={c.key}>
            <div className="col-left">
              <button
                type="button"
                className={`cond-toggle ${on ? "true" : "false"}`}
                onClick={() => toggle(c.key)}
                disabled={running}
              >
                <span className="cond-state">{on ? "TRUE" : "FALSE"}</span>
                <span className="cond-text">{c.label}</span>
              </button>
            </div>
            <div className="col-right">
              <div className={`frag-box ${on ? "true" : "false"}`}>
                <div className="frag-side">
                  → goes into{" "}
                  {frag.side === "both" ? "both Diego’s and Eliza’s" : `${frag.side}’s`} initial
                  prompt
                </div>
                <pre>{frag.text}</pre>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── verbatim prompts (exactly what each model receives) ────────── */}
      <div className="sb-prompts">
        <h2 className="sb-conditions">EXACT PROMPTS</h2>
        <details className="sb-reveal">
          <summary>View Diego’s initial prompt (verbatim)</summary>
          <pre>{`[System prompt given to Diego]\n${scenario.speakerSystemPrompt}\n\n[First message given to Diego]\n${scenario.targetUtteranceSpec}`}</pre>
        </details>
        <details className="sb-reveal">
          <summary>View Eliza’s initial prompt (verbatim)</summary>
          <pre>{`[System prompt given to Eliza]\n${scenario.hearerSystemPrompt}\n\n[Eliza then receives Diego’s message, replies, and is asked the uptake-check question below.]`}</pre>
        </details>
        <details className="sb-reveal">
          <summary>View the uptake-check question put to Eliza (verbatim)</summary>
          <pre>{scenario.followUp}</pre>
        </details>
      </div>

      {/* ── columns end: run + dialogue + result + scorecard ───────────── */}
      <div className="sb-run">
        <button className="btn" onClick={run} disabled={running}>
          {running ? "Running…" : "▶ Run the dialogue"}
        </button>
        <label className="sb-model">
          <span className="small muted">Model</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={running}>
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <span className="small muted">single run</span>
      </div>

      {(turns.length > 0 || running) && (
        <div className="panel sb-dialogue">
          <ChatTranscript
            turns={turns}
            result={result}
            running={running}
            speakerName="Diego"
            hearerName="Eliza"
            channel="concealed"
          />
        </div>
      )}

      {result && result.status === "error" && (
        <div className="note">Couldn’t run: {result.error}</div>
      )}

      {result && result.status !== "error" && <UptakeBanner result={result} />}

      {tally && (
        <div className="scorecard">
          <div className="sc-big">
            {tally.up}/{tally.total}
          </div>
          <div className="sc-text">
            With <strong>this exact setup</strong>, the act has been taken up{" "}
            {tally.up} of {tally.total} time{tally.total === 1 ? "" : "s"} this session. Run it again
            to build the picture — a single run never settles it.
          </div>
        </div>
      )}
    </div>
  );
}

function UptakeBanner({ result }: { result: RunResult }) {
  const took = result.uptake === true;
  const invalid = result.uptake === null;
  return (
    <div className={`uptake-banner ${took ? "yes" : invalid ? "inv" : "no"}`}>
      <span className="ub-head">
        {invalid ? "Couldn’t read Eliza’s response" : took ? "The act came off" : "The act did not come off"}
      </span>
      <span className="ub-sub">
        {invalid
          ? "Eliza’s reply didn’t resolve to a clear action."
          : `Eliza ${took ? "took it up" : "did not take it up"} — ${CATEGORY_LABELS[result.category]}.`}
      </span>
    </div>
  );
}
