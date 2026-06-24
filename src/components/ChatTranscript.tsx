import type { EpistemicChannel, RunResult, Turn } from "../core/types";
import { CATEGORY_LABELS } from "../ui-util";

// Traditional chatbot-style rendering of a single dialogue: Sam (speaker) on the
// left, Riley (hearer) on the right, the neutral probe as a centered system
// message. The speaker's private <plan> (Thread 2) is shown as a side note,
// labelled by whether the epistemic channel exposes it to Riley.

export function ChatTranscript({
  turns,
  result,
  channel,
  running,
}: {
  turns: Turn[];
  result?: RunResult | null;
  channel: EpistemicChannel;
  running: boolean;
}) {
  if (turns.length === 0 && !running) {
    return (
      <div className="chat-empty">
        <p className="muted">No dialogue yet. Set the conditions below and run.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="chat">
        {turns.map((t, i) => (
          <TurnBubbles key={i} turn={t} channel={channel} />
        ))}
        {running && <Typing />}
      </div>
      {result && result.status !== "error" && <VerdictChip result={result} />}
      {result && result.status === "error" && (
        <div className="verdict invalid">Run error: {result.error}</div>
      )}
    </div>
  );
}

function TurnBubbles({ turn, channel }: { turn: Turn; channel: EpistemicChannel }) {
  if (turn.role === "speaker") {
    const spoken = turn.say !== undefined ? turn.say : turn.text;
    return (
      <div className="msg sam">
        <div className="avatar sam">S</div>
        <div className="bubble">
          <div className="name">Sam · speaker</div>
          {turn.plan !== undefined && (
            <div className={`plan-note ${channel === "revealed" ? "open" : "hidden"}`}>
              <span className="plan-tag">
                {channel === "revealed"
                  ? "👁 private notes — visible to Riley (channel open)"
                  : "🔒 private notes — hidden from Riley"}
              </span>
              <div>{turn.plan}</div>
            </div>
          )}
          <div className="text">{spoken?.trim() || <em className="muted">(empty)</em>}</div>
        </div>
      </div>
    );
  }

  if (turn.role === "hearer") {
    return (
      <div className="msg riley">
        <div className="bubble">
          <div className="name">Riley · hearer</div>
          <div className="text">{turn.text.trim() || <em className="muted">(empty)</em>}</div>
        </div>
        <div className="avatar riley">R</div>
      </div>
    );
  }

  // probe: a centered neutral question, then Riley's forced-choice answer.
  return (
    <>
      <div className="msg probe">
        <div className="bubble">
          <div className="name">Neutral probe · measurement turn</div>
          <details>
            <summary>forced-choice question (parsed deterministically — no LLM judge)</summary>
            <div className="text" style={{ marginTop: 6 }}>
              {turn.shown}
            </div>
          </details>
        </div>
      </div>
      <div className="msg riley">
        <div className="bubble answer">
          <div className="name">Riley · answer</div>
          <div className="text mono">{turn.text.trim() || <em className="muted">(empty)</em>}</div>
        </div>
        <div className="avatar riley">R</div>
      </div>
    </>
  );
}

function Typing() {
  return (
    <div className="msg sam">
      <div className="avatar sam">…</div>
      <div className="bubble">
        <div className="typing">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function VerdictChip({ result }: { result: RunResult }) {
  const cls = result.uptake === true ? "" : result.uptake === false ? "no" : "invalid";
  const head =
    result.uptake === true
      ? "UPTAKE"
      : result.uptake === false
        ? "NO UPTAKE"
        : "INVALID (unparseable)";
  return (
    <div className={`verdict ${cls}`}>
      <span className="mono">{head}</span>
      <span className="muted small">— {CATEGORY_LABELS[result.category]}</span>
    </div>
  );
}
