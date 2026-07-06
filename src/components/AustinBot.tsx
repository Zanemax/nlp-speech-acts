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

  // Manual overrides of the composed system prompts. null = use the generated
  // prompt (and follow condition/act changes); a string = the user has edited it.
  const [editedSpeaker, setEditedSpeaker] = useState<string | null>(null);
  const [editedHearer, setEditedHearer] = useState<string | null>(null);

  const conditions = useMemo(() => conditionsFor(act), [act]);
  const scenario = useMemo(() => generateAustin(act, states), [act, states]);

  // Effective system prompts that will actually be sent.
  const speakerPrompt = editedSpeaker ?? scenario.speakerSystemPrompt;
  const hearerPrompt = editedHearer ?? scenario.hearerSystemPrompt;

  // The model + act + conditions + any manual edits all define the "setup", so
  // they key the scorecard. Unedited runs keep the same key as before.
  const editKey =
    editedSpeaker !== null || editedHearer !== null
      ? "|edit:" + hashStr((editedSpeaker ?? "") + "¦" + (editedHearer ?? ""))
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
  const tally = scores[sig];

  function resetEdits() {
    setEditedSpeaker(null);
    setEditedHearer(null);
  }

  function chooseAct(id: string) {
    const a = BUILTIN_ACTS.find((x) => x.id === id) ?? BUILTIN_ACTS[0];
    setAct(a);
    setStates(defaultStates());
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
    setTurns([]);
    setResult(null);
    try {
      const r = await runDiegoEliza(act, states, modelId, (t) => setTurns((p) => [...p, t]), {
        speakerSystemPrompt: speakerPrompt,
        hearerSystemPrompt: hearerPrompt,
      });
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
        <div className="sb-brand">
          <img className="sb-austin" src="/austin.png" alt="J. L. Austin — binary portrait" width={92} height={112} />
          <h1>AUSTIN BOT</h1>
        </div>
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
            Diego and Eliza are two collegues, both played by seperate Gemini LLMs.
          </p>

          <p className="sb-explain">
            <strong>{act.name}:</strong> {act.propositionalContent}.
            For example: <em>“{act.utteranceExample}”</em>.
          </p>
          <p className="sb-explain">
            <strong>Uptake:</strong> how Eliza responds to a prompt about what she will do next. {act.uptakeSignature}.
          </p>
        </div>
      </div>

      {/* ── CONDITIONS heading ─────────────────────────────────────────── */}
      <h2 className="sb-conditions">FELICITY CONDITIONS</h2>

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
                  goes into{" "}
                  {frag.side === "both" ? "both Diego’s and Eliza’s" : `${frag.side}’s`}{" "}
                  {c.key === "execution" ? "first message" : "system prompt"}
                </div>
                <pre>{frag.text}</pre>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── system prompts (editable) + verbatim extras ────────────────── */}
      <div className="sb-prompts">
        <h2 className="sb-conditions">SYSTEM PROMPTS</h2>
        <p className="sb-prompt-note">
          Composed from the conditions above — but you can edit them by hand and run your own.
          Changing a condition or the act resets them to the generated version.
        </p>

        <PromptEditor
          label="Diego's system prompt"
          value={speakerPrompt}
          edited={editedSpeaker !== null}
          disabled={running}
          onChange={setEditedSpeaker}
          onReset={() => setEditedSpeaker(null)}
        />
        <PromptEditor
          label="Eliza's system prompt"
          value={hearerPrompt}
          edited={editedHearer !== null}
          disabled={running}
          onChange={setEditedHearer}
          onReset={() => setEditedHearer(null)}
        />

        <details className="sb-reveal">
          <summary>Prompt that triggers Diego's act</summary>
          <pre>{scenario.targetUtteranceSpec}</pre>
        </details>
        <details className="sb-reveal">
          <summary>Uptake question given to Eliza</summary>
          <pre>{scenario.followUp}</pre>
        </details>
      </div>

      {/* ── columns end: run + dialogue + result + scorecard ───────────── */}
      <div className="sb-run">
        <button className="btn" onClick={run} disabled={running}>
          <svg className="btn-ic" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
          {running ? "Running…" : "Run"}
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
        <span className="sb-hint">single run</span>
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
            With this setup, the act has been taken up{" "}
            {tally.up} of {tally.total} time{tally.total === 1 ? "" : "s"} this session.
          </div>
        </div>
      )}
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
        rows={Math.min(12, Math.max(4, value.split("\n").length + 1))}
      />
    </div>
  );
}

/** Small stable string hash (djb2) for keying the scorecard by edited content. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
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
          : `Eliza ${took ? "took it up" : "did not take it up"}`}
      </span>
    </div>
  );
}
